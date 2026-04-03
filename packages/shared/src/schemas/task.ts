import { z } from 'zod';
import { PRIORITIES } from '../constants/index.js';
import { uuidSchema, isoDateSchema } from './common.js';

export const createTaskSchema = z.object({
  title: z.string().max(500),
  description: z.string().optional(),
  phase_id: uuidSchema,
  state_id: uuidSchema.optional(),
  sprint_id: uuidSchema.nullable().optional(),
  assignee_id: uuidSchema.nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  story_points: z.number().int().positive().nullable().optional(),
  time_estimate_minutes: z.number().int().positive().nullable().optional(),
  start_date: isoDateSchema.nullable().optional(),
  due_date: isoDateSchema.nullable().optional(),
  label_ids: z.array(uuidSchema).optional(),
  epic_id: uuidSchema.nullable().optional(),
  parent_task_id: uuidSchema.nullable().optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
  phase_id: uuidSchema,
  position: z.number(),
  sprint_id: uuidSchema.nullable().optional(),
});

export const bulkUpdateSchema = z.object({
  task_ids: z.array(uuidSchema),
  operation: z.enum(['update', 'move', 'delete']),
  fields: z.record(z.unknown()).optional(),
});
