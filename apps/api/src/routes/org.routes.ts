import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as orgService from '../services/org.service.js';
import { requireAuth } from '../plugins/auth.js';
import { requireOrgRole } from '../middleware/authorize.js';

export default async function orgRoutes(fastify: FastifyInstance) {
  fastify.get('/org', { preHandler: [requireAuth] }, async (request, reply) => {
    const org = await orgService.getOrganization(request.user!.org_id);
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

    return reply.send({ data: org });
  });

  fastify.patch(
    '/org',
    { preHandler: [requireAuth, requireOrgRole('admin', 'owner')] },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().max(255).optional(),
        logo_url: z.string().url().nullable().optional(),
        settings: z.record(z.unknown()).optional(),
      });
      const data = schema.parse(request.body);

      const org = await orgService.updateOrganization(request.user!.org_id, data);
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

      return reply.send({ data: org });
    },
  );

  fastify.get(
    '/org/members',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const members = await orgService.listOrgMembers(request.user!.org_id);
      return reply.send({ data: members });
    },
  );

  fastify.post(
    '/org/members/invite',
    { preHandler: [requireAuth, requireOrgRole('admin', 'owner')] },
    async (request, reply) => {
      const schema = z.object({
        email: z.string().email().max(320),
        role: z.enum(['member', 'admin']).default('member'),
        display_name: z.string().max(100).optional(),
        project_ids: z.array(z.string().uuid()).optional(),
      });
      const data = schema.parse(request.body);

      try {
        const user = await orgService.inviteMember(
          request.user!.org_id,
          data.email,
          data.role,
          data.display_name,
        );
        return reply.status(201).send({ data: user });
      } catch (err: any) {
        if (err?.code === '23505') {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: 'A user with this email already exists',
              details: [],
              request_id: request.id,
            },
          });
        }
        throw err;
      }
    },
  );

  fastify.patch<{ Params: { userId: string } }>(
    '/org/members/:userId',
    { preHandler: [requireAuth, requireOrgRole('admin', 'owner')] },
    async (request, reply) => {
      const schema = z.object({
        role: z.enum(['member', 'admin', 'viewer']),
      });
      const data = schema.parse(request.body);

      const user = await orgService.updateMemberRole(
        request.user!.org_id,
        request.params.userId,
        data.role,
      );

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Member not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: user });
    },
  );

  fastify.delete<{ Params: { userId: string } }>(
    '/org/members/:userId',
    { preHandler: [requireAuth, requireOrgRole('admin', 'owner')] },
    async (request, reply) => {
      if (request.params.userId === request.user!.id) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'You cannot remove yourself from the organization',
            details: [],
            request_id: request.id,
          },
        });
      }

      const deleted = await orgService.removeMember(
        request.user!.org_id,
        request.params.userId,
      );

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Member not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: { success: true } });
    },
  );
}
