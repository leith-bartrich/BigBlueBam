import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

export interface SprintCloseJobData {
  sprint_id: string;
  project_id: string;
}

export async function processSprintCloseJob(
  job: Job<SprintCloseJobData>,
  logger: Logger,
): Promise<void> {
  const { sprint_id, project_id } = job.data;

  logger.info({ jobId: job.id, sprint_id, project_id }, 'Processing sprint close job');

  const db = getDb();

  // Calculate velocity: sum of story_points for tasks in a "done" state category
  const velocityResult = await db.execute(sql`
    SELECT COALESCE(SUM(t.story_points), 0)::int AS velocity
    FROM tasks t
    JOIN task_states ts ON ts.id = t.state_id
    WHERE t.sprint_id = ${sprint_id}
      AND t.project_id = ${project_id}
      AND ts.category = 'done'
  `);

  const velocity = Number(velocityResult[0]?.velocity ?? 0);

  // Update the sprint record with the calculated velocity and closed_at timestamp
  await db.execute(sql`
    UPDATE sprints
    SET velocity = ${velocity},
        completed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = ${sprint_id}
  `);

  logger.info(
    { jobId: job.id, sprint_id, project_id, velocity },
    'Sprint closed successfully',
  );
}
