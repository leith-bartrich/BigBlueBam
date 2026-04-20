// ---------------------------------------------------------------------------
// Expertise MCP tool (AGENTIC_TODO §8 Wave 5)
//
// One tool:
//   - expertise_for_topic
//
// Delegates to POST /v1/expertise/for-topic on the Bam api, which composes
// signals across Beacon, Brief, Bond, and Bam. Evidence is pre-filtered
// server-side via can_access for the asker, so an agent can safely surface
// the returned evidence in a shared channel without leaking private records.
//
// Default weights (applied server-side when omitted):
//   beacon=3.0, brief=2.0, bond=2.0, bam_activity=1.0
// Default half-life: 90 days.
// ---------------------------------------------------------------------------

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../middleware/api-client.js';
import { registerTool } from '../lib/register-tool.js';

const evidenceShape = z
  .object({
    entity_type: z.string(),
    entity_id: z.string(),
    title: z.string(),
    url: z.string(),
  })
  .passthrough();

const signalShape = z
  .object({
    source: z.enum(['beacon', 'bam', 'brief', 'bond']),
    weight: z.number(),
    evidence: z.array(evidenceShape),
  })
  .passthrough();

const expertShape = z
  .object({
    user_id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    score: z.number(),
    signals: z.array(signalShape),
  })
  .passthrough();

const responseShape = z
  .object({
    data: z
      .object({
        topic: z.string(),
        experts: z.array(expertShape),
      })
      .passthrough(),
  })
  .passthrough();

export function registerExpertiseTools(server: McpServer, api: ApiClient): void {
  registerTool(server, {
    name: 'expertise_for_topic',
    description:
      "Rank the top subject-matter experts for a natural-language topic. Aggregates signals across Beacon ownership (default weight 3.0), Brief authorship (2.0), Bond coverage on deals and contacts (2.0), and Bam task activity (1.0). Each evidence event is dampened by an exponential time decay with a configurable half-life (default 90 days) so recent work dominates. Evidence is preflighted through can_access for the supplied asker_user_id and stripped when the asker cannot see it; scores are preserved. Returns { topic, experts: [{ user_id, name, email, score, signals: [{ source, weight, evidence[] }] }] }.",
    input: {
      topic_query: z.string().min(1).max(500).describe('Topic phrase'),
      asker_user_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "User id whose visibility should gate evidence. Defaults to the caller. Must be in the caller's active org.",
        ),
      signal_weights: z
        .object({
          beacon: z.number().nonnegative().optional(),
          bam_activity: z.number().nonnegative().optional(),
          brief: z.number().nonnegative().optional(),
          bond: z.number().nonnegative().optional(),
        })
        .optional()
        .describe('Per-source weight overrides; omitted keys fall back to the service defaults.'),
      limit: z.number().int().positive().max(50).optional().describe('Cap on experts returned (default 10).'),
      time_decay_half_life_days: z
        .number()
        .positive()
        .max(3650)
        .optional()
        .describe('Exponential decay half-life in days (default 90).'),
    },
    returns: responseShape,
    handler: async (args) => {
      const result = await api.post('/v1/expertise/for-topic', args);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error running expertise_for_topic: ${JSON.stringify(result.data)}`,
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
}
