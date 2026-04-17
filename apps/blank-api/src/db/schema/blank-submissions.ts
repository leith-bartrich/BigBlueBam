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
    // 0089_blank_file_processing_status.sql: track worker file processing.
    file_processing_status: varchar('file_processing_status', { length: 20 }).default('pending'),
    file_processing_error: text('file_processing_error'),
    processed_files: jsonb('processed_files').default({}),
    // 0090_blank_submission_event_emission.sql: Bolt event emission idempotency.
    bolt_events_emitted: boolean('bolt_events_emitted').default(false),
    bolt_event_emit_error: text('bolt_event_emit_error'),
    submitted_at: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_blank_submissions_form').on(table.form_id),
    index('idx_blank_submissions_org').on(table.organization_id),
    index('idx_blank_submissions_email').on(table.submitted_by_email),
    index('idx_blank_submissions_file_status').on(table.file_processing_status),
    index('idx_blank_submissions_bolt_events_pending').on(table.bolt_events_emitted),
  ],
);
