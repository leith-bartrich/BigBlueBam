/**
 * Shared BBB API constants.
 *
 * HELPDESK_SYSTEM_USER_ID is the fixed UUID of the dedicated BBB user to
 * which every helpdesk-originated write (tasks, comments, activity_log)
 * is attributed. Seeded by migration 0014_helpdesk_system_user.sql.
 * The same constant lives in apps/helpdesk-api/src/lib/constants.ts — if
 * one changes, change both.
 */
export const HELPDESK_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
export const HELPDESK_SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000002';
