import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Role hierarchy for Bond authorization.
 * SuperUser bypasses all checks (handled inline).
 */
const ROLE_HIERARCHY = ['viewer', 'member', 'admin', 'owner'] as const;

function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as (typeof ROLE_HIERARCHY)[number]);
  return idx >= 0 ? idx : -1;
}

/**
 * Generic guard: ensure user is authenticated and has at least `minRole`
 * within the organization. SuperUsers bypass.
 */
export function requireMinOrgRole(minRole: string) {
  return async function checkMinOrgRole(request: FastifyRequest, reply: FastifyReply) {
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
    if (request.user.is_superuser) return;

    const userLevel = roleLevel(request.user.role);
    const requiredLevel = roleLevel(minRole);
    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires at least ${minRole} role`,
          details: [],
          request_id: request.id,
        },
      });
    }
  };
}

/**
 * Ownership guard for Bond entities.
 * Admin/Owner can access any entity in their org.
 * Member can only access entities they own (owner_id matches).
 * Viewer can only read (handled by route-level role checks).
 */
export function requireOwnershipOrRole(minRole: string) {
  return async function checkOwnershipOrRole(
    request: FastifyRequest,
    reply: FastifyReply,
    ownerId: string | null | undefined,
  ) {
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
    if (request.user.is_superuser) return true;

    // Admin/Owner can access anything in their org
    if (roleLevel(request.user.role) >= roleLevel(minRole)) return true;

    // Member can access their own resources
    if (ownerId && ownerId === request.user.id) return true;

    return false;
  };
}
