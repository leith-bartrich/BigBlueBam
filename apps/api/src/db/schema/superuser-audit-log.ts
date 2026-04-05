import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const superuserAuditLog = pgTable(
  'superuser_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superuser_id: uuid('superuser_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    target_org_id: uuid('target_org_id'),
    target_user_id: uuid('target_user_id'),
    details: jsonb('details').default({}).notNull(),
    ip_address: varchar('ip_address', { length: 45 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('su_audit_superuser_idx').on(table.superuser_id),
    index('su_audit_action_idx').on(table.action),
    index('su_audit_created_at_idx').on(table.created_at),
  ],
);
