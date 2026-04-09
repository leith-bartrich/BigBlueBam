import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  inet,
  index,
} from 'drizzle-orm/pg-core';
import { bondContacts } from './bbb-refs.js';
import { blastCampaigns } from './blast-campaigns.js';
import { blastSendLog } from './blast-send-log.js';

export const blastEngagementEvents = pgTable(
  'blast_engagement_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    send_log_id: uuid('send_log_id')
      .notNull()
      .references(() => blastSendLog.id, { onDelete: 'cascade' }),
    campaign_id: uuid('campaign_id')
      .notNull()
      .references(() => blastCampaigns.id, { onDelete: 'cascade' }),
    contact_id: uuid('contact_id')
      .notNull()
      .references(() => bondContacts.id, { onDelete: 'cascade' }),
    event_type: varchar('event_type', { length: 20 }).notNull(),
    clicked_url: text('clicked_url'),
    ip_address: inet('ip_address'),
    user_agent: text('user_agent'),
    occurred_at: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blast_engage_campaign').on(table.campaign_id, table.event_type),
    index('idx_blast_engage_contact').on(table.contact_id, table.occurred_at),
    index('idx_blast_engage_send').on(table.send_log_id),
  ],
);
