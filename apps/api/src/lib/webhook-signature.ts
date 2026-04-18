import { createHmac } from 'node:crypto';

/**
 * HMAC signing for agent webhook deliveries (AGENTIC_TODO §20 Wave 5).
 *
 * Canonical message: `"<timestamp>.<body>"` where timestamp is a unix
 * seconds string and body is the exact bytes of the JSON payload POSTed
 * to the receiver. The signature is hex-encoded SHA-256 HMAC, prefixed
 * with `sha256=` to match the existing BigBlueBam webhook convention
 * (apps/api/src/routes/webhook.routes.ts, BAM-024).
 *
 *   X-BigBlueBam-Signature: sha256=<hex>
 *   X-BigBlueBam-Timestamp: <unix-seconds>
 *   X-BigBlueBam-Delivery:  <delivery uuid>
 *   X-BigBlueBam-Event:     <event_source>.<event_type>
 *
 * Receivers verify by recomputing HMAC(secret, `${timestamp}.${body}`) and
 * checking in constant time. A timestamp skew window of 5 minutes is
 * recommended on the receiver side to reject replays.
 */

export interface SignedWebhookPayload {
  timestamp: string;
  signature: string;
  body: string;
}

/**
 * Sign a stringified JSON body with the per-runner HMAC secret.
 *
 * Always produces a fresh timestamp. If the caller needs to pin a
 * specific timestamp (tests, replays), pass it as the third argument.
 */
export function signWebhookBody(
  secret: string,
  body: string,
  timestampOverride?: string,
): SignedWebhookPayload {
  const timestamp = timestampOverride ?? String(Math.floor(Date.now() / 1000));
  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}.${body}`);
  const signature = `sha256=${hmac.digest('hex')}`;
  return { timestamp, signature, body };
}

/**
 * Verify a signature produced by `signWebhookBody`. Uses a constant-time
 * comparison on the hex digest. Exported for unit tests and for any
 * future "replay a delivery" admin tool.
 */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  timestamp: string,
  signatureHeader: string,
): boolean {
  const expected = signWebhookBody(secret, body, timestamp).signature;
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Backoff schedule for failed deliveries (seconds). Indexed by
 * `attempt_count` AFTER the just-failed attempt has been recorded.
 *   attempt 1 failed → next_retry_at = now + BACKOFF_SCHEDULE[1]
 *   attempt 2 failed → now + BACKOFF_SCHEDULE[2]
 *   ...
 *   attempt 7 failed → now + BACKOFF_SCHEDULE[7]
 *   attempt 8 failed → dead-lettered (no retry)
 *
 * The first slot (attempt 0 / first-ever try) is zero: the dispatcher
 * should fire immediately on the initial enqueue, no delay.
 */
export const BACKOFF_SCHEDULE_SECONDS: readonly number[] = [
  0,        // attempt 1 initial try — fire now
  30,       // attempt 2 → wait 30s
  120,      // attempt 3 → 2m
  600,      // attempt 4 → 10m
  1800,     // attempt 5 → 30m
  7200,     // attempt 6 → 2h
  21600,    // attempt 7 → 6h
] as const;

export const DLQ_AT_ATTEMPT = 8;
export const CIRCUIT_BREAKER_THRESHOLD = 20;
export const PAYLOAD_CAP_BYTES = 256 * 1024;

/**
 * Compute the next retry delay in seconds for a just-failed attempt.
 * Returns null when the attempt count has exceeded the retry budget
 * (caller should mark the row dead_lettered).
 */
export function nextRetryDelaySeconds(attemptCount: number): number | null {
  if (attemptCount < 1) return 0;
  if (attemptCount >= DLQ_AT_ATTEMPT) return null;
  const slot = BACKOFF_SCHEDULE_SECONDS[attemptCount];
  return slot ?? null;
}

/**
 * If the JSON body exceeds PAYLOAD_CAP_BYTES, return a stub envelope the
 * dispatcher should deliver instead. Returns null when the body is under
 * the cap.
 */
export function truncatePayloadIfOverCap(
  fullPayload: Record<string, unknown>,
  meta: {
    event_id: string;
    source: string;
    event_type: string;
    deep_link?: string | null;
  },
): Record<string, unknown> | null {
  const serialized = JSON.stringify(fullPayload);
  if (Buffer.byteLength(serialized, 'utf8') <= PAYLOAD_CAP_BYTES) return null;
  return {
    event_id: meta.event_id,
    source: meta.source,
    event_type: meta.event_type,
    truncated: true,
    deep_link: meta.deep_link ?? null,
  };
}
