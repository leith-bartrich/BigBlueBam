import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superuser_id: uuid('superuser_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    target_user_id: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    reason: text('reason'),
  },
  (table) => [
    index('idx_imp_sessions_superuser').on(table.superuser_id),
    index('idx_imp_sessions_target').on(table.target_user_id),
    index('idx_imp_sessions_active').on(table.superuser_id, table.target_user_id, table.ended_at),
  ],
);
