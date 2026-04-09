import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { bondDeals } from './bond-deals.js';
import { bondContacts } from './bond-contacts.js';

export const bondDealContacts = pgTable(
  'bond_deal_contacts',
  {
    deal_id: uuid('deal_id')
      .notNull()
      .references(() => bondDeals.id, { onDelete: 'cascade' }),
    contact_id: uuid('contact_id')
      .notNull()
      .references(() => bondContacts.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 60 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deal_id, table.contact_id] }),
  ],
);
