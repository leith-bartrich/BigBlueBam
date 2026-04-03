import { z } from 'zod';
import { uuidSchema, isoDateSchema } from './common.js';

export const createSprintSchema = z.object({
  name: z.string().max(100),
  goal: z.string().optional(),
  start_date: isoDateSchema,
  end_date: isoDateSchema,
});

export const updateSprintSchema = createSprintSchema.partial();

export const completeSprintSchema = z.object({
  carry_forward: z.object({
    target_sprint_id: uuidSchema,
    tasks: z.array(
      z.object({
        task_id: uuidSchema,
        action: z.enum(['carry_forward', 'backlog', 'cancel']),
      }),
    ),
  }),
  retrospective_notes: z.string().optional(),
});
