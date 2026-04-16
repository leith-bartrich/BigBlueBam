/**
 * Public tenant discovery routes (D-010).
 *
 * These endpoints have no auth requirement: they are the pre-login
 * surface the helpdesk SPA hits to render the org picker at `/helpdesk/`
 * and to validate / brand an org-scoped portal at `/helpdesk/<slug>/`.
 *
 * Route layout (after the nginx `/helpdesk/api/` -> `/helpdesk/` rewrite):
 *
 *   GET /helpdesk/public/orgs
 *     -> [{ slug, name, logo_url? }, ...] for every org that has a
 *        helpdesk_settings row.
 *
 *   GET /helpdesk/public/orgs/:slug
 *     -> { org: { slug, name, logo_url? },
 *          settings: { welcome_message, categories,
 *                      require_email_verification, allowed_email_domains },
 *          projects: [{ slug, name }] }
 *        for the named org. 404 when the slug does not resolve or the
 *        org has no helpdesk_settings row.
 */
import type { FastifyInstance } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { organizations, projects } from '../db/schema/bbb-refs.js';

export default async function publicTenantRoutes(fastify: FastifyInstance) {
  // GET /helpdesk/public/orgs
  fastify.get('/helpdesk/public/orgs', async (_request, reply) => {
    const rows = await db
      .select({
        slug: organizations.slug,
        name: organizations.name,
        logo_url: organizations.logo_url,
      })
      .from(helpdeskSettings)
      .innerJoin(organizations, eq(organizations.id, helpdeskSettings.org_id))
      .orderBy(asc(organizations.name));

    return reply.send({ data: rows });
  });

  // GET /helpdesk/public/orgs/:slug
  fastify.get<{ Params: { slug: string } }>(
    '/helpdesk/public/orgs/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      const [org] = await db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          logo_url: organizations.logo_url,
        })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'UNKNOWN_ORG_SLUG',
            message: `No organization found for slug "${slug}"`,
            details: [],
            request_id: request.id,
          },
        });
      }

      const [settings] = await db
        .select({
          welcome_message: helpdeskSettings.welcome_message,
          categories: helpdeskSettings.categories,
          require_email_verification: helpdeskSettings.require_email_verification,
          allowed_email_domains: helpdeskSettings.allowed_email_domains,
        })
        .from(helpdeskSettings)
        .where(eq(helpdeskSettings.org_id, org.id))
        .limit(1);

      if (!settings) {
        // Org exists but helpdesk is not configured for it. Return 404
        // with a discriminating code so the SPA can render a dedicated
        // "helpdesk not enabled for this org" page if the UX team ever
        // wants one; today the org picker filters these out so callers
        // only hit this when someone hand-types a URL.
        return reply.status(404).send({
          error: {
            code: 'HELPDESK_NOT_CONFIGURED',
            message: `Helpdesk is not enabled for "${slug}"`,
            details: [],
            request_id: request.id,
          },
        });
      }

      const projectRows = await db
        .select({ slug: projects.slug, name: projects.name })
        .from(projects)
        .where(and(eq(projects.org_id, org.id), eq(projects.is_archived, false)))
        .orderBy(asc(projects.name));

      return reply.send({
        data: {
          org: {
            slug: org.slug,
            name: org.name,
            logo_url: org.logo_url,
          },
          settings,
          projects: projectRows,
        },
      });
    },
  );
}
