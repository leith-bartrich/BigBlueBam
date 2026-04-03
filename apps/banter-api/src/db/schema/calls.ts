import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterChannels } from './channels.js';

export const banterCalls = pgTable(
  'banter_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel_id: uuid('channel_id')
      .notNull()
      .references(() => banterChannels.id, { onDelete: 'cascade' }),
    started_by: uuid('started_by')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ringing'),
    livekit_room_name: varchar('livekit_room_name', { length: 255 }).notNull(),
    livekit_room_sid: varchar('livekit_room_sid', { length: 255 }),
    title: varchar('title', { length: 255 }),
    recording_enabled: boolean('recording_enabled').notNull().default(false),
    recording_storage_key: text('recording_storage_key'),
    transcription_enabled: boolean('transcription_enabled').notNull().default(false),
    transcript_storage_key: text('transcript_storage_key'),
    ai_agent_mode: varchar('ai_agent_mode', { length: 20 }).notNull().default('auto'),
    peak_participant_count: integer('peak_participant_count').notNull().default(0),
    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    duration_seconds: integer('duration_seconds'),
  },
  (table) => [
    index('banter_calls_channel_status_idx').on(table.channel_id, table.status),
    index('banter_calls_channel_started_idx').on(table.channel_id, table.started_at),
    index('banter_calls_started_by_idx').on(table.started_by, table.started_at),
  ],
);
