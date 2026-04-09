import type { FastifyInstance } from 'fastify';
import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tasks } from '../db/schema/tasks.js';
import { projects } from '../db/schema/projects.js';
import { apiKeys } from '../db/schema/api-keys.js';
import { users } from '../db/schema/users.js';
import { requireAuth } from '../plugins/auth.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import argon2 from 'argon2';

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcalDate(dateStr: string): string {
  // date is in YYYY-MM-DD format, return as VALUE=DATE
  return dateStr.replace(/-/g, '');
}

function generateIcal(
  calendarName: string,
  taskList: Array<{
    id: string;
    human_id: string;
    title: string;
    description: string | null;
    due_date: string;
    priority: string;
  }>,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BigBlueBam//Tasks//EN',
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    'METHOD:PUBLISH',
  ];

  for (const task of taskList) {
    const dueDate = formatIcalDate(task.due_date);
    // Add one day for DTEND (all-day event)
    const d = new Date(task.due_date);
    d.setDate(d.getDate() + 1);
    const endDate = d.toISOString().split('T')[0]!.replace(/-/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@bigbluebam`);
    lines.push(`DTSTART;VALUE=DATE:${dueDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
    lines.push(`SUMMARY:${escapeIcal(`[${task.human_id}] ${task.title}`)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeIcal(task.description)}`);
    }
    // Map priority: iCal uses 1-9 where 1=highest
    const priorityMap: Record<string, number> = {
      critical: 1,
      high: 3,
      medium: 5,
      low: 7,
    };
    lines.push(`PRIORITY:${priorityMap[task.priority] ?? 5}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export default async function icalRoutes(fastify: FastifyInstance) {
  // ── GET /projects/:id/calendar.ics ────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/calendar.ics',
    { preHandler: [requireAuth, requireProjectAccess()] },
    async (request, reply) => {
      const projectId = request.params.id;

      const [project] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      const taskList = await db
        .select({
          id: tasks.id,
          human_id: tasks.human_id,
          title: tasks.title,
          description: tasks.description,
          due_date: tasks.due_date,
          priority: tasks.priority,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, projectId),
            isNotNull(tasks.due_date),
          ),
        );

      const ical = generateIcal(
        `${project.name} - Tasks`,
        taskList.filter((t) => t.due_date != null).map((t) => ({
          ...t,
          due_date: t.due_date!,
        })),
      );

      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="calendar.ics"')
        .send(ical);
    },
  );

  // ── GET /me/calendar.ics?token=API_KEY ────────────────────────────────
  fastify.get<{ Querystring: { token?: string } }>(
    '/me/calendar.ics',
    async (request, reply) => {
      // Authenticate via token query parameter or standard auth
      let userId: string | null = null;

      if (request.user) {
        userId = request.user.id;
      } else if (request.query.token) {
        const token = request.query.token;
        const prefix = token.slice(0, 8);

        const candidates = await db
          .select({
            apiKey: apiKeys,
            user: { id: users.id },
          })
          .from(apiKeys)
          .innerJoin(users, eq(apiKeys.user_id, users.id))
          .where(eq(apiKeys.key_prefix, prefix))
          .limit(10);

        for (const candidate of candidates) {
          if (candidate.apiKey.expires_at && new Date(candidate.apiKey.expires_at) < new Date()) {
            continue;
          }
          try {
            const valid = await argon2.verify(candidate.apiKey.key_hash, token);
            if (valid) {
              userId = candidate.user.id;
              // Update last_used_at
              await db
                .update(apiKeys)
                .set({ last_used_at: new Date() })
                .where(eq(apiKeys.id, candidate.apiKey.id));
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!userId) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Provide a valid token query parameter or session.',
            details: [],
            request_id: request.id,
          },
        });
      }

      const taskList = await db
        .select({
          id: tasks.id,
          human_id: tasks.human_id,
          title: tasks.title,
          description: tasks.description,
          due_date: tasks.due_date,
          priority: tasks.priority,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.assignee_id, userId),
            isNotNull(tasks.due_date),
          ),
        );

      const ical = generateIcal(
        'My Tasks - BigBlueBam',
        taskList.filter((t) => t.due_date != null).map((t) => ({
          ...t,
          due_date: t.due_date!,
        })),
      );

      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="calendar.ics"')
        .send(ical);
    },
  );
}
