/**
 * Tenant resolution middleware (D-010).
 *
 * Reads the X-Org-Slug and optional X-Project-Slug headers sent by the
 * helpdesk SPA, resolves them against organizations.slug and projects.slug
 * (project slug scoped to the org), and attaches a TenantContext to the
 * request. Returns 404 with a specific error code when a slug does not
 * resolve, so the SPA can render a clean "unknown helpdesk" page.
 *
 * The middleware is intentionally lenient: missing headers do NOT error.
 * The attached context's orgId will simply be null. Route handlers that
 * require an org (customer register, login, ticket-create) call
 * `requireTenantOrg(request, reply)` to produce a 400 when the org
 * slug is absent.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations, projects } from '../db/schema/bbb-refs.js';

export interface TenantContext {
  orgId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  projectId: string | null;
  projectSlug: string | null;
  projectName: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext: TenantContext;
  }
}

function emptyContext(): TenantContext {
  return {
    orgId: null,
    orgSlug: null,
    orgName: null,
    projectId: null,
    projectSlug: null,
    projectName: null,
  };
}

async function resolveTenantPlugin(fastify: FastifyInstance) {
  // Fastify v5 rejects `decorateRequest('name', objectLiteral)` because a
  // single literal would be shared across every request. Seed with a
  // primitive (null) and rely on onRequest to install a fresh per-request
  // TenantContext before any handler reads the field. The TypeScript
  // declaration above promises non-null; every handler that reads it
  // runs after onRequest so that promise holds at runtime.
  fastify.decorateRequest('tenantContext', null as unknown as TenantContext);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.tenantContext = emptyContext();
  });

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgSlugHeader = request.headers['x-org-slug'];
    const projectSlugHeader = request.headers['x-project-slug'];

    const orgSlug = Array.isArray(orgSlugHeader)
      ? orgSlugHeader[0]
      : orgSlugHeader;
    const projectSlug = Array.isArray(projectSlugHeader)
      ? projectSlugHeader[0]
      : projectSlugHeader;

    if (!orgSlug) {
      // No header: leave EMPTY_CONTEXT in place.
      return;
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: {
          code: 'UNKNOWN_ORG_SLUG',
          message: `No organization found for slug "${orgSlug}"`,
          details: [{ field: 'X-Org-Slug', issue: 'unknown' }],
          request_id: request.id,
        },
      });
    }

    let projectRow:
      | { id: string; name: string; slug: string }
      | undefined;

    if (projectSlug) {
      const found = await db
        .select({ id: projects.id, name: projects.name, slug: projects.slug })
        .from(projects)
        .where(and(eq(projects.slug, projectSlug), eq(projects.org_id, org.id)))
        .limit(1);
      projectRow = found[0];

      if (!projectRow) {
        return reply.status(404).send({
          error: {
            code: 'UNKNOWN_PROJECT_SLUG',
            message: `No project "${projectSlug}" in organization "${orgSlug}"`,
            details: [{ field: 'X-Project-Slug', issue: 'unknown' }],
            request_id: request.id,
          },
        });
      }
    }

    request.tenantContext = {
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      projectId: projectRow?.id ?? null,
      projectSlug: projectRow?.slug ?? null,
      projectName: projectRow?.name ?? null,
    };
  });
}

export default fp(resolveTenantPlugin, {
  name: 'resolve-tenant',
});

/**
 * Route-level guard that 400s when the request arrived without an org slug.
 * Call at the top of any handler that requires tenant scoping (customer
 * register, login, ticket-create).
 */
export async function requireTenantOrg(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!request.tenantContext.orgId) {
    await reply.status(400).send({
      error: {
        code: 'ORG_SLUG_REQUIRED',
        message:
          'This endpoint requires an X-Org-Slug header. The helpdesk SPA sets this automatically from the URL path.',
        details: [{ field: 'X-Org-Slug', issue: 'missing' }],
        request_id: request.id,
      },
    });
    return false;
  }
  return true;
}
