import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireMinOrgRole } from '../middleware/authorize.js';
import * as policyService from '../services/policy.service.js';

const setPolicySchema = z.object({
  scope: z.enum(['System', 'Organization', 'Project']),
  organization_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  min_expiry_days: z.number().int().min(1),
  max_expiry_days: z.number().int().min(1),
  default_expiry_days: z.number().int().min(1),
  grace_period_days: z.number().int().min(1),
});

const resolveQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
});

export default async function policyRoutes(fastify: FastifyInstance) {
  // GET /policies — returns the effective policy for the requester's scope
  fastify.get(
    '/policies',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = resolveQuerySchema.parse(request.query);
      const policy = await policyService.resolveExpiryPolicy(
        query.project_id ?? null,
        request.user!.org_id,
      );
      return reply.send({ data: policy });
    },
  );

  // PUT /policies — set or update a policy (Admin+ only)
  fastify.put(
    '/policies',
    { preHandler: [requireAuth, requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const data = setPolicySchema.parse(request.body);

      // Permission checks per §8
      if (data.scope === 'System' && !request.user!.is_superuser) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Only SuperUsers can set system-level policies',
            details: [],
            request_id: request.id,
          },
        });
      }

      const result = await policyService.setPolicy(
        data.scope,
        data.organization_id ?? request.user!.org_id,
        data.project_id,
        {
          min_expiry_days: data.min_expiry_days,
          max_expiry_days: data.max_expiry_days,
          default_expiry_days: data.default_expiry_days,
          grace_period_days: data.grace_period_days,
        },
        request.user!.id,
      );

      return reply.send({ data: result.policy, warnings: result.warnings });
    },
  );

  // GET /policies/resolve — preview resolved policy for a project
  fastify.get(
    '/policies/resolve',
    { preHandler: [requireAuth, requireMinOrgRole('admin')] },
    async (request, reply) => {
      const query = resolveQuerySchema.parse(request.query);
      const policy = await policyService.resolveExpiryPolicy(
        query.project_id ?? null,
        request.user!.org_id,
      );
      return reply.send({ data: policy });
    },
  );
}
