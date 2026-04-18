import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import type { RateLimiter } from '../middleware/rate-limiter.js';
import crypto from 'node:crypto';
import { registerTool } from '../lib/register-tool.js';

const TOOL_NAMES = [
  'list_projects',
  'get_project',
  'create_project',
  'bam_list_phases',
  'bam_list_labels',
  'bam_list_states',
  'bam_list_epics',
  'search_tasks',
  'get_task',
  'create_task',
  'update_task',
  'move_task',
  'delete_task',
  'bulk_update_tasks',
  'log_time',
  'duplicate_task',
  'import_csv',
  'list_sprints',
  'create_sprint',
  'start_sprint',
  'complete_sprint',
  'get_sprint_report',
  'list_comments',
  'add_comment',
  'list_members',
  'get_my_tasks',
  'get_velocity_report',
  'get_burndown',
  'get_cumulative_flow',
  'get_overdue_tasks',
  'get_workload',
  'get_status_distribution',
  'list_templates',
  'create_from_template',
  'import_github_issues',
  'suggest_branch_name',
  'get_server_info',
  'confirm_action',
  'get_me',
  'update_me',
  'list_my_orgs',
  'switch_active_org',
  'change_my_password',
  'logout',
  'list_my_notifications',
  'mark_notification_read',
  'mark_notifications_read',
  'mark_all_notifications_read',
  'get_platform_settings',
  'set_public_signup_disabled',
  'list_beta_signups',
  'get_public_config',
  'submit_beta_signup',
  'get_cycle_time_report',
  'get_time_tracking_report',
  // beacon
  'beacon_create',
  'beacon_list',
  'beacon_get',
  'beacon_update',
  'beacon_retire',
  'beacon_publish',
  'beacon_verify',
  'beacon_challenge',
  'beacon_restore',
  'beacon_versions',
  'beacon_version_get',
  'beacon_search',
  'beacon_suggest',
  'beacon_search_context',
  'beacon_policy_get',
  'beacon_policy_set',
  'beacon_policy_resolve',
  'beacon_tags_list',
  'beacon_tag_add',
  'beacon_tag_remove',
  'beacon_link_create',
  'beacon_link_remove',
  'beacon_query_save',
  'beacon_query_list',
  'beacon_query_get',
  'beacon_query_delete',
  'beacon_graph_neighbors',
  'beacon_graph_hubs',
  'beacon_graph_recent',
  // visibility preflight (AGENTIC_TODO §11, Wave 2)
  'can_access',
  // durable proposals (AGENTIC_TODO §9, Wave 2)
  'proposal_create',
  'proposal_list',
  'proposal_decide',
] as const;

// Pending confirmation tokens: token -> { action, resource_id, expires }
const pendingTokens = new Map<string, { action: string; resource_id: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingTokens) {
    if (entry.expires <= now) {
      pendingTokens.delete(token);
    }
  }
}, 30_000);

export function registerUtilityTools(server: McpServer, api: ApiClient, rateLimiter: RateLimiter): void {
  registerTool(server, {
    name: 'get_server_info',
    description: 'Get information about this MCP server including version, available tools, authenticated user, and rate limit status',
    input: {},
    returns: z.object({
      name: z.string(),
      version: z.string(),
      description: z.string(),
      tool_count: z.number(),
      available_tools: z.array(z.string()),
      authenticated_user: z.unknown().nullable(),
      rate_limit: z.unknown().optional(),
    }),
    handler: async () => {
      // Fetch authenticated user info
      const meResult = await api.get('/auth/me');

      const info = {
        name: 'BigBlueBam',
        version: '1.0.0',
        description: 'BigBlueBam Project Management MCP Server',
        available_tools: TOOL_NAMES,
        tool_count: TOOL_NAMES.length,
        authenticated_user: meResult.ok ? meResult.data : null,
        rate_limit: rateLimiter.getStatus(),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'confirm_action',
    description: 'Confirm a destructive action using a confirmation token. First call without a token to stage the action and receive a token. Then call again with the token to execute.',
    input: {
      action: z.string().describe('Description of the action to confirm'),
      resource_id: z.string().describe('ID of the resource being affected'),
      token: z.string().optional().describe('Confirmation token received from the staging call. Omit to stage a new action.'),
    },
    returns: z.object({
      status: z.enum(['pending_confirmation', 'confirmed']),
      message: z.string(),
      action: z.string(),
      resource_id: z.string(),
      confirmation_token: z.string().optional().describe('Present when status is pending_confirmation'),
    }),
    handler: async ({ action, resource_id, token }) => {
      if (!token) {
        // Stage the action: generate a token
        const confirmToken = crypto.randomBytes(16).toString('hex');
        pendingTokens.set(confirmToken, {
          action,
          resource_id,
          expires: Date.now() + 60_000, // 60-second expiry
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'pending_confirmation',
              message: `Action requires confirmation. Token expires in 60 seconds.`,
              action,
              resource_id,
              confirmation_token: confirmToken,
              instruction: 'Call confirm_action again with this token to proceed.',
            }, null, 2),
          }],
        };
      }

      // Validate the token
      const pending = pendingTokens.get(token);

      if (!pending) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid or expired confirmation token. Please stage the action again.',
          }],
          isError: true,
        };
      }

      if (pending.expires <= Date.now()) {
        pendingTokens.delete(token);
        return {
          content: [{
            type: 'text' as const,
            text: 'Confirmation token has expired. Please stage the action again.',
          }],
          isError: true,
        };
      }

      if (pending.action !== action || pending.resource_id !== resource_id) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Token does not match the provided action and resource_id. Please stage the action again.',
          }],
          isError: true,
        };
      }

      // Token is valid - consume it (single use)
      pendingTokens.delete(token);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'confirmed',
            message: `Action confirmed: ${action} on resource ${resource_id}. Proceeding.`,
            action,
            resource_id,
          }, null, 2),
        }],
      };
    },
  });
}
