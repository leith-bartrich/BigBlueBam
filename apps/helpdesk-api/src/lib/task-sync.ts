/**
 * HB-50: Mirror helpdesk ticket events onto the linked BigBlueBam task as
 * system-authored comments, so that the BBB-side audit trail survives even
 * when the originating ticket is deleted or closed.
 *
 * Why this exists:
 *   - `ticket_messages` CASCADE-delete with their parent ticket.
 *   - BBB-side `comments` live on the `tasks` table and are unaware of
 *     tickets. Previously, closing/deleting a ticket left the linked task
 *     with no record of the customer-facing conversation or closure.
 *
 * Strategy:
 *   - For each syncable event (customer message, customer close), insert a
 *     row into the BBB `comments` table flagged `is_system = true`.
 *   - `comments.author_id` is NOT NULL with a FK to `users`. Helpdesk
 *     customers are NOT BBB users, so we attribute the mirrored comment to
 *     a BBB user belonging to the task's project's org — preferring the
 *     task's reporter, then any owner/admin, then any member. If no BBB
 *     user is resolvable, we skip silently (best-effort — the customer
 *     still sees their message on the ticket side, and closing succeeds).
 *
 * This is intentionally best-effort and never throws. Errors are logged and
 * swallowed so that helpdesk operations remain resilient to BBB schema drift.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

type Logger = { warn: (obj: unknown, msg?: string) => void };

/**
 * Resolve a BBB user id suitable for attributing a system comment on the
 * given task. Returns null if no candidate is available.
 */
async function resolveSystemActorForTask(taskId: string): Promise<string | null> {
  try {
    const rows = (await db.execute(sql`
      WITH target AS (
        SELECT t.id AS task_id, t.reporter_id, p.org_id
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.id = ${taskId}
        LIMIT 1
      )
      SELECT COALESCE(
        (SELECT reporter_id FROM target WHERE reporter_id IS NOT NULL),
        (
          SELECT om.user_id
          FROM organization_memberships om, target
          WHERE om.org_id = target.org_id
          ORDER BY CASE om.role
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            WHEN 'member' THEN 2
            ELSE 3
          END, om.joined_at ASC
          LIMIT 1
        )
      ) AS actor_id
    `)) as unknown;

    const row = Array.isArray(rows)
      ? (rows[0] as { actor_id?: string | null } | undefined)
      : ((rows as { rows?: Array<{ actor_id?: string | null }> }).rows?.[0]);

    return row?.actor_id ?? null;
  } catch {
    return null;
  }
}

async function insertSystemComment(taskId: string, actorId: string, body: string): Promise<void> {
  // Raw SQL to avoid duplicating the full BBB `comments` schema here.
  // Also bumps the task's comment_count and updated_at to mirror BBB's own
  // comment-creation bookkeeping so board cards show the fresh count.
  await db.execute(sql`
    INSERT INTO comments (task_id, author_id, body, body_plain, is_system)
    VALUES (${taskId}, ${actorId}, ${body}, ${body}, true)
  `);
  await db.execute(sql`
    UPDATE tasks
    SET comment_count = comment_count + 1,
        updated_at = NOW()
    WHERE id = ${taskId}
  `);
}

/**
 * Mirror a ticket message (typically from the customer) onto the linked
 * BBB task as a system comment. Best-effort; never throws.
 */
export async function mirrorTicketMessageToTask(
  taskId: string | null | undefined,
  authorName: string,
  body: string,
  logger?: Logger,
): Promise<void> {
  if (!taskId) return;
  try {
    const actorId = await resolveSystemActorForTask(taskId);
    if (!actorId) {
      logger?.warn({ taskId }, 'task-sync: no BBB actor resolvable; skipping ticket message mirror');
      return;
    }
    const prefixed = `**${authorName}** (via helpdesk ticket):\n\n${body}`;
    await insertSystemComment(taskId, actorId, prefixed);
  } catch (err) {
    logger?.warn({ err, taskId }, 'task-sync: failed to mirror ticket message to task');
  }
}

/**
 * Mirror a ticket closure onto the linked BBB task as a system comment.
 * Preserves the audit trail even if the ticket is later deleted.
 */
export async function mirrorTicketClosedToTask(
  taskId: string | null | undefined,
  closedBy: string,
  logger?: Logger,
): Promise<void> {
  if (!taskId) return;
  try {
    const actorId = await resolveSystemActorForTask(taskId);
    if (!actorId) {
      logger?.warn({ taskId }, 'task-sync: no BBB actor resolvable; skipping ticket-closed mirror');
      return;
    }
    await insertSystemComment(
      taskId,
      actorId,
      `Ticket closed by ${closedBy}.`,
    );
  } catch (err) {
    logger?.warn({ err, taskId }, 'task-sync: failed to mirror ticket closure to task');
  }
}
