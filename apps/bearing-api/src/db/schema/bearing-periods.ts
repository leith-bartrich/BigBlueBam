import { pgTable, uuid, varchar, date, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';
import { users } from './bbb-refs.js';

export const bearingPeriods = pgTable('bearing_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  period_type: varchar('period_type', { length: 20 }).notNull(),
  starts_at: date('starts_at').notNull(),
  ends_at: date('ends_at').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('planning'),
  created_by: uuid('created_by').notNull().references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bearing_periods_org').on(table.organization_id),
  index('idx_bearing_periods_status').on(table.status),
  unique('bearing_periods_org_name').on(table.organization_id, table.name),
]);
