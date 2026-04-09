import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';
import { bondContacts } from './bond-contacts.js';
import { bondDeals } from './bond-deals.js';
import { bondCompanies } from './bond-companies.js';

export const bondActivities = pgTable(
  'bond_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Polymorphic association
    contact_id: uuid('contact_id').references(() => bondContacts.id, { onDelete: 'cascade' }),
    deal_id: uuid('deal_id').references(() => bondDeals.id, { onDelete: 'cascade' }),
    company_id: uuid('company_id').references(() => bondCompanies.id, { onDelete: 'cascade' }),

    // Activity data
    activity_type: varchar('activity_type', { length: 30 }).notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body'),
    metadata: jsonb('metadata').default({}).notNull(),

    // Who performed the activity
    performed_by: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
    performed_at: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_bond_activities_contact').on(table.contact_id, table.performed_at),
    index('idx_bond_activities_deal').on(table.deal_id, table.performed_at),
    index('idx_bond_activities_company').on(table.company_id, table.performed_at),
    index('idx_bond_activities_org').on(table.organization_id, table.performed_at),
    index('idx_bond_activities_type').on(table.activity_type),
  ],
);
