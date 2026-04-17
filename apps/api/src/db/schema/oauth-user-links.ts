import { pgTable, uuid, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Links between local Bam users and their external OAuth accounts.
 * One user can have multiple provider links (github + google + ...).
 * Matches migration 0119_oauth_user_links.sql.
 */
export const oauthUserLinks = pgTable(
  'oauth_user_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider_name: varchar('provider_name', { length: 50 }).notNull(),
    external_id: text('external_id').notNull(),
    external_email: text('external_email').notNull(),
    external_login: text('external_login'),
    last_sync_at: timestamp('last_sync_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('oauth_user_links_provider_external_id_unique').on(table.provider_name, table.external_id),
    index('idx_oauth_user_links_provider_external').on(table.provider_name, table.external_id),
    index('idx_oauth_user_links_user').on(table.user_id),
  ],
);
