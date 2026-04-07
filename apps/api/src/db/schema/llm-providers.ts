import { pgTable, uuid, varchar, integer, numeric, boolean, timestamp, customType } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';
import { projects } from './projects.js';

/**
 * Custom type for PostgreSQL BYTEA columns.
 * Drizzle doesn't expose a built-in bytea helper, so we map it manually.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return Buffer.from(value);
  },
});

/**
 * Hierarchical LLM provider configuration.
 *
 * Scope determines the level:
 *  - 'system':       site-wide, managed by SuperUsers (organization_id & project_id are NULL)
 *  - 'organization': org-level, managed by org admins/owners
 *  - 'project':      project-level override, managed by project admins
 *
 * Resolution order: project -> organization -> system.
 * API keys are encrypted at rest (AES-256-GCM with SESSION_SECRET).
 */
export const llmProviders = pgTable('llm_providers', {
  id: uuid('id').primaryKey().defaultRandom(),

  scope: varchar('scope', { length: 20 }).notNull(),
  organization_id: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  project_id: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 100 }).notNull(),
  provider_type: varchar('provider_type', { length: 30 }).notNull(),
  model_id: varchar('model_id', { length: 200 }).notNull(),

  api_endpoint: varchar('api_endpoint', { length: 2048 }),
  api_key_encrypted: bytea('api_key_encrypted').notNull(),

  max_tokens: integer('max_tokens').default(4096),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
  is_default: boolean('is_default').notNull().default(false),
  enabled: boolean('enabled').notNull().default(true),

  max_requests_per_hour: integer('max_requests_per_hour').default(100),
  max_tokens_per_hour: integer('max_tokens_per_hour').default(500000),

  created_by: uuid('created_by').notNull().references(() => users.id),
  updated_by: uuid('updated_by').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LlmProvider = typeof llmProviders.$inferSelect;
export type NewLlmProvider = typeof llmProviders.$inferInsert;
