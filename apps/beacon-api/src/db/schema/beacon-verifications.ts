import {
  pgTable,
  pgEnum,
  uuid,
  real,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { beaconEntries } from './beacon-entries.js';

export const verificationTypeEnum = pgEnum('verification_type', [
  'Manual',
  'AgentAutomatic',
  'AgentAssisted',
  'ScheduledReview',
]);

export const verificationOutcomeEnum = pgEnum('verification_outcome', [
  'Confirmed',
  'Updated',
  'Challenged',
  'Retired',
]);

export const beaconVerifications = pgTable(
  'beacon_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beacon_id: uuid('beacon_id')
      .notNull()
      .references(() => beaconEntries.id, { onDelete: 'cascade' }),
    verified_by: uuid('verified_by')
      .notNull()
      .references(() => users.id),
    verification_type: verificationTypeEnum('verification_type').notNull(),
    outcome: verificationOutcomeEnum('outcome').notNull(),
    confidence_score: real('confidence_score'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_beacon_verifications_beacon_id').on(table.beacon_id),
    index('idx_beacon_verifications_verified_by').on(table.verified_by),
  ],
);
