import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

/**
 * Row-level security plugin (Wave 1.A, Platform G1).
 *
 * Runs as a preHandler on every authenticated request. Reads
 * `request.user.active_org_id` and executes
 *   SELECT set_config('app.current_org_id', <uuid>, true)
 * so Postgres RLS policies defined in 0116_rls_foundation.sql see the
 * current org. The third argument `true` is `is_local`, so the setting
 * lives only for the current transaction / session scope.
 *
 * Gating is controlled by env var `BBB_RLS_ENFORCE`:
 *   - When `0` (default), the plugin still sets the GUC but the app
 *     database role has BYPASSRLS so policies are advisory only. This
 *     is the soft-rollout mode.
 *   - When `1`, the boot-time rls-boot hook has flipped the app role
 *     to NOBYPASSRLS, so the policies are enforcing. Any query that
 *     forgets to use `request.withRls` or its equivalent will see
 *     zero rows until it sets the GUC.
 *
 * Unauthenticated routes (login, health, static) do not hit the
 * preHandler because Fastify's preHandler hooks only fire on matched
 * routes that have already passed auth. The plugin is a no-op if
 * `request.user` is undefined.
 */
const rlsPlugin = fp(async (fastify: FastifyInstance) => {
  const enforce = process.env.BBB_RLS_ENFORCE === '1';

  fastify.addHook('preHandler', async (request) => {
    const user = request.user;
    if (!user?.active_org_id) return;

    try {
      await db.execute(sql`SELECT set_config('app.current_org_id', ${user.active_org_id}, true)`);
    } catch (err) {
      // In soft mode we do not want a GUC failure to break the request.
      // In enforce mode we surface it so it is caught in development.
      if (enforce) throw err;
      request.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'rls plugin: set_config failed (soft mode, continuing)',
      );
    }
  });

  fastify.log.info(
    { enforce },
    enforce
      ? 'rls plugin registered (NOBYPASSRLS enforce mode)'
      : 'rls plugin registered (advisory mode, BYPASSRLS)',
  );
});

export default rlsPlugin;
