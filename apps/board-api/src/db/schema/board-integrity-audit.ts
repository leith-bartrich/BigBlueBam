import {
  pgTable,
  uuid,
  jsonb,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Audit trail for cross-org / orphaned-project integrity remediations on
 * `boards.project_id`. Migration 0143 introduced this table to capture
 * the "before" state when its one-time backfill detached every existing
 * misaligned board (board.org != project.org), and to record subsequent
 * user-driven Detach / Reassign actions taken via the alert UX.
 *
 * The board_id column is intentionally NOT a foreign key with ON DELETE
 * CASCADE: when a board is hard-deleted, we still want the audit row to
 * survive so an operator can later answer "was the board ever in a
 * misaligned state before it was deleted." The migration created the
 * table without an FK; the Drizzle schema mirrors that.
 *
 * Issue codes recorded today:
 *   - PROJECT_ORG_MISMATCH    (initial detection, on auto-detach by
 *                              migration 0143)
 *   - PROJECT_DETACHED         (user explicitly chose Detach after the
 *                              alert UX surfaced an issue)
 *   - PROJECT_REASSIGNED       (user picked a new project from the
 *                              Reassign dialog)
 * Remediation values:
 *   - auto_detached_by_migration_0143 (initial backfill)
 *   - user_detached            (user Detach)
 *   - user_reassigned          (user Reassign)
 */
export const boardIntegrityAudit = pgTable(
  'board_integrity_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    board_id: uuid('board_id').notNull(),
    issue_code: varchar('issue_code', { length: 64 }).notNull(),
    details: jsonb('details').notNull().default({}),
    remediation: varchar('remediation', { length: 64 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('board_integrity_audit_board_idx').on(table.board_id),
    index('board_integrity_audit_created_idx').on(table.created_at),
  ],
);
