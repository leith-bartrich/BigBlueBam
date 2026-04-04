import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, updateProfileSchema } from '@bigbluebam/shared';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../plugins/auth.js';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { organizationMemberships } from '../db/schema/organization-memberships.js';
import { organizations } from '../db/schema/organizations.js';

export default async function authRoutes(fastify: FastifyInstance) {
  const cookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.SESSION_TTL_SECONDS,
  };

  fastify.post('/auth/register', async (request, reply) => {
    const data = registerSchema.parse(request.body);
    const result = await authService.register(data);

    reply.setCookie('session', result.session.id, cookieOptions);

    return reply.status(201).send({
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          display_name: result.user.display_name,
          role: result.user.role,
          org_id: result.user.org_id,
          is_superuser: result.user.is_superuser,
          active_org_id: result.user.org_id,
        },
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
        },
      },
    });
  });

  fastify.post('/auth/login', async (request, reply) => {
    const data = loginSchema.parse(request.body);

    try {
      const result = await authService.login(data.email, data.password, data.totp_code);

      reply.setCookie('session', result.session.id, cookieOptions);

      return reply.send({
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            display_name: result.user.display_name,
            role: result.user.role,
            org_id: result.user.org_id,
            is_superuser: result.user.is_superuser,
            active_org_id: result.user.org_id,
          },
        },
      });
    } catch (err) {
      if (err instanceof authService.AuthError) {
        return reply.status(err.statusCode).send({
          error: {
            code: err.code,
            message: err.message,
            details: [],
            request_id: request.id,
          },
        });
      }
      throw err;
    }
  });

  fastify.post('/auth/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    if (request.sessionId) {
      await authService.logout(request.sessionId);
    }

    reply.clearCookie('session', { path: '/' });

    return reply.send({ data: { success: true } });
  });

  fastify.get('/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await authService.getUserById(request.user!.id);
    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
        org_id: user.org_id,
        active_org_id: request.user!.active_org_id,
        is_superuser: user.is_superuser,
        timezone: user.timezone,
        notification_prefs: user.notification_prefs,
        created_at: user.created_at.toISOString(),
      },
    });
  });

  fastify.get('/auth/orgs', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id;

    const memberships = await db
      .select({
        org_id: organizationMemberships.org_id,
        role: organizationMemberships.role,
        is_default: organizationMemberships.is_default,
        joined_at: organizationMemberships.joined_at,
        org_name: organizations.name,
        org_slug: organizations.slug,
        org_logo_url: organizations.logo_url,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.org_id, organizations.id))
      .where(eq(organizationMemberships.user_id, userId));

    return reply.send({
      data: {
        active_org_id: request.user!.active_org_id,
        organizations: memberships.map((m) => ({
          org_id: m.org_id,
          name: m.org_name,
          slug: m.org_slug,
          logo_url: m.org_logo_url,
          role: m.role,
          is_default: m.is_default,
          joined_at: m.joined_at.toISOString(),
        })),
      },
    });
  });

  fastify.post('/auth/switch-org', {
    preHandler: [requireAuth],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.user?.id ?? req.ip,
      },
    },
  }, async (request, reply) => {
    const bodySchema = z.object({ org_id: z.string().uuid() });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            issue: i.message,
          })),
          request_id: request.id,
        },
      });
    }

    const { org_id } = parsed.data;
    const userId = request.user!.id;

    // Verify the user is a member of the requested org
    const [membership] = await db
      .select({
        org_id: organizationMemberships.org_id,
        role: organizationMemberships.role,
        is_default: organizationMemberships.is_default,
        org_name: organizations.name,
        org_slug: organizations.slug,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.org_id, organizations.id))
      .where(
        and(
          eq(organizationMemberships.user_id, userId),
          eq(organizationMemberships.org_id, org_id),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You are not a member of that organization',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Rotate the session: delete the old one and issue a new session ID.
    // This mitigates session fixation risks across org context changes.
    if (request.sessionId) {
      await authService.logout(request.sessionId);
    }
    const newSession = await authService.createSession(userId);
    reply.setCookie('session', newSession.id, cookieOptions);

    return reply.send({
      data: {
        active_org_id: membership.org_id,
        organization: {
          id: membership.org_id,
          name: membership.org_name,
          slug: membership.org_slug,
        },
        role: membership.role,
        is_default: membership.is_default,
        cache_bust: Date.now().toString(),
      },
    });
  });

  fastify.patch('/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const data = updateProfileSchema.parse(request.body);
    const user = await authService.updateProfile(request.user!.id, data);

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: [],
          request_id: request.id,
        },
      });
    }

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        timezone: user.timezone,
        notification_prefs: user.notification_prefs,
      },
    });
  });
}
