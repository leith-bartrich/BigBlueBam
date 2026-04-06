import { pgTable, integer, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Singleton row (id=1, enforced by a CHECK constraint in the migration) that
 * holds platform-wide toggles visible only to SuperUsers. Currently just one
 * switch: `public_signup_disabled` — when true, the Bam and Helpdesk register
 * endpoints reject new account creation and the login-page "Create one" links
 * redirect users to a beta-gate page.
 */
export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey().default(1),
  public_signup_disabled: boolean('public_signup_disabled').notNull().default(false),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updated_by: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type PlatformSettings = typeof platformSettings.$inferSelect;
