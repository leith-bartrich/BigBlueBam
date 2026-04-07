import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  context: z.record(z.unknown()).optional(),
});

const explainSchema = z.object({
  automation: z.object({
    name: z.string().max(255),
    trigger_source: z.string().max(30),
    trigger_event: z.string().max(60),
    conditions: z.array(z.record(z.unknown())).optional().default([]),
    actions: z.array(z.record(z.unknown())).optional().default([]),
  }),
});

export default async function aiAssistRoutes(fastify: FastifyInstance) {
  // POST /ai/generate — Generate an automation definition from a natural language prompt
  fastify.post(
    '/ai/generate',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { prompt } = generateSchema.parse(request.body);

      // Stub implementation — returns a sample automation definition
      const sample = {
        name: `Auto-generated: ${prompt.slice(0, 80)}`,
        description: `Automation generated from prompt: "${prompt}"`,
        trigger_source: 'bam',
        trigger_event: 'task.created',
        conditions: [
          {
            sort_order: 0,
            field: 'task.priority',
            operator: 'equals',
            value: 'high',
            logic_group: 'and',
          },
        ],
        actions: [
          {
            sort_order: 0,
            mcp_tool: 'banter_send_message',
            parameters: {
              channel_name: 'alerts',
              message: 'New high priority task: {{ event.task.title }}',
            },
            on_error: 'continue',
          },
        ],
      };

      return reply.send({
        data: {
          automation: sample,
          confidence: 0.7,
          message: 'This is a placeholder response. AI generation will be implemented in a future update.',
        },
      });
    },
  );

  // POST /ai/explain — Explain an automation in natural language
  fastify.post(
    '/ai/explain',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { automation } = explainSchema.parse(request.body);

      const conditionCount = automation.conditions?.length ?? 0;
      const actionCount = automation.actions?.length ?? 0;

      const explanation = [
        `This automation is named "${automation.name}".`,
        `It triggers on the "${automation.trigger_event}" event from the "${automation.trigger_source}" source.`,
        conditionCount > 0
          ? `It has ${conditionCount} condition${conditionCount > 1 ? 's' : ''} that must be met before actions execute.`
          : 'It has no conditions, so it will trigger on every matching event.',
        actionCount > 0
          ? `When triggered, it will execute ${actionCount} action${actionCount > 1 ? 's' : ''} in sequence.`
          : 'It has no actions configured yet.',
      ].join(' ');

      return reply.send({
        data: {
          explanation,
          message: 'This is a placeholder response. AI explanation will be enhanced in a future update.',
        },
      });
    },
  );
}
