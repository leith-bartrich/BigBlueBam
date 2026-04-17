import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

/**
 * OAuth provider registry. One row per external IdP (github, google, ...).
 * Matches migration 0118_oauth_providers.sql.
 */
export const oauthProviders = pgTable(
  'oauth_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider_name: varchar('provider_name', { length: 50 }).notNull().unique(),
    client_id: text('client_id').notNull(),
    client_secret: text('client_secret').notNull(),
    authorization_url: text('authorization_url').notNull(),
    token_url: text('token_url').notNull(),
    user_info_url: text('user_info_url').notNull(),
    scopes: text('scopes').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_oauth_providers_name').on(table.provider_name)],
);
