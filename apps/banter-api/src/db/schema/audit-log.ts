import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';

export const banterAuditLog = pgTable(
  'banter_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: uuid('entity_id'),
    details: jsonb('details'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_banter_audit_org_time').on(table.org_id, table.created_at),
    index('idx_banter_audit_user_time').on(table.user_id, table.created_at),
    index('idx_banter_audit_action').on(table.action),
  ],
);
