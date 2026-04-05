import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Submissions from the public notify-me form. When public signup is disabled
 * the beta-gate page points prospects here so they can leave their contact
 * info; SuperUsers review the list and export it to CSV.
 */
export const betaSignupNotifications = pgTable('beta_signup_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  message: text('message'),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BetaSignupNotification = typeof betaSignupNotifications.$inferSelect;
