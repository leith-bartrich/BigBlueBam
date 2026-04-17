import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const helpdeskUsers = pgTable(
  'helpdesk_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // G2 / HB-5: multi-tenant isolation. org_id is nullable at the Drizzle
    // level because migration 0109 is step 1 of an expand-contract rollout.
    // Historical rows may still have NULL until a customer re-registers under
    // a specific org. 0110 replaces the global UNIQUE(email) with per-org
    // UNIQUE(org_id, email). New inserts from the helpdesk register flow MUST
    // supply an org_id.
    org_id: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    display_name: varchar('display_name', { length: 100 }).notNull(),
    password_hash: text('password_hash').notNull(),
    email_verified: boolean('email_verified').default(false).notNull(),
    // Legacy plaintext column retained for historical rows that have not yet
    // expired. All NEW tokens are written to email_verification_token_hash
    // (SHA-256) only; this column is left NULL going forward. Migration 0113
    // added the hash column; both are read during verification until the
    // 24-hour in-flight window elapses.
    email_verification_token: text('email_verification_token'),
    // G7 / HB-44: SHA-256 hex of the verification token. See auth.routes.ts
    // for the hashing call. 64 chars since SHA-256 hex = 64.
    email_verification_token_hash: varchar('email_verification_token_hash', { length: 64 }),
    email_verification_sent_at: timestamp('email_verification_sent_at', { withTimezone: true }),
    is_active: boolean('is_active').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('helpdesk_users_email_idx').on(table.email),
    index('idx_helpdesk_users_org_id').on(table.org_id),
    index('idx_helpdesk_users_org_id_email').on(table.org_id, table.email),
    index('idx_helpdesk_users_email_verification_token_hash').on(
      table.email_verification_token_hash,
    ),
  ],
);
