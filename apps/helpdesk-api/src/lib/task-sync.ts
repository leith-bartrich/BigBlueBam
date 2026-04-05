/**
 * HB-50 + HB-7: Mirror helpdesk ticket events onto the linked BBB task.
 *
 * Previously this module wrote directly to BBB `comments` + `tasks`
 * tables via the shared Postgres connection. HB-7 moved those writes
 * behind BBB's /internal/helpdesk/* surface — every mirrored comment
 * now goes through bbb-client and is attributed to the shared
 * HELPDESK_SYSTEM_USER_ID on the BBB side.
 *
 * This is intentionally best-effort and never throws. Errors are logged
 * and swallowed so helpdesk operations remain resilient to BBB outages.
 */
import { bbbClient } from './bbb-client.js';

type Logger = {
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

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
    await bbbClient.postComment(
      {
        task_id: taskId,
        body,
        author_label: authorName,
        is_system: true,
      },
      logger,
    );
  } catch (err) {
    logger?.warn({ err, taskId }, 'task-sync: failed to mirror ticket message to task');
  }
}

/**
 * Mirror a ticket closure onto the linked BBB task as a system comment.
 */
export async function mirrorTicketClosedToTask(
  taskId: string | null | undefined,
  closedBy: string,
  logger?: Logger,
): Promise<void> {
  if (!taskId) return;
  try {
    await bbbClient.postComment(
      {
        task_id: taskId,
        body: `Ticket closed by ${closedBy}.`,
        is_system: true,
      },
      logger,
    );
  } catch (err) {
    logger?.warn({ err, taskId }, 'task-sync: failed to mirror ticket closure to task');
  }
}
