import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { organizations, projects } from '../db/schema/bbb-refs.js';
import { verifyAgentApiKey } from '../lib/agent-auth.js';

const updateSettingsSchema = z.object({
  require_email_verification: z.boolean().optional(),
  allowed_email_domains: z.array(z.string()).optional(),
  default_project_id: z.string().uuid().nullable().optional(),
  default_phase_id: z.string().uuid().nullable().optional(),
  default_priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  categories: z.array(z.string()).optional(),
  welcome_message: z.string().nullable().optional(),
  auto_close_days: z.number().int().min(0).optional(),
  notify_on_status_change: z.boolean().optional(),
  notify_on_agent_reply: z.boolean().optional(),
});

import { sql } from 'drizzle-orm';

/**
 * Require admin auth — accepts a Bam session cookie OR a per-agent
 * helpdesk API key (HB-28 + HB-49). The legacy shared `AGENT_API_KEY`
 * env var was removed here; agent-side callers must now present an
 * `hdag_*` token via X-Agent-Key, verified against
 * helpdesk_agent_api_keys (Argon2id-hashed, rotatable, per-agent).
 */
async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  // Check Bam session cookie
  const sessionCookie = request.cookies?.session;
  if (sessionCookie) {
    try {
      const result = await db.execute(
        sql`SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ${sessionCookie} AND s.expires_at > now() LIMIT 1`
      );
      if (result && (Array.isArray(result) ? result.length > 0 : (result as any).rows?.length > 0)) {
        return; // Authenticated via Bam session
      }
    } catch {
      // Fall through
    }
  }

  // Fall back to per-agent X-Agent-Key
  const token = request.headers['x-agent-key'] as string | undefined;
  const agentUserId = await verifyAgentApiKey(request, token);
  if (agentUserId) return;

  return reply.status(401).send({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      details: [],
      request_id: request.id,
    },
  });
}

export default async function settingsRoutes(fastify: FastifyInstance) {
  // GET /helpdesk/public-settings — public, safe-to-expose fields only
  // Used by the registration form and landing page; no auth required.
  fastify.get('/helpdesk/public-settings', async (_request, reply) => {
    const [settings] = await db
      .select()
      .from(helpdeskSettings)
      .limit(1);

    if (!settings) {
      return reply.send({
        data: {
          require_email_verification: false,
          categories: [],
          welcome_message: null,
        },
      });
    }

    return reply.send({
      data: {
        require_email_verification: settings.require_email_verification,
        categories: settings.categories,
        welcome_message: settings.welcome_message,
      },
    });
  });

  // GET /helpdesk/settings — full config (requires admin auth)
  // Exposes internal fields like default_project_id and allowed_email_domains
  // that must not leak to unauthenticated callers (HB-13).
  // D-010: when X-Org-Slug resolves to an orgId, scope to that org's
  // settings row; fall back to LIMIT 1 only when the header is absent
  // so legacy admin tools continue working.
  fastify.get('/helpdesk/settings', { preHandler: [requireAdminAuth] }, async (request, reply) => {
    const orgId = request.tenantContext.orgId;
    const [settings] = orgId
      ? await db
          .select()
          .from(helpdeskSettings)
          .where(eq(helpdeskSettings.org_id, orgId))
          .limit(1)
      : await db
          .select()
          .from(helpdeskSettings)
          .limit(1);

    if (!settings) {
      // Return defaults if no settings exist
      return reply.send({
        data: {
          require_email_verification: false,
          allowed_email_domains: [],
          default_project_id: null,
          default_phase_id: null,
          default_priority: 'medium',
          categories: [],
          welcome_message: null,
          auto_close_days: 0,
          notify_on_status_change: true,
          notify_on_agent_reply: true,
        },
      });
    }

    return reply.send({ data: settings });
  });

  // PATCH /helpdesk/settings — update config (requires admin auth)
  // D-010: when X-Org-Slug resolves to an orgId, scope the update to
  // that org; fall back to LIMIT 1 only for header-less legacy callers.
  fastify.patch('/helpdesk/settings', { preHandler: [requireAdminAuth] }, async (request, reply) => {
    const data = updateSettingsSchema.parse(request.body);

    const orgId = request.tenantContext.orgId;
    // Check if settings exist (org-scoped when we have the header).
    const [existing] = orgId
      ? await db
          .select()
          .from(helpdeskSettings)
          .where(eq(helpdeskSettings.org_id, orgId))
          .limit(1)
      : await db
          .select()
          .from(helpdeskSettings)
          .limit(1);

    if (existing) {
      // Update existing
      const updates: Record<string, unknown> = {};
      if (data.require_email_verification !== undefined) updates.require_email_verification = data.require_email_verification;
      if (data.allowed_email_domains !== undefined) updates.allowed_email_domains = data.allowed_email_domains;
      if (data.default_project_id !== undefined) updates.default_project_id = data.default_project_id;
      if (data.default_phase_id !== undefined) updates.default_phase_id = data.default_phase_id;
      if (data.default_priority !== undefined) updates.default_priority = data.default_priority;
      if (data.categories !== undefined) updates.categories = data.categories;
      if (data.welcome_message !== undefined) updates.welcome_message = data.welcome_message;
      if (data.auto_close_days !== undefined) updates.auto_close_days = data.auto_close_days;
      if (data.notify_on_status_change !== undefined) updates.notify_on_status_change = data.notify_on_status_change;
      if (data.notify_on_agent_reply !== undefined) updates.notify_on_agent_reply = data.notify_on_agent_reply;

      if (Object.keys(updates).length === 0) {
        return reply.send({ data: existing });
      }

      const [updated] = await db
        .update(helpdeskSettings)
        .set(updates)
        .where(eq(helpdeskSettings.id, existing.id))
        .returning();

      return reply.send({ data: updated });
    }

    // Create new. D-010: prefer the orgId from the tenant header so a
    // fresh org's first settings PATCH does not accidentally land on
    // whatever `SELECT organizations LIMIT 1` happens to return. Falls
    // back to the legacy "first org" behavior only when the header is
    // absent.
    let createOrgId: string | null = orgId;
    if (!createOrgId) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .limit(1);
      createOrgId = org?.id ?? null;
    }

    if (!createOrgId) {
      return reply.status(400).send({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No organization found. Create an organization first.',
          details: [],
          request_id: request.id,
        },
      });
    }

    const [created] = await db
      .insert(helpdeskSettings)
      .values({
        org_id: createOrgId,
        ...data,
        categories: data.categories ?? [],
        allowed_email_domains: data.allowed_email_domains ?? [],
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // GET /helpdesk/admin/projects: list the tenant org's projects with
  // their uuids, for admin surfaces that need to populate a "default
  // project" picker. Requires admin auth AND X-Org-Slug to pin the org.
  // D-010: without X-Org-Slug we fall back to the PATCH /helpdesk/settings
  // pattern of using the first org; that keeps legacy admin tools working
  // but the SPA-integrated picker should always send the header.
  fastify.get(
    '/helpdesk/admin/projects',
    { preHandler: [requireAdminAuth] },
    async (request, reply) => {
      let orgId: string | null = request.tenantContext.orgId;
      if (!orgId) {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .limit(1);
        orgId = org?.id ?? null;
      }
      if (!orgId) {
        return reply.status(400).send({
          error: {
            code: 'NO_ORGANIZATION',
            message: 'No organization context available.',
            details: [],
            request_id: request.id,
          },
        });
      }

      const rows = await db
        .select({ id: projects.id, slug: projects.slug, name: projects.name })
        .from(projects)
        .where(and(eq(projects.org_id, orgId), eq(projects.is_archived, false)))
        .orderBy(asc(projects.name));

      return reply.send({ data: rows });
    },
  );
}
