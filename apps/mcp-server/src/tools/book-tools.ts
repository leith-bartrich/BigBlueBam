import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';

function createBookClient(bookApiUrl: string, api: ApiClient) {
  const baseUrl = bookApiUrl.replace(/\/$/, '');

  async function request(method: string, path: string, body?: unknown) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const token = (api as unknown as { token?: string }).token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  return { request };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(label: string, data: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error ${label}: ${JSON.stringify(data)}` }],
    isError: true as const,
  };
}

function buildQs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function registerBookTools(server: McpServer, api: ApiClient, bookApiUrl: string): void {
  const client = createBookClient(bookApiUrl, api);

  // ===== 1. book_list_events =====
  server.tool(
    'book_list_events',
    'List calendar events in a date range, optionally filtered by calendar IDs.',
    {
      start_after: z.string().describe('ISO 8601 date — events ending after this time'),
      start_before: z.string().describe('ISO 8601 date — events starting before this time'),
      calendar_ids: z.string().optional().describe('Comma-separated calendar UUIDs'),
      limit: z.number().int().positive().max(500).optional().describe('Page size (default 100)'),
    },
    async (params) => {
      const result = await client.request('GET', `/events${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('listing events', result.data);
    },
  );

  // ===== 2. book_create_event =====
  server.tool(
    'book_create_event',
    'Create a calendar event with optional attendees.',
    {
      calendar_id: z.string().uuid().describe('Calendar to create the event in'),
      title: z.string().min(1).max(500).describe('Event title'),
      start_at: z.string().describe('ISO 8601 start time'),
      end_at: z.string().describe('ISO 8601 end time'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Physical location or address'),
      meeting_url: z.string().optional().describe('Virtual meeting URL'),
      all_day: z.boolean().optional().describe('Is this an all-day event?'),
      attendees: z.array(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        user_id: z.string().uuid().optional(),
      })).optional().describe('List of attendees'),
    },
    async (params) => {
      const result = await client.request('POST', '/events', params);
      return result.ok ? ok(result.data) : err('creating event', result.data);
    },
  );

  // ===== 3. book_update_event =====
  server.tool(
    'book_update_event',
    'Update an existing calendar event.',
    {
      id: z.string().uuid().describe('Event ID'),
      title: z.string().optional().describe('New title'),
      start_at: z.string().optional().describe('New start time'),
      end_at: z.string().optional().describe('New end time'),
      description: z.string().optional().describe('New description'),
      location: z.string().optional().describe('New location'),
      status: z.enum(['tentative', 'confirmed', 'cancelled']).optional(),
    },
    async ({ id, ...body }) => {
      const result = await client.request('PATCH', `/events/${id}`, body);
      return result.ok ? ok(result.data) : err('updating event', result.data);
    },
  );

  // ===== 4. book_cancel_event =====
  server.tool(
    'book_cancel_event',
    'Cancel a calendar event (sets status to cancelled).',
    {
      id: z.string().uuid().describe('Event ID to cancel'),
    },
    async ({ id }) => {
      const result = await client.request('DELETE', `/events/${id}`);
      return result.ok ? ok(result.data) : err('cancelling event', result.data);
    },
  );

  // ===== 5. book_get_availability =====
  server.tool(
    'book_get_availability',
    'Get available time slots for a user in a date range.',
    {
      user_id: z.string().uuid().describe('User ID to check availability for'),
      start_date: z.string().describe('ISO 8601 range start'),
      end_date: z.string().describe('ISO 8601 range end'),
    },
    async ({ user_id, ...params }) => {
      const result = await client.request('GET', `/availability/${user_id}${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting availability', result.data);
    },
  );

  // ===== 6. book_get_team_availability =====
  server.tool(
    'book_get_team_availability',
    'Get available time slots for multiple users to find common free times.',
    {
      user_ids: z.array(z.string().uuid()).min(2).describe('Array of user IDs'),
      start_date: z.string().describe('ISO 8601 range start'),
      end_date: z.string().describe('ISO 8601 range end'),
    },
    async ({ user_ids, ...params }) => {
      const result = await client.request('GET', `/availability/team${buildQs({ user_ids: user_ids.join(','), ...params })}`);
      return result.ok ? ok(result.data) : err('getting team availability', result.data);
    },
  );

  // ===== 7. book_find_meeting_time =====
  server.tool(
    'book_find_meeting_time',
    'AI-assisted: find optimal meeting times for a set of attendees. Returns up to 3 suggested slots.',
    {
      user_ids: z.array(z.string().uuid()).min(2).describe('Attendee user IDs'),
      duration_minutes: z.number().int().min(5).max(480).describe('Meeting duration in minutes'),
      start_date: z.string().describe('Earliest date to consider'),
      end_date: z.string().describe('Latest date to consider'),
    },
    async ({ user_ids, duration_minutes, start_date, end_date }) => {
      // Get team availability and find common slots
      const result = await client.request('GET', `/availability/team${buildQs({ user_ids: user_ids.join(','), start_date, end_date })}`);
      if (!result.ok) return err('getting team availability', result.data);

      const allSlots: Record<string, Array<{ start: string; end: string }>> = result.data.data;
      const durationMs = duration_minutes * 60 * 1000;

      // Find intersecting free slots
      const userIdList = Object.keys(allSlots);
      if (userIdList.length === 0) return ok({ suggestions: [] });

      let commonSlots = allSlots[userIdList[0]!]!;

      for (let i = 1; i < userIdList.length; i++) {
        const userSlots = allSlots[userIdList[i]!]!;
        commonSlots = intersectSlots(commonSlots, userSlots);
      }

      // Filter to slots long enough for the meeting
      const candidates = commonSlots
        .filter((s) => new Date(s.end).getTime() - new Date(s.start).getTime() >= durationMs)
        .slice(0, 3)
        .map((s) => ({
          start: s.start,
          end: new Date(new Date(s.start).getTime() + durationMs).toISOString(),
        }));

      return ok({ suggestions: candidates });
    },
  );

  // ===== 8. book_create_booking_page =====
  server.tool(
    'book_create_booking_page',
    'Create a public booking page (scheduling link).',
    {
      slug: z.string().describe('URL slug for /meet/:slug'),
      title: z.string().describe('Page title shown to visitors'),
      description: z.string().optional().describe('Description'),
      duration_minutes: z.number().int().optional().describe('Meeting duration (default 30)'),
    },
    async (params) => {
      const result = await client.request('POST', '/booking-pages', params);
      return result.ok ? ok(result.data) : err('creating booking page', result.data);
    },
  );

  // ===== 9. book_get_timeline =====
  server.tool(
    'book_get_timeline',
    'Get aggregated cross-product timeline with Book events, Bam tasks, sprints, and more.',
    {
      start_date: z.string().describe('ISO 8601 range start'),
      end_date: z.string().describe('ISO 8601 range end'),
    },
    async (params) => {
      const result = await client.request('GET', `/timeline${buildQs(params)}`);
      return result.ok ? ok(result.data) : err('getting timeline', result.data);
    },
  );

  // ===== 10. book_rsvp_event =====
  server.tool(
    'book_rsvp_event',
    'Accept, decline, or mark tentative for a calendar event on behalf of the current user.',
    {
      event_id: z.string().uuid().describe('Event ID'),
      response_status: z.enum(['accepted', 'declined', 'tentative']).describe('RSVP response'),
    },
    async ({ event_id, response_status }) => {
      const result = await client.request('POST', `/events/${event_id}/rsvp`, { response_status });
      return result.ok ? ok(result.data) : err('RSVPing to event', result.data);
    },
  );
}

// Helper: intersect two lists of time slots
function intersectSlots(
  a: Array<{ start: string; end: string }>,
  b: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  const result: Array<{ start: string; end: string }> = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const aStart = new Date(a[i]!.start).getTime();
    const aEnd = new Date(a[i]!.end).getTime();
    const bStart = new Date(b[j]!.start).getTime();
    const bEnd = new Date(b[j]!.end).getTime();

    const overlapStart = Math.max(aStart, bStart);
    const overlapEnd = Math.min(aEnd, bEnd);

    if (overlapStart < overlapEnd) {
      result.push({
        start: new Date(overlapStart).toISOString(),
        end: new Date(overlapEnd).toISOString(),
      });
    }

    if (aEnd < bEnd) i++;
    else j++;
  }

  return result;
}
