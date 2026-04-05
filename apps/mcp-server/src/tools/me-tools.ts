import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

/**
 * Tools wrapping /auth/me, /auth/orgs, /auth/switch-org, /auth/logout,
 * /auth/change-password and the /me/notifications feed. These map to the
 * "what can *I* do about *me*" surface — profile, org membership, session,
 * notification inbox.
 */
export function registerMeTools(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_me',
    'Get the authenticated user profile (display name, email, avatar, timezone, notification preferences, active org, superuser flag).',
    {},
    async () => {
      const result = await api.get('/auth/me');
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching profile: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'update_me',
    "Update the authenticated user's own profile fields.",
    {
      display_name: z.string().min(1).max(200).optional().describe('Display name shown across BBB.'),
      avatar_url: z.string().url().nullable().optional().describe('Avatar URL, or null to clear.'),
      timezone: z.string().optional().describe('IANA timezone (e.g. America/New_York).'),
      notification_prefs: z.record(z.unknown()).optional().describe('JSON object of notification preferences.'),
    },
    async (body) => {
      const result = await api.patch('/auth/me', body);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error updating profile: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'list_my_orgs',
    'List organizations the authenticated user is a member of, including role in each.',
    {},
    async () => {
      const result = await api.get('/auth/orgs');
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error listing orgs: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'switch_active_org',
    'Switch the active organization for the current session. Affects which projects/members/tickets are returned by downstream calls.',
    {
      org_id: z.string().uuid().describe('Target organization ID — must be one of the caller\'s memberships.'),
    },
    async ({ org_id }) => {
      const result = await api.post('/auth/switch-org', { org_id });
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error switching org: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'change_my_password',
    "Change the authenticated user's password. Requires the current password.",
    {
      current_password: z.string().min(1).describe('Current password.'),
      new_password: z.string().min(12).describe('New password (min 12 chars).'),
    },
    async (body) => {
      const result = await api.post('/auth/change-password', body);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error changing password: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'logout',
    'Invalidate the current session cookie. Note: API-key callers are not affected — this only logs out cookie sessions.',
    {},
    async () => {
      const result = await api.post('/auth/logout', {});
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error logging out: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'list_my_notifications',
    "Fetch the caller's notification feed (paginated, cursor-based).",
    {
      cursor: z.string().optional().describe('Pagination cursor.'),
      limit: z.number().int().positive().max(200).optional().describe('Page size (default 50).'),
      unread_only: z.boolean().optional().describe('Only return unread notifications.'),
      category: z.string().optional().describe('Filter by category (e.g. mention, assignment).'),
      source_app: z.string().optional().describe('Filter by source app (bbb, banter, helpdesk).'),
    },
    async ({ cursor, limit, unread_only, category, source_app }) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      if (unread_only) params.set('unread_only', 'true');
      if (category) params.set('category', category);
      if (source_app) params.set('source_app', source_app);
      const qs = params.toString();
      const result = await api.get(`/me/notifications${qs ? `?${qs}` : ''}`);
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching notifications: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'mark_notification_read',
    'Mark a single notification as read.',
    {
      notification_id: z.string().uuid().describe('Notification ID.'),
    },
    async ({ notification_id }) => {
      const result = await api.post(`/me/notifications/${notification_id}/read`, {});
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error marking notification read: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'mark_notifications_read',
    'Mark several notifications as read in one call.',
    {
      notification_ids: z.array(z.string().uuid()).min(1).max(500).describe('List of notification IDs to mark read.'),
    },
    async ({ notification_ids }) => {
      const result = await api.post('/me/notifications/mark-read', { notification_ids });
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error marking notifications read: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );

  server.tool(
    'mark_all_notifications_read',
    "Mark every notification in the caller's feed as read.",
    {},
    async () => {
      const result = await api.post('/me/notifications/mark-all-read', {});
      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error marking all notifications read: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
    },
  );
}
