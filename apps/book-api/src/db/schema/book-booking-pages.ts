import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';

export const bookBookingPages = pgTable(
  'book_booking_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    owner_user_id: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 60 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    duration_minutes: integer('duration_minutes').notNull().default(30),
    buffer_before_min: integer('buffer_before_min').notNull().default(0),
    buffer_after_min: integer('buffer_after_min').notNull().default(15),
    max_advance_days: integer('max_advance_days').notNull().default(60),
    min_notice_hours: integer('min_notice_hours').notNull().default(4),
    color: varchar('color', { length: 7 }).default('#3b82f6'),
    logo_url: text('logo_url'),
    confirmation_message: text('confirmation_message').default(
      'Your meeting has been booked! You will receive a confirmation email.',
    ),
    redirect_url: text('redirect_url'),
    auto_create_bond_contact: boolean('auto_create_bond_contact').notNull().default(true),
    auto_create_bam_task: boolean('auto_create_bam_task').notNull().default(false),
    bam_project_id: uuid('bam_project_id').references(() => projects.id),
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('book_booking_pages_org_slug_idx').on(table.organization_id, table.slug),
    index('idx_book_pages_org').on(table.organization_id),
    index('idx_book_pages_owner').on(table.owner_user_id),
  ],
);
