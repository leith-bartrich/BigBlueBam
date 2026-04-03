import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, updateProfileSchema } from '@bigbluebam/shared';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../plugins/auth.js';
import { env } from '../env.js';

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
        timezone: user.timezone,
        notification_prefs: user.notification_prefs,
        created_at: user.created_at.toISOString(),
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
