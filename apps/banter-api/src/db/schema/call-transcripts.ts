import {
  pgTable,
  uuid,
  text,
  real,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterCalls } from './calls.js';

export const banterCallTranscripts = pgTable(
  'banter_call_transcripts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    call_id: uuid('call_id')
      .notNull()
      .references(() => banterCalls.id, { onDelete: 'cascade' }),
    speaker_id: uuid('speaker_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    ended_at: timestamp('ended_at', { withTimezone: true }).notNull(),
    confidence: real('confidence'),
    is_final: boolean('is_final').notNull().default(true),
  },
  (table) => [
    index('banter_call_transcripts_call_idx').on(table.call_id, table.started_at),
  ],
);
