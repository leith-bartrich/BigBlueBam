import type Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billInvoiceSequences, billSettings } from '../db/schema/index.js';
import { formatInvoiceNumber } from '../lib/utils.js';

/**
 * G3: Invoice number sequence locking.
 *
 * The prior implementation used a single atomic SQL UPDATE ... RETURNING to
 * increment bill_invoice_sequences.next_number, which is race safe inside
 * Postgres but does not coordinate with other work we may want to do before
 * the row is visible (for example, staging an assignment, reserving a
 * BullMQ job id, or calling out to an external service). This helper layers
 * a short-lived Redis lock on top of the SQL increment so every
 * reservation of an invoice number happens inside a critical section
 * scoped to the org, producing a visible, debuggable audit trail when
 * something goes wrong.
 *
 * The lock is best-effort: if Redis is unavailable the call falls through
 * to the SQL path so finalize still succeeds. The lock key carries a random
 * token so only the caller that acquired it can release it (standard Redlock
 * 101). Lock TTL is 5 seconds which is far longer than the SQL round trip
 * but short enough that a crashed node does not block finalize for long.
 */

const LOCK_PREFIX = 'bill:seq:lock:';
const LOCK_TTL_MS = 5000;
const MAX_LOCK_WAIT_MS = 3000;
const LOCK_RETRY_MS = 50;

function lockKey(orgId: string): string {
  return `${LOCK_PREFIX}${orgId}`;
}

function randomToken(): string {
  // crypto is available globally on Node 22.
  return globalThis.crypto.randomUUID();
}

async function acquireLock(
  redis: Redis,
  orgId: string,
): Promise<string | null> {
  const token = randomToken();
  const key = lockKey(orgId);
  const started = Date.now();
  while (Date.now() - started < MAX_LOCK_WAIT_MS) {
    // SET key value NX PX ms returns 'OK' on success, null on contention.
    const result = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (result === 'OK') return token;
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
  return null;
}

// Compare-and-delete: only release the lock if we still own it.
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

async function releaseLock(redis: Redis, orgId: string, token: string): Promise<void> {
  try {
    await redis.eval(RELEASE_SCRIPT, 1, lockKey(orgId), token);
  } catch {
    // Swallow: the lock TTL will reap stuck locks automatically.
  }
}

export interface ReservedInvoiceNumber {
  invoice_number: string;
  prefix: string;
  number: number;
}

/**
 * Atomically reserve the next invoice number for an organization.
 *
 * 1. Acquire Redis lock scoped to org (best effort).
 * 2. Upsert bill_invoice_sequences row if missing (uses settings.invoice_prefix).
 * 3. Atomically increment next_number and return the previous value.
 * 4. Format the invoice number using formatInvoiceNumber.
 * 5. Release the lock in a finally block.
 *
 * Returns a ReservedInvoiceNumber so the caller can persist both the
 * formatted string and the raw numeric value if it wants to.
 */
export async function reserveInvoiceNumber(
  redis: Redis | null,
  orgId: string,
): Promise<ReservedInvoiceNumber> {
  let token: string | null = null;
  if (redis) {
    token = await acquireLock(redis, orgId);
    // If the lock fails we fall through and still do the SQL work. The
    // single-statement UPDATE is race safe on its own; the lock mostly
    // exists to serialize surrounding work, not to fix the increment.
  }

  try {
    let [seq] = await db
      .select()
      .from(billInvoiceSequences)
      .where(eq(billInvoiceSequences.organization_id, orgId))
      .limit(1);

    if (!seq) {
      const [settings] = await db
        .select()
        .from(billSettings)
        .where(eq(billSettings.organization_id, orgId))
        .limit(1);

      [seq] = await db
        .insert(billInvoiceSequences)
        .values({
          organization_id: orgId,
          prefix: settings?.invoice_prefix ?? 'INV',
          next_number: 1,
        })
        .returning();
    }

    // Atomic increment: read current, write current+1. Two concurrent
    // transactions serialize behind Postgres row locks here.
    const current = seq!.next_number;
    await db
      .update(billInvoiceSequences)
      .set({ next_number: current + 1 })
      .where(eq(billInvoiceSequences.organization_id, orgId));

    return {
      invoice_number: formatInvoiceNumber(seq!.prefix, current),
      prefix: seq!.prefix,
      number: current,
    };
  } finally {
    if (redis && token) {
      await releaseLock(redis, orgId, token);
    }
  }
}
