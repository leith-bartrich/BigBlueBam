import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bondContacts } from './bbb-refs.js';
import { blastCampaigns } from './blast-campaigns.js';

export const blastSendLog = pgTable(
  'blast_send_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaign_id: uuid('campaign_id')
      .notNull()
      .references(() => blastCampaigns.id, { onDelete: 'cascade' }),
    contact_id: uuid('contact_id')
      .notNull()
      .references(() => bondContacts.id, { onDelete: 'cascade' }),
    to_email: varchar('to_email', { length: 255 }).notNull(),
    smtp_message_id: varchar('smtp_message_id', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    bounce_type: varchar('bounce_type', { length: 20 }),
    bounce_reason: text('bounce_reason'),
    tracking_token: varchar('tracking_token', { length: 64 }).notNull().unique(),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    bounced_at: timestamp('bounced_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blast_send_campaign').on(table.campaign_id),
    index('idx_blast_send_contact').on(table.contact_id),
    index('idx_blast_send_token').on(table.tracking_token),
    index('idx_blast_send_status').on(table.status),
  ],
);
