import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Minimal stubs for Bam tables referenced by Banter
// These mirror the existing Bam schema but are defined here so
// banter-api can reference them without importing from @bigbluebam/api.

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  logo_url: text('logo_url'),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).unique().notNull(),
    display_name: varchar('display_name', { length: 100 }).notNull(),
    avatar_url: text('avatar_url'),
    password_hash: text('password_hash'),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
    notification_prefs: jsonb('notification_prefs').default({}).notNull(),
    is_active: boolean('is_active').default(true).notNull(),
    is_superuser: boolean('is_superuser').default(false).notNull(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_org_id_idx').on(table.org_id),
    index('users_email_idx').on(table.email),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    data: jsonb('data').default({}).notNull(),
    // Session-level active org. Set by Bam's /auth/switch-org and
    // /superuser/context/switch. Mirrors the column already present in
    // the live DB (see apps/api/src/db/schema/sessions.ts) so Banter can
    // honor cross-app org switches. No migration needed — the column
    // already exists; this declaration closes a drift gap.
    active_org_id: uuid('active_org_id'),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.user_id),
    index('sessions_expires_at_idx').on(table.expires_at),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    key_hash: text('key_hash').notNull(),
    key_prefix: varchar('key_prefix', { length: 12 }).notNull(),
    scope: varchar('scope', { length: 50 }).default('read').notNull(),
    project_ids: uuid('project_ids').array(),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('api_keys_user_id_idx').on(table.user_id),
    index('api_keys_key_prefix_idx').on(table.key_prefix),
  ],
);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    is_default: boolean('is_default').default(false).notNull(),
    joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    invited_by: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('org_memberships_user_org_idx').on(table.user_id, table.org_id),
    index('org_memberships_user_id_idx').on(table.user_id),
    index('org_memberships_org_id_idx').on(table.org_id),
  ],
);
