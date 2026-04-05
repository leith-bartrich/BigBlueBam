import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';

/**
 * Per-agent API keys for the /helpdesk/api/agents/* routes (HB-28 + HB-49).
 *
 * Each row represents one issuable token. The raw token is shown exactly
 * once at mint time (by `cli.js create-helpdesk-agent-key`) in the form
 * `hdag_<base64url 32 bytes>`; only its Argon2id hash is persisted here.
 * The prefix (first 8 chars, e.g. `hdag_ab`) is stored plaintext and
 * indexed so auth lookups can find the candidate row(s) without scanning
 * the whole table, matching the bbam_ key pattern in apps/api.
 *
 * `bbb_user_id` ties the key to the BigBlueBam employee wielding it,
 * which gives us a per-agent audit trail ("who did what") instead of the
 * undifferentiated shared-secret model it replaces.
 */
export const helpdeskAgentApiKeys = pgTable(
  'helpdesk_agent_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bbb_user_id: uuid('bbb_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    key_hash: text('key_hash').notNull(),
    key_prefix: varchar('key_prefix', { length: 8 }).notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_helpdesk_agent_api_keys_key_prefix').on(table.key_prefix),
    index('idx_helpdesk_agent_api_keys_bbb_user_id').on(table.bbb_user_id),
  ],
);
