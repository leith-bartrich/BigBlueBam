import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';
import { banterChannels } from './channels.js';

/**
 * banter_settings — per-org banter (chat) configuration.
 *
 * TODO (P2-1 unification): Several fields here overlap with the OrgPermissions
 * object stored in organizations.settings.permissions (see
 * apps/api/src/services/org-permissions.ts — DEFAULT_ORG_PERMISSIONS). Notably:
 *   - allow_channel_creation  ↔  members_can_create_channels /
 *                                members_can_create_private_channels
 *   - allow_group_dm          ↔  members_can_create_group_dms
 *   - max_file_size_mb        ↔  max_file_upload_mb
 *
 * Reads of these overlapping fields should go through
 * apps/banter-api/src/services/org-permissions-bridge.ts
 * (getEffectiveBanterPermissions) so there is a single normalized code path.
 * See that file's doc comment for the full mapping and the unification plan.
 */
export const banterSettings = pgTable('banter_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id),
  default_channel_id: uuid('default_channel_id').references(() => banterChannels.id, {
    onDelete: 'set null',
  }),
  allow_channel_creation: varchar('allow_channel_creation', { length: 20 })
    .notNull()
    .default('members'),
  allow_dm: boolean('allow_dm').notNull().default(true),
  allow_group_dm: boolean('allow_group_dm').notNull().default(true),
  allow_guest_access: boolean('allow_guest_access').notNull().default(false),
  message_retention_days: integer('message_retention_days').notNull().default(0),
  max_file_size_mb: integer('max_file_size_mb').notNull().default(25),
  allowed_file_types: text('allowed_file_types').array().notNull().default([]),
  custom_emoji: jsonb('custom_emoji').notNull().default([]),
  enable_link_previews: boolean('enable_link_previews').notNull().default(true),
  enable_bbb_integration: boolean('enable_bbb_integration').notNull().default(true),
  voice_video_enabled: boolean('voice_video_enabled').notNull().default(false),
  livekit_host: varchar('livekit_host', { length: 500 }),
  livekit_api_key: varchar('livekit_api_key', { length: 255 }),
  livekit_api_secret: text('livekit_api_secret'),
  max_call_participants: integer('max_call_participants').notNull().default(50),
  max_call_duration_minutes: integer('max_call_duration_minutes').notNull().default(480),
  allow_recording: boolean('allow_recording').notNull().default(false),
  recording_storage_prefix: varchar('recording_storage_prefix', { length: 255 })
    .notNull()
    .default('banter/recordings/'),
  transcription_enabled: boolean('transcription_enabled').notNull().default(false),
  stt_provider: varchar('stt_provider', { length: 50 }),
  stt_provider_config: jsonb('stt_provider_config').notNull().default({}),
  tts_provider: varchar('tts_provider', { length: 50 }),
  tts_provider_config: jsonb('tts_provider_config').notNull().default({}),
  tts_default_voice: varchar('tts_default_voice', { length: 100 }),
  ai_voice_agent_enabled: boolean('ai_voice_agent_enabled').notNull().default(false),
  ai_voice_agent_llm_provider: varchar('ai_voice_agent_llm_provider', { length: 50 })
    .notNull()
    .default('anthropic'),
  ai_voice_agent_llm_config: jsonb('ai_voice_agent_llm_config').notNull().default({}),
  ai_voice_agent_greeting: varchar('ai_voice_agent_greeting', { length: 500 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
