import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './bbb-refs.js';
import { blastTemplates } from './blast-templates.js';
import { blastSegments } from './blast-segments.js';

export const blastCampaigns = pgTable(
  'blast_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    template_id: uuid('template_id').references(() => blastTemplates.id, { onDelete: 'set null' }),
    subject: varchar('subject', { length: 500 }).notNull(),
    html_body: text('html_body').notNull(),
    plain_text_body: text('plain_text_body'),
    segment_id: uuid('segment_id').references(() => blastSegments.id, { onDelete: 'set null' }),
    recipient_count: integer('recipient_count'),
    from_name: varchar('from_name', { length: 100 }),
    from_email: varchar('from_email', { length: 255 }),
    reply_to_email: varchar('reply_to_email', { length: 255 }),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    scheduled_at: timestamp('scheduled_at', { withTimezone: true }),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    total_sent: integer('total_sent').default(0),
    total_delivered: integer('total_delivered').default(0),
    total_bounced: integer('total_bounced').default(0),
    total_opened: integer('total_opened').default(0),
    total_clicked: integer('total_clicked').default(0),
    total_unsubscribed: integer('total_unsubscribed').default(0),
    total_complained: integer('total_complained').default(0),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blast_campaigns_org').on(table.organization_id),
    index('idx_blast_campaigns_status').on(table.status),
    index('idx_blast_campaigns_sent').on(table.sent_at),
  ],
);
