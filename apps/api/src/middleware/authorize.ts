import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projectMemberships } from '../db/schema/project-memberships.js';

export function requireProjectRole(...roles: string[]) {
  return async function checkProjectRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }

    if (request.user.is_superuser) return; // SuperUsers bypass project role checks

    // Extract project ID from route params or request body
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown> | undefined;
    const projectId = params?.id ?? (body?.project_id as string | undefined);

    if (!projectId) {
      return reply.status(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: 'Project ID is required',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Guest users are scoped to specific projects. When a guest accepts an
    // invitation, they are added to project_memberships for their allowed
    // projects. The membership check below therefore naturally enforces
    // guest project access — no special-case logic is needed here.

    const [membership] = await db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.project_id, projectId),
          eq(projectMemberships.user_id, request.user.id),
        ),
      )
      .limit(1);

    if (!membership || !roles.includes(membership.role)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of project roles: ${roles.join(', ')}`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}

export function requireOrgRole(...roles: string[]) {
  return async function checkOrgRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
          request_id: request.id,
        },
      });
    }

    if (request.user.is_superuser) return; // SuperUsers bypass org role checks

    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of org roles: ${roles.join(', ')}`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}
