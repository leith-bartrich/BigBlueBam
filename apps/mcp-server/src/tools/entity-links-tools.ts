import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

/**
 * Cross-app entity-links MCP tools (AGENTIC_TODO §16, Wave 4).
 *
 * Tools:
 *   - entity_links_list      GET    /v1/entity-links
 *   - entity_link_create     POST   /v1/entity-links
 *   - entity_link_remove     DELETE /v1/entity-links/:id
 *
 * These wrap the durable cross-app entity-link table so agents can query
 * "everything linked to this entity" in one call instead of stitching
 * per-app FK columns together. Writes run the Wave 2 can_access preflight
 * for both endpoints and reject types outside the Wave 2 supported
 * allowlist. Reads filter out rows whose far side is not accessible and
 * report filtered_count so the caller can still see that some edges
 * exist but aren't being surfaced.
 */

const LINK_KINDS = [
  'related_to',
  'duplicates',
  'blocks',
  'references',
  'parent_of',
  'derived_from',
] as const;

export function registerEntityLinksTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'entity_links_list',
    description:
      "List cross-app entity links touching (type, id). Default direction 'both' returns both outbound and inbound rows; each row carries a 'direction' of 'outbound' or 'inbound' relative to the query. Rows whose far side is not accessible to the caller are silently filtered out and counted in filtered_count. Optional kind narrows to a single link_kind: related_to | duplicates | blocks | references | parent_of | derived_from. Reverse directions (e.g. blocked_by) are implicit via direction='dst'.",
    input: {
      type: z
        .string()
        .min(1)
        .max(64)
        .describe("Entity type (e.g. 'bam.task', 'bond.deal', 'brief.document')."),
      id: z.string().uuid().describe('Entity UUID.'),
      direction: z
        .enum(['src', 'dst', 'both'])
        .optional()
        .describe(
          "Which side the caller's entity sits on: 'src' for outbound-only, 'dst' for inbound-only, 'both' (default) for all rows.",
        ),
      kind: z
        .enum(LINK_KINDS)
        .optional()
        .describe('Optional link_kind filter.'),
      limit: z
        .number()
        .int()
        .positive()
        .max(500)
        .optional()
        .describe('Max rows to return (default 100, max 500).'),
    },
    returns: z.object({
      data: z.array(
        z
          .object({
            id: z.string().uuid(),
            org_id: z.string().uuid(),
            src_type: z.string(),
            src_id: z.string().uuid(),
            dst_type: z.string(),
            dst_id: z.string().uuid(),
            link_kind: z.enum(LINK_KINDS),
            created_by: z.string().uuid().nullable(),
            created_at: z.string(),
            direction: z.enum(['outbound', 'inbound']),
          })
          .passthrough(),
      ),
      filtered_count: z.number().int().nonnegative(),
    }),
    handler: async ({ type, id, direction, kind, limit }) => {
      const params = new URLSearchParams();
      params.set('type', type);
      params.set('id', id);
      if (direction) params.set('direction', direction);
      if (kind) params.set('kind', kind);
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const result = await api.get(`/v1/entity-links${qs ? `?${qs}` : ''}`);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing entity links: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'entity_link_create',
    description:
      "Create a directional cross-app link. Both endpoints are preflighted via can_access and writes are rejected with 403 if either side is not accessible. Only the Wave 2 supported entity types are writable (bam.task/project/sprint, helpdesk.ticket, bond.deal/contact/company, brief.document, beacon.entry); any other type returns 400 UNSUPPORTED_ENTITY_TYPE. link_kind is one of related_to, duplicates, blocks, references, parent_of, derived_from. parent_of and derived_from reject writes that would close a cycle with 400 CYCLE_DETECTED. Re-creating an identical link returns the existing row with created: false (idempotent). There is NO blocked_by; use blocks and query by direction='dst'.",
    input: {
      src_type: z.string().min(1).max(64).describe('Source entity type.'),
      src_id: z.string().uuid().describe('Source entity UUID.'),
      dst_type: z.string().min(1).max(64).describe('Destination entity type.'),
      dst_id: z.string().uuid().describe('Destination entity UUID.'),
      link_kind: z.enum(LINK_KINDS).describe('Link kind.'),
    },
    returns: z
      .object({
        data: z
          .object({
            id: z.string().uuid(),
            org_id: z.string().uuid(),
            src_type: z.string(),
            src_id: z.string().uuid(),
            dst_type: z.string(),
            dst_id: z.string().uuid(),
            link_kind: z.enum(LINK_KINDS),
            created_by: z.string().uuid().nullable(),
            created_at: z.string(),
          })
          .passthrough(),
        created: z.boolean(),
      })
      .passthrough(),
    handler: async (body) => {
      const result = await api.post('/v1/entity-links', body);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating entity link: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
      };
    },
  });

  registerTool(server, {
    name: 'entity_link_remove',
    description:
      "Remove an entity link by id. Returns { ok: true } on success. Caller must have can_access on at least one side of the link (403 otherwise). Returns 404 if the link is not in the caller's org.",
    input: {
      id: z.string().uuid().describe('Link id to remove.'),
    },
    returns: z.object({
      ok: z.boolean(),
    }),
    handler: async ({ id }) => {
      const result = await api.delete(`/v1/entity-links/${id}`);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error removing entity link: ${JSON.stringify(result.data)}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }, null, 2) }],
      };
    },
  });
}
