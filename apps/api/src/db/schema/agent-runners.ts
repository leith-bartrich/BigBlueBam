import { pgTable, uuid, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Agent runners (AGENTIC_TODO §10, migration 0127). One row per service-account
 * user that has ever heartbeat'd. `last_heartbeat_at` is bumped on every
 * `POST /v1/agents/heartbeat` call; a NULL value means the runner has been
 * registered but has not heartbeat'd since the column was introduced.
 *
 * TODO (Wave 2): derive liveness from `last_heartbeat_at` with a configurable
 * TTL (proposed default 5 minutes) and surface an `is_alive` boolean on list
 * endpoints. Wave 1 stores the timestamp only.
 */
export const agentRunners = pgTable(
  'agent_runners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: text('version'),
    capabilities: jsonb('capabilities').default([]).notNull(),
    last_heartbeat_at: timestamp('last_heartbeat_at', { withTimezone: true }),
    first_seen_at: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('agent_runners_user_id_uniq').on(table.user_id),
    index('idx_agent_runners_org_id').on(table.org_id),
    index('idx_agent_runners_last_heartbeat').on(table.last_heartbeat_at),
  ],
);
