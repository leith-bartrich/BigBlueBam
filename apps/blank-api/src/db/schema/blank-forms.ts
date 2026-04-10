import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users, projects } from './bbb-refs.js';

export const blankForms = pgTable(
  'blank_forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    slug: varchar('slug', { length: 60 }).notNull(),
    form_type: varchar('form_type', { length: 20 }).notNull().default('public'),
    visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    requires_login: boolean('requires_login').notNull().default(false),
    allowed_domains: text('allowed_domains').array(),
    accept_responses: boolean('accept_responses').notNull().default(true),
    max_responses: integer('max_responses'),
    one_per_email: boolean('one_per_email').notNull().default(false),
    show_progress_bar: boolean('show_progress_bar').notNull().default(false),
    shuffle_fields: boolean('shuffle_fields').notNull().default(false),
    confirmation_type: varchar('confirmation_type', { length: 20 }).notNull().default('message'),
    confirmation_message: text('confirmation_message').default('Thank you for your submission!'),
    confirmation_redirect_url: text('confirmation_redirect_url'),
    header_image_url: text('header_image_url'),
    theme_color: varchar('theme_color', { length: 7 }).default('#3b82f6'),
    custom_css: text('custom_css'),
    notify_on_submit: boolean('notify_on_submit').notNull().default(false),
    notify_emails: text('notify_emails').array(),
    notify_banter_channel_id: uuid('notify_banter_channel_id'),
    rate_limit_per_ip: integer('rate_limit_per_ip').default(10),
    captcha_enabled: boolean('captcha_enabled').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    published_at: timestamp('published_at', { withTimezone: true }),
    closed_at: timestamp('closed_at', { withTimezone: true }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blank_forms_org').on(table.organization_id),
  ],
);
