// ---------------------------------------------------------------------------
// helpdesk_upsert_user service (AGENTIC_TODO §14 Wave 4)
//
// Idempotent create-or-update on (org_id, email). Natural key is backed by
// the existing per-org unique index from migration 0110
// (idx_helpdesk_users_org_id_email). Returns the full row plus a `created`
// boolean and an `idempotency_key`.
//
// Security: the update path MUST NOT overwrite password. The insert path
// hashes the supplied password with Argon2id; on update the `password`
// field is ignored so webhooks cannot escalate to an existing user's
// account. Tests cover this.
// ---------------------------------------------------------------------------

import { and, eq, sql } from 'drizzle-orm';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { helpdeskUsers } from '../db/schema/helpdesk-users.js';

export class UserUpsertError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'UserUpsertError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface UserUpsertInput {
  email: string;
  display_name: string;
  /** Only honored on the insert path. Silently ignored on update. */
  password?: string;
  email_verified?: boolean;
  is_active?: boolean;
}

export interface UserUpsertResult {
  data: typeof helpdeskUsers.$inferSelect;
  created: boolean;
  idempotency_key: string;
}

/**
 * Upsert a helpdesk_user by (org_id, email).
 *
 * - Insert path: hashes `password` with Argon2id. If no password is
 *   provided, generates a random 32-char nanoid hash so the account
 *   cannot be logged into until a reset flow sets a real password.
 * - Update path: updates `display_name`, `email_verified`, `is_active`
 *   only. **Never** writes `password_hash`, even if `password` is in the
 *   input. This is the critical security boundary of the tool.
 */
export async function upsertHelpdeskUserByEmail(
  input: UserUpsertInput,
  orgId: string,
): Promise<UserUpsertResult> {
  if (!input.email || input.email.trim() === '') {
    throw new UserUpsertError(
      'VALIDATION_ERROR',
      'email is required for helpdesk_upsert_user',
      400,
    );
  }
  if (!input.display_name || input.display_name.trim() === '') {
    throw new UserUpsertError(
      'VALIDATION_ERROR',
      'display_name is required for helpdesk_upsert_user',
      400,
    );
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  const [existing] = await db
    .select()
    .from(helpdeskUsers)
    .where(
      and(eq(helpdeskUsers.org_id, orgId), eq(helpdeskUsers.email, normalizedEmail)),
    )
    .limit(1);

  if (existing) {
    // Update path: NO password field, under any circumstance. The caller
    // cannot escalate to an existing account via this tool; password
    // reset goes through the dedicated flow on the helpdesk auth route.
    const updateValues: Record<string, unknown> = {
      updated_at: new Date(),
    };
    if (input.display_name !== undefined) updateValues.display_name = input.display_name;
    if (input.email_verified !== undefined) updateValues.email_verified = input.email_verified;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    const [updated] = await db
      .update(helpdeskUsers)
      .set(updateValues)
      .where(eq(helpdeskUsers.id, existing.id))
      .returning();

    return {
      data: updated!,
      created: false,
      idempotency_key: `email:${normalizedEmail}`,
    };
  }

  // Insert path. Hash the password if present, or a random sentinel if not.
  const passwordHash = await argon2.hash(
    input.password && input.password.length > 0 ? input.password : nanoid(32),
  );

  const inserted = await db
    .insert(helpdeskUsers)
    .values({
      org_id: orgId,
      email: normalizedEmail,
      display_name: input.display_name,
      password_hash: passwordHash,
      email_verified: input.email_verified ?? false,
      is_active: input.is_active ?? true,
    })
    .onConflictDoUpdate({
      // The existing unique constraint is idx_helpdesk_users_org_id_email
      // from migration 0110. On race-conflict, we do NOT write the
      // password_hash column (see comment above); the caller will still
      // see the up-to-date row via the RETURNING clause.
      target: [helpdeskUsers.org_id, helpdeskUsers.email],
      set: {
        display_name: input.display_name,
        updated_at: new Date(),
      },
    })
    .returning({
      // Same table-as-field cast pattern used in apps/bond-api and
      // apps/beacon-api upsert services to satisfy drizzle's typing
      // under @bigbluebam/db-stubs.
      user: helpdeskUsers as unknown as import('drizzle-orm').SQL<typeof helpdeskUsers.$inferSelect>,
      created: sql<boolean>`(xmax = 0)`.as('created'),
    });

  const row = inserted[0];
  if (!row) {
    throw new UserUpsertError('INTERNAL', 'Upsert returned no row', 500);
  }

  return {
    data: row.user as typeof helpdeskUsers.$inferSelect,
    created: row.created === true,
    idempotency_key: `email:${normalizedEmail}`,
  };
}
