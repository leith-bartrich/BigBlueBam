/**
 * Canonical Drizzle pgTable declarations for BigBlueBam core tables.
 *
 * These stubs exist so every non-Bam service (bolt-api, bond-api,
 * helpdesk-api, beacon-api, blast-api, ...) can reference core entities
 * (users, organizations, projects, tasks, ...) without duplicating the
 * declarations locally in each app. Each app previously had its own
 * `src/db/schema/bbb-refs.ts` copy that drifted over time.
 *
 * Contract: these tables expose the minimum columns any dependent service
 * actually reads. They MUST stay a subset of the Bam canonical schemas
 * in `apps/api/src/db/schema/`. If a dependent service needs a column not
 * listed here, add it here first (as nullable if the Bam schema allows
 * null, required otherwise), then ship the Bam schema change in the
 * same commit.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
  settings: jsonb('settings'),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  display_name: varchar('display_name', { length: 255 }).notNull(),
  avatar_url: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull(),
  is_superuser: boolean('is_superuser').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

export const organizationMemberships = pgTable('organization_memberships', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id').notNull(),
  org_id: uuid('org_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  project_id: uuid('project_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  state_id: uuid('state_id'),
  phase_id: uuid('phase_id'),
  sprint_id: uuid('sprint_id'),
  assignee_id: uuid('assignee_id'),
  priority: varchar('priority', { length: 20 }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
});

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  project_id: uuid('project_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  starts_at: timestamp('starts_at', { withTimezone: true }),
  ends_at: timestamp('ends_at', { withTimezone: true }),
});

export const phases = pgTable('phases', {
  id: uuid('id').primaryKey(),
  project_id: uuid('project_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  position: varchar('position', { length: 32 }).notNull(),
});

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey(),
  org_id: uuid('org_id').notNull(),
  actor_id: uuid('actor_id'),
  entity_type: varchar('entity_type', { length: 100 }).notNull(),
  entity_id: uuid('entity_id'),
  action: varchar('action', { length: 100 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id').notNull(),
  org_id: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  key_prefix: varchar('key_prefix', { length: 12 }).notNull(),
  scope: varchar('scope', { length: 50 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  user_id: uuid('user_id').notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
});
