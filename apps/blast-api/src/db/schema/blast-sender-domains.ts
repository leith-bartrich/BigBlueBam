import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const blastSenderDomains = pgTable(
  'blast_sender_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 255 }).notNull(),
    spf_verified: boolean('spf_verified').notNull().default(false),
    dkim_verified: boolean('dkim_verified').notNull().default(false),
    dmarc_verified: boolean('dmarc_verified').notNull().default(false),
    verified_at: timestamp('verified_at', { withTimezone: true }),
    dns_records: jsonb('dns_records'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('blast_sender_domains_org_domain_idx').on(table.organization_id, table.domain),
  ],
);
