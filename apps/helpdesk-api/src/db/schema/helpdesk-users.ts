import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const helpdeskUsers = pgTable(
  'helpdesk_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).unique().notNull(),
    display_name: varchar('display_name', { length: 100 }).notNull(),
    password_hash: text('password_hash').notNull(),
    email_verified: boolean('email_verified').default(false).notNull(),
    // TODO: hash with sha256 before storage; see HB-44 in audit.
    // Column will be renamed to email_verification_token_hash in a follow-up migration.
    email_verification_token: text('email_verification_token'),
    email_verification_sent_at: timestamp('email_verification_sent_at', { withTimezone: true }),
    is_active: boolean('is_active').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('helpdesk_users_email_idx').on(table.email),
  ],
);
