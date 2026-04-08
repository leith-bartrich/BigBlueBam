import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema/system-settings.js';
import { requireAuth } from '../plugins/auth.js';
import { requireSuperuser } from '../middleware/require-superuser.js';
import { logSuperuserAction } from '../services/superuser-audit.service.js';

// Valid values for the root_redirect setting
const ROOT_REDIRECT_VALUES = [
  'site',
  'b3',
  'banter',
  'beacon',
  'brief',
  'bolt',
  'bearing',
  'helpdesk',
] as const;

type RootRedirectValue = (typeof ROOT_REDIRECT_VALUES)[number];

// Map setting value to URL path
const REDIRECT_MAP: Record<RootRedirectValue, string | null> = {
  site: null, // null means no redirect — serve marketing site
  b3: '/b3/',
  banter: '/banter/',
  beacon: '/beacon/',
  brief: '/brief/',
  bolt: '/bolt/',
  bearing: '/bearing/',
  helpdesk: '/helpdesk/',
};

// Per-key value validators
const KEY_VALIDATORS: Record<string, z.ZodType> = {
  root_redirect: z.enum(ROOT_REDIRECT_VALUES),
};

export default async function systemSettingsRoutes(fastify: FastifyInstance) {
  // ─── GET /system-settings — list all settings (SuperUser only) ────────
  fastify.get(
    '/system-settings',
    { preHandler: [requireAuth, requireSuperuser] },
    async () => {
      const rows = await db.select().from(systemSettings);
      return { data: rows };
    },
  );

  // ─── GET /system-settings/:key — read a single setting (authenticated) ─
  fastify.get<{ Params: { key: string } }>(
    '/system-settings/:key',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { key } = request.params;
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key));

      if (!row) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Setting '${key}' not found`,
            details: [],
            request_id: request.id,
          },
        });
      }

      return { data: row };
    },
  );

  // ─── PUT /system-settings/:key — update a setting (SuperUser only) ─────
  fastify.put<{ Params: { key: string } }>(
    '/system-settings/:key',
    { preHandler: [requireAuth, requireSuperuser] },
    async (request, reply) => {
      const { key } = request.params;

      // Validate the body has a `value` field
      const bodySchema = z.object({ value: z.unknown() });
      const bodyParsed = bodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body must include a "value" field',
            details: bodyParsed.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
            request_id: request.id,
          },
        });
      }

      // If there is a key-specific validator, apply it
      const keyValidator = KEY_VALIDATORS[key];
      if (keyValidator) {
        const result = keyValidator.safeParse(bodyParsed.data.value);
        if (!result.success) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid value for setting '${key}'`,
              details: result.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
              request_id: request.id,
            },
          });
        }
      }

      const userId = request.user!.id;
      const now = new Date();

      // Upsert the setting
      await db
        .insert(systemSettings)
        .values({
          key,
          value: JSON.stringify(bodyParsed.data.value),
          updated_by: userId,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: JSON.stringify(bodyParsed.data.value),
            updated_by: userId,
            updated_at: now,
          },
        });

      await logSuperuserAction({
        superuserId: userId,
        action: 'update_system_setting',
        details: { key, value: bodyParsed.data.value },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? undefined,
      });

      // Return the updated row
      const [updated] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key));

      return { data: updated };
    },
  );

  // ─── GET /root-redirect — unauthenticated, for nginx/site redirect ────
  // Returns { redirect: "/helpdesk/" } or { redirect: null } (serve site).
  fastify.get('/root-redirect', async () => {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'root_redirect'));

    if (!row) {
      // Default: no redirect (serve marketing site)
      return { redirect: null };
    }

    // The value is stored as a JSON string, e.g. "site" or "helpdesk"
    const val = (typeof row.value === 'string' ? row.value : String(row.value)) as RootRedirectValue;
    const redirect = REDIRECT_MAP[val] ?? null;
    return { redirect };
  });
}
