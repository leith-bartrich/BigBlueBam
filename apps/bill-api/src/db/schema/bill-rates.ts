import {
  pgTable,
  uuid,
  varchar,
  bigint,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';

export const billRates = pgTable(
  'bill_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    rate_amount: bigint('rate_amount', { mode: 'number' }).notNull(),
    rate_type: varchar('rate_type', { length: 10 }).notNull().default('hourly'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    effective_from: date('effective_from').notNull().defaultNow(),
    effective_to: date('effective_to'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bill_rates_org').on(table.organization_id),
    index('idx_bill_rates_resolve').on(
      table.organization_id,
      table.project_id,
      table.user_id,
      table.effective_from,
    ),
  ],
);
