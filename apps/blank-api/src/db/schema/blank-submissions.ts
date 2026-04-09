import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  inet,
  index,
} from 'drizzle-orm/pg-core';
import { blankForms } from './blank-forms.js';
import { organizations, users } from './bbb-refs.js';

export const blankSubmissions = pgTable(
  'blank_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    form_id: uuid('form_id')
      .notNull()
      .references(() => blankForms.id, { onDelete: 'cascade' }),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    response_data: jsonb('response_data').notNull(),
    submitted_by_user_id: uuid('submitted_by_user_id').references(() => users.id),
    submitted_by_email: varchar('submitted_by_email', { length: 255 }),
    submitted_by_ip: inet('submitted_by_ip'),
    user_agent: text('user_agent'),
    attachments: jsonb('attachments').default([]),
    processed: boolean('processed').notNull().default(false),
    submitted_at: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blank_submissions_form').on(table.form_id),
    index('idx_blank_submissions_org').on(table.organization_id),
    index('idx_blank_submissions_email').on(table.submitted_by_email),
  ],
);
