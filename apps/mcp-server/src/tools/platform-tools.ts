import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

/**
 * SuperUser-gated tools:
 *   - The first group (/superuser/*) is already gated at the API layer —
 *     the server returns 403 to non-SuperUsers. We just pass through.
 *   - The second group wraps PUBLIC endpoints (/public/config,
 *     /public/beta-signup) that don't need auth on the HTTP surface but
 *     that we only want reachable from MCP by SuperUsers, since they
 *     aren't a normal-user feature — they're part of the beta-gate
 *     flow. We check `is_superuser` via /auth/me before proxying.
 */

type SuperuserCheckResult =
  | { ok: true }
  | { ok: false; errorText: string };

async function requireSuperuser(api: ApiClient): Promise<SuperuserCheckResult> {
  const me = await api.get<{ data?: { is_superuser?: boolean } }>('/auth/me');
  if (!me.ok) {
    return { ok: false, errorText: `Error: could not verify caller identity: ${JSON.stringify(me.data)}` };
  }
  const isSuperuser = me.data?.data?.is_superuser === true;
  if (!isSuperuser) {
    return {
      ok: false,
      errorText: 'Error: this tool requires SuperUser privileges. The authenticated user does not have is_superuser set.',
    };
  }
  return { ok: true };
}

export function registerPlatformTools(server: McpServer, api: ApiClient): void {
  // ─── /superuser/* passthroughs (server-side gated) ───────────────────────

  registerTool(server, {
    name: 'get_platform_settings',
    description: 'SuperUser only. Fetch platform-wide settings (public signup toggle, etc).',
    input: {},
    returns: z.object({ public_signup_disabled: z.boolean().optional() }).passthrough(),
    handler: async () => {
      const result = await api.get('/superuser/platform-settings');
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching platform settings: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });

  registerTool(server, {
    name: 'set_public_signup_disabled',
    description: "SuperUser only. Toggle the platform-wide public signup kill switch. When true, POST /auth/register and POST /helpdesk/auth/register return 403 SIGNUP_DISABLED and the login pages' 'Create one' link routes to the beta-gate page.",
    input: {
      public_signup_disabled: z.boolean().describe('true to freeze new-account creation; false to open signup back up.'),
    },
    returns: z.object({ public_signup_disabled: z.boolean() }).passthrough(),
    handler: async ({ public_signup_disabled }) => {
      const result = await api.patch('/superuser/platform-settings', { public_signup_disabled });
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error updating platform settings: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });

  registerTool(server, {
    name: 'list_beta_signups',
    description: 'SuperUser only. List notify-me submissions from the public beta-gate form, newest first.',
    input: {},
    returns: z.object({
      data: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string(),
        created_at: z.string(),
      }).passthrough()),
    }),
    handler: async () => {
      const result = await api.get('/superuser/beta-signups');
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing beta signups: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });

  // ─── Public endpoints, gated to SuperUser only at the MCP layer ──────────

  registerTool(server, {
    name: 'get_public_config',
    description: 'SuperUser only (MCP gate). Read the unauthenticated /public/config — currently returns whether public signup is disabled. The underlying endpoint is public, but we gate MCP access to SuperUsers since this is part of the platform-admin surface.',
    input: {},
    returns: z.object({ public_signup_disabled: z.boolean().optional() }).passthrough(),
    handler: async () => {
      const check = await requireSuperuser(api);
      if (!check.ok) {
        return { content: [{ type: 'text' as const, text: check.errorText }], isError: true };
      }
      const result = await api.get('/public/config');
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching public config: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });

  registerTool(server, {
    name: 'submit_beta_signup',
    description: 'SuperUser only (MCP gate). Create a notify-me submission via the public /public/beta-signup endpoint. The HTTP endpoint is public-by-anyone, but we only allow SuperUsers to invoke it through MCP (typically for testing or manual entry on behalf of a prospect).',
    input: {
      name: z.string().trim().min(1).max(200).describe('Contact name.'),
      email: z.string().trim().email().max(320).describe('Contact email.'),
      phone: z.string().trim().max(40).optional().describe('Phone number (optional).'),
      message: z.string().trim().max(2000).optional().describe('What would they like to use BigBlueBam for (optional).'),
    },
    returns: z.object({ id: z.string().uuid(), email: z.string() }).passthrough(),
    handler: async (body) => {
      const check = await requireSuperuser(api);
      if (!check.ok) {
        return { content: [{ type: 'text' as const, text: check.errorText }], isError: true };
      }
      const result = await api.post('/public/beta-signup', body);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error submitting beta signup: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  });
}
