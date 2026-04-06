/**
 * Shared helpdesk-api constants.
 *
 * HELPDESK_SYSTEM_USER_ID mirrors the Bam-side constant of the same name.
 * It is only used by helpdesk-api for traceability / logging — the actual
 * activity_log writes happen inside Bam API. The UUID is seeded by
 * migration 0014_helpdesk_system_user.sql. Keep in sync with
 * apps/api/src/lib/constants.ts.
 */
export const HELPDESK_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
