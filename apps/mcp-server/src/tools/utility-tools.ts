import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import type { RateLimiter } from '../middleware/rate-limiter.js';
import crypto from 'node:crypto';

const TOOL_NAMES = [
  'list_projects',
  'get_project',
  'create_project',
  'get_board',
  'list_phases',
  'create_phase',
  'reorder_phases',
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
  server.tool(
    'get_server_info',
    'Get information about this MCP server including version, available tools, authenticated user, and rate limit status',
    {},
    async () => {
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
  );

  server.tool(
    'confirm_action',
    'Confirm a destructive action using a confirmation token. First call without a token to stage the action and receive a token. Then call again with the token to execute.',
    {
      action: z.string().describe('Description of the action to confirm'),
      resource_id: z.string().describe('ID of the resource being affected'),
      token: z.string().optional().describe('Confirmation token received from the staging call. Omit to stage a new action.'),
    },
    async ({ action, resource_id, token }) => {
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
  );
}
