import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './bbb-refs.js';

export const banterChannelGroups = pgTable('banter_channel_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  position: integer('position').notNull().default(0),
  is_collapsed_default: boolean('is_collapsed_default').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
