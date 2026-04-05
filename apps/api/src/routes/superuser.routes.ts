import type { FastifyInstance } from 'fastify';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  superuserListOrgsQuerySchema,
  superuserSwitchContextSchema,
} from '@bigbluebam/shared';
import { db } from '../db/index.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { projects } from '../db/schema/projects.js';
import { tasks } from '../db/schema/tasks.js';
import { tickets } from '../db/schema/tickets.js';
import { sessions } from '../db/schema/sessions.js';
import { activityLog } from '../db/schema/activity-log.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';
import { requireAuth } from '../plugins/auth.js';
import { requireSuperuser } from '../middleware/require-superuser.js';
import { logSuperuserAction } from '../services/superuser-audit.service.js';
import { setActiveOrgId, clearActiveOrgId } from '../services/session.service.js';

// ─── Cursor helpers (base64 JSON {created_at, id}) ──────────────────────────

interface OrgCursor {
  created_at: string;
  id: string;
}

function encodeCursor(c: OrgCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): OrgCursor | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<OrgCursor>;
    if (
      typeof parsed.created_at === 'string' &&
      typeof parsed.id === 'string' &&
      parsed.id.length === 36
    ) {
      return { created_at: parsed.created_at, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function superuserRoutes(fastify: FastifyInstance) {
  // ─── GET /superuser/organizations ─────────────────────────────────────────
  fastify.get<{
    Querystring: { cursor?: string; limit?: string; search?: string };
  }>(
    '/organizations',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      const parsed = superuserListOrgsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
            request_id: request.id,
          },
        });
      }

      const limit = parsed.data.limit ?? 50;
      const search = parsed.data.search?.trim();

      const conditions = [] as ReturnType<typeof eq>[];
      if (search) {
        conditions.push(
          // Match either name or slug
          (or(
            ilike(organizations.name, `%${search}%`),
            ilike(organizations.slug, `%${search}%`),
          ) as unknown) as ReturnType<typeof eq>,
        );
      }

      if (parsed.data.cursor) {
        const c = decodeCursor(parsed.data.cursor);
        if (c) {
          // (created_at, id) DESC pagination: take rows strictly "after" the
          // cursor in DESC order. Use a single raw comparison so both columns
          // are qualified with the table name — Drizzle otherwise emits bare
          // "id" which collides with subquery-correlated references below.
          conditions.push(
            (sql`("organizations"."created_at", "organizations"."id") < (${c.created_at}::timestamptz, ${c.id}::uuid)` as unknown) as ReturnType<typeof eq>,
          );
        }
      }

      // Correlated subqueries use explicit quoted identifiers rather than
      // Drizzle `${table}` expansions — the expansions can emit bare column
      // names in subquery contexts that collide with the outer table's own
      // "id"/"org_id" columns, producing "column reference is ambiguous".
      const memberCountSq = sql<number>`(
        SELECT count(*)::int FROM "organization_memberships" om
        WHERE om."org_id" = "organizations"."id"
      )`;
      const projectCountSq = sql<number>`(
        SELECT count(*)::int FROM "projects" p
        WHERE p."org_id" = "organizations"."id"
      )`;
      const taskCountSq = sql<number>`(
        SELECT count(*)::int FROM "tasks" t
        INNER JOIN "projects" p ON t."project_id" = p."id"
        WHERE p."org_id" = "organizations"."id"
      )`;
      const lastActivitySq = sql<string | null>`(
        SELECT max(al."created_at")::text FROM "activity_log" al
        INNER JOIN "projects" p ON al."project_id" = p."id"
        WHERE p."org_id" = "organizations"."id"
      )`;

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          created_at: organizations.created_at,
          member_count: memberCountSq,
          project_count: projectCountSq,
          task_count: taskCountSq,
          last_activity_at: lastActivitySq,
        })
        .from(organizations)
        .where(whereClause)
        .orderBy(desc(organizations.created_at), desc(organizations.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;

      const nextCursor =
        hasMore && data.length > 0
          ? encodeCursor({
              created_at: data[data.length - 1]!.created_at.toISOString(),
              id: data[data.length - 1]!.id,
            })
          : null;

      await logSuperuserAction({
        superuserId: request.user!.id,
        action: 'org.list',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
        details: { search: search ?? null, limit, returned: data.length },
      });

      return reply.send({
        data: data.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          type: null,
          parent_org_id: null,
          created_at: r.created_at.toISOString(),
          member_count: r.member_count ?? 0,
          project_count: r.project_count ?? 0,
          task_count: r.task_count ?? 0,
          last_activity_at: r.last_activity_at ?? null,
        })),
        next_cursor: nextCursor,
      });
    },
  );

  // ─── GET /superuser/organizations/:id ────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/organizations/:id',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      const { id } = request.params;

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Owners: users whose organization_memberships.role = 'owner' for this org.
      const owners = await db
        .select({
          id: users.id,
          email: users.email,
          display_name: users.display_name,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(organizationMemberships.user_id, users.id))
        .where(
          and(
            eq(organizationMemberships.org_id, id),
            eq(organizationMemberships.role, 'owner'),
          ),
        );

      // Project list with per-project task counts.
      const projectRows = await db
        .select({
          id: projects.id,
          name: projects.name,
          task_count: sql<number>`(
            SELECT count(*)::int FROM ${tasks}
            WHERE ${tasks.project_id} = ${projects.id}
          )`,
        })
        .from(projects)
        .where(eq(projects.org_id, id))
        .orderBy(projects.name);

      // Member counts grouped by role.
      const roleRows = await db
        .select({
          role: organizationMemberships.role,
          count: sql<number>`count(*)::int`,
        })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.org_id, id))
        .groupBy(organizationMemberships.role);

      const memberCountsByRole: Record<string, number> = {};
      for (const r of roleRows) {
        memberCountsByRole[r.role] = r.count ?? 0;
      }

      // Recent activity tail (last 20 across all projects in this org).
      const recentActivity = await db
        .select({
          id: activityLog.id,
          project_id: activityLog.project_id,
          actor_id: activityLog.actor_id,
          action: activityLog.action,
          created_at: activityLog.created_at,
        })
        .from(activityLog)
        .innerJoin(projects, eq(activityLog.project_id, projects.id))
        .where(eq(projects.org_id, id))
        .orderBy(desc(activityLog.created_at))
        .limit(20);

      await logSuperuserAction({
        superuserId: request.user!.id,
        action: 'org.view',
        targetType: 'org',
        targetId: id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      });

      return reply.send({
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: null,
        parent_org_id: null,
        plan: org.plan,
        logo_url: org.logo_url,
        settings: org.settings,
        created_at: org.created_at.toISOString(),
        updated_at: org.updated_at.toISOString(),
        owners,
        projects: projectRows.map((p) => ({
          id: p.id,
          name: p.name,
          task_count: p.task_count ?? 0,
        })),
        member_counts_by_role: memberCountsByRole,
        recent_activity: recentActivity.map((a) => ({
          id: a.id,
          project_id: a.project_id,
          actor_id: a.actor_id,
          action: a.action,
          created_at: a.created_at.toISOString(),
        })),
      });
    },
  );

  // ─── GET /superuser/overview ─────────────────────────────────────────────
  fastify.get(
    '/overview',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      const now = new Date();
      // postgres-js cannot bind raw Date instances as parameters inside Drizzle
      // sql templates — pass ISO strings and cast to timestamptz server-side.
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        orgsCountRow,
        usersCountRow,
        activeSessionsRow,
        projectsCountRow,
        tasksCountRow,
        ticketsCountRow,
        banterChannelsRow,
        newUsers7Row,
        newUsers30Row,
        newOrgs7Row,
        newOrgs30Row,
      ] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(organizations),
        db.select({ c: sql<number>`count(*)::int` }).from(users),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(sessions)
          .where(sql`${sessions.expires_at} > now()`),
        db.select({ c: sql<number>`count(*)::int` }).from(projects),
        db.select({ c: sql<number>`count(*)::int` }).from(tasks),
        db.select({ c: sql<number>`count(*)::int` }).from(tickets),
        db.execute<{ c: number }>(
          sql`SELECT count(*)::int AS c FROM banter_channels`,
        ),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(users)
          .where(sql`${users.created_at} >= ${d7}::timestamptz`),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(users)
          .where(sql`${users.created_at} >= ${d30}::timestamptz`),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(organizations)
          .where(sql`${organizations.created_at} >= ${d7}::timestamptz`),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(organizations)
          .where(sql`${organizations.created_at} >= ${d30}::timestamptz`),
      ]);

      // db.execute returns a postgres-js result; banter_channels count is
      // extracted defensively because we don't have a Drizzle schema binding.
      let totalBanterChannels = 0;
      const banterRows = banterChannelsRow as unknown as Array<{ c: number }>;
      if (Array.isArray(banterRows) && banterRows.length > 0 && banterRows[0]) {
        totalBanterChannels = Number(banterRows[0].c) || 0;
      }

      await logSuperuserAction({
        superuserId: request.user!.id,
        action: 'overview.view',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      });

      return reply.send({
        total_orgs: orgsCountRow[0]?.c ?? 0,
        total_users: usersCountRow[0]?.c ?? 0,
        total_active_sessions: activeSessionsRow[0]?.c ?? 0,
        total_projects: projectsCountRow[0]?.c ?? 0,
        total_tasks: tasksCountRow[0]?.c ?? 0,
        total_tickets: ticketsCountRow[0]?.c ?? 0,
        total_banter_channels: totalBanterChannels,
        new_users_7d: newUsers7Row[0]?.c ?? 0,
        new_users_30d: newUsers30Row[0]?.c ?? 0,
        new_orgs_7d: newOrgs7Row[0]?.c ?? 0,
        new_orgs_30d: newOrgs30Row[0]?.c ?? 0,
      });
    },
  );

  // ─── POST /superuser/context/switch ──────────────────────────────────────
  fastify.post<{ Body: { org_id: string } }>(
    '/context/switch',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      const parsed = superuserSwitchContextSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid body',
            details: parsed.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
            request_id: request.id,
          },
        });
      }

      const { org_id } = parsed.data;

      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, org_id))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      await setActiveOrgId(request.sessionId!, org_id);

      await logSuperuserAction({
        superuserId: request.user!.id,
        action: 'context.switch',
        targetType: 'org',
        targetId: org_id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      });

      return reply.send({ active_org_id: org_id });
    },
  );

  // ─── POST /superuser/context/clear ───────────────────────────────────────
  fastify.post(
    '/context/clear',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      await clearActiveOrgId(request.sessionId!);

      await logSuperuserAction({
        superuserId: request.user!.id,
        action: 'context.clear',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      });

      return reply.send({ ok: true });
    },
  );
}
