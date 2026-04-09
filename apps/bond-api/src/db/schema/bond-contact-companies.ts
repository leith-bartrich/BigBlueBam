import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { bondContacts } from './bond-contacts.js';
import { bondCompanies } from './bond-companies.js';

export const bondContactCompanies = pgTable(
  'bond_contact_companies',
  {
    contact_id: uuid('contact_id')
      .notNull()
      .references(() => bondContacts.id, { onDelete: 'cascade' }),
    company_id: uuid('company_id')
      .notNull()
      .references(() => bondCompanies.id, { onDelete: 'cascade' }),
    role_at_company: varchar('role_at_company', { length: 100 }),
    is_primary: boolean('is_primary').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.contact_id, table.company_id] })],
);
