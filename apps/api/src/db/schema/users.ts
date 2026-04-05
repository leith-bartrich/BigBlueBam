import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, index, check, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

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
    disabled_at: timestamp('disabled_at', { withTimezone: true }),
    disabled_by: uuid('disabled_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_org_id_idx').on(table.org_id),
    index('users_email_idx').on(table.email),
    check('users_role_check', sql`role IN ('owner', 'admin', 'member', 'viewer', 'guest')`),
  ],
);
