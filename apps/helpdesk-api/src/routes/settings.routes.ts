import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { organizations } from '../db/schema/bbb-refs.js';
import { env } from '../env.js';

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
 * Require admin auth — accepts BBB session cookie or agent API key.
 */
async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  // Check BBB session cookie
  const sessionCookie = request.cookies?.session;
  if (sessionCookie) {
    try {
      const result = await db.execute(
        sql`SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ${sessionCookie} AND s.expires_at > now() LIMIT 1`
      );
      if (result && (Array.isArray(result) ? result.length > 0 : (result as any).rows?.length > 0)) {
        return; // Authenticated via BBB session
      }
    } catch {
      // Fall through
    }
  }

  // Check agent API key
  const agentKey = env.AGENT_API_KEY;
  const provided =
    (request.headers['x-agent-key'] as string) ??
    request.headers.authorization?.replace('Bearer ', '');

  if (agentKey && provided && provided === agentKey) {
    return;
  }

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
  // GET /helpdesk/settings — return helpdesk config for the org
  fastify.get('/helpdesk/settings', async (request, reply) => {
    const [settings] = await db
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
  fastify.patch('/helpdesk/settings', { preHandler: [requireAdminAuth] }, async (request, reply) => {
    const data = updateSettingsSchema.parse(request.body);

    // Check if settings exist
    const [existing] = await db
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

    // Create new — need an org_id. Use first org.
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);

    if (!org) {
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
        org_id: org.id,
        ...data,
        categories: data.categories ?? [],
        allowed_email_domains: data.allowed_email_domains ?? [],
      })
      .returning();

    return reply.status(201).send({ data: created });
  });
}
