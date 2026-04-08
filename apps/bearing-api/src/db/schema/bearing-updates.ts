import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bearingGoals } from './bearing-goals.js';

export const bearingUpdates = pgTable('bearing_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  goal_id: uuid('goal_id').notNull().references(() => bearingGoals.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull(),
  body: text('body'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bearing_updates_goal').on(table.goal_id),
  index('idx_bearing_updates_author').on(table.author_id),
]);
