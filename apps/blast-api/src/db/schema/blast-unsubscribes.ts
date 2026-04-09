import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, bondContacts } from './bbb-refs.js';

export const blastUnsubscribes = pgTable(
  'blast_unsubscribes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    contact_id: uuid('contact_id').references(() => bondContacts.id, { onDelete: 'set null' }),
    reason: text('reason'),
    unsubscribed_at: timestamp('unsubscribed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('blast_unsubscribes_org_email_idx').on(table.organization_id, table.email),
    index('idx_blast_unsub_org').on(table.organization_id, table.email),
  ],
);
