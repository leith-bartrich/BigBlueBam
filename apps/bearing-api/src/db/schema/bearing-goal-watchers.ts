import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { bearingGoals } from './bearing-goals.js';

export const bearingGoalWatchers = pgTable('bearing_goal_watchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  goal_id: uuid('goal_id').notNull().references(() => bearingGoals.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('bearing_goal_watchers_goal_user').on(table.goal_id, table.user_id),
  index('idx_bearing_goal_watchers_goal').on(table.goal_id),
  index('idx_bearing_goal_watchers_user').on(table.user_id),
]);
