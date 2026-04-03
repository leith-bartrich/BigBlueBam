import { pgTable, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './bbb-refs.js';
import { banterUserGroups } from './user-groups.js';

export const banterUserGroupMemberships = pgTable(
  'banter_user_group_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    group_id: uuid('group_id')
      .notNull()
      .references(() => banterUserGroups.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    added_at: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('banter_user_group_memberships_unique_idx').on(table.group_id, table.user_id),
    index('banter_user_group_memberships_group_idx').on(table.group_id),
    index('banter_user_group_memberships_user_idx').on(table.user_id),
  ],
);
