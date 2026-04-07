import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users, organizations } from './bbb-refs.js';

export interface BeaconAgentConfig {
  auto_confirm_threshold?: number;
  assisted_threshold?: number;
  max_daily_verifications?: number;
  auto_publish_authored_beacons?: boolean;
}

export const beaconAgents = pgTable(
  'beacon_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 256 }).notNull(),
    model_identifier: varchar('model_identifier', { length: 256 }),
    organization_id: uuid('organization_id').references(() => organizations.id),
    agent_config: jsonb('agent_config').$type<BeaconAgentConfig>().default({}).notNull(),
    is_active: boolean('is_active').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_beacon_agents_user_id').on(table.user_id),
    index('idx_beacon_agents_org_id').on(table.organization_id),
  ],
);
