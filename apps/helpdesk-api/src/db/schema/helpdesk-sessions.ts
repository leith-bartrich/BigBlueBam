import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { helpdeskUsers } from './helpdesk-users.js';

export const helpdeskSessions = pgTable(
  'helpdesk_sessions',
  {
    id: text('id').primaryKey(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => helpdeskUsers.id, { onDelete: 'cascade' }),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('helpdesk_sessions_user_id_idx').on(table.user_id),
  ],
);
