import { z } from 'zod';

// Bolt (workflow automation) schemas.

export const BoltExecutionStatus = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
]);

export const boltEventIngestSchema = z.object({
  event_type: z.string().min(1).max(255).refine((v) => !v.includes('.') || !/^(bond|bam|banter|helpdesk|blast|bearing|bench|bill|blank|board|book|brief|beacon)\./.test(v), {
    message: 'Event type must be bare; supply source separately',
  }),
  source: z.string().min(1).max(50),
  payload: z.record(z.string(), z.unknown()),
  org_id: z.string().uuid(),
  actor_id: z.string().uuid().optional(),
  actor_type: z.enum(['user', 'agent', 'system']).optional(),
});

export const boltAutomationTriggerSchema = z.object({
  source: z.string().min(1).max(50),
  event_type: z.string().min(1).max(255),
  conditions: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const boltAutomationActionSchema = z.object({
  kind: z.enum(['mcp_tool', 'http', 'delay', 'branch']),
  mcp_tool: z.string().optional(),
  http: z
    .object({
      method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  delay_ms: z.number().int().nonnegative().optional(),
});

export const createBoltAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  trigger: boltAutomationTriggerSchema,
  actions: z.array(boltAutomationActionSchema).min(1),
  enabled: z.boolean().default(true),
});

export const updateBoltAutomationSchema = createBoltAutomationSchema.partial();

export type BoltEventIngestInput = z.infer<typeof boltEventIngestSchema>;
export type BoltAutomationTrigger = z.infer<typeof boltAutomationTriggerSchema>;
export type BoltAutomationAction = z.infer<typeof boltAutomationActionSchema>;
export type CreateBoltAutomationInput = z.infer<typeof createBoltAutomationSchema>;
