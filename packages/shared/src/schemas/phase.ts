import { z } from 'zod';
import { uuidSchema, hexColorSchema } from './common.js';

export const createPhaseSchema = z.object({
  name: z.string().max(100),
  description: z.string().optional(),
  color: hexColorSchema.optional(),
  position: z.number().int().min(0),
  wip_limit: z.number().int().positive().nullable().optional(),
  is_start: z.boolean().optional(),
  is_terminal: z.boolean().optional(),
  auto_state_on_enter: uuidSchema.nullable().optional(),
});

export const updatePhaseSchema = createPhaseSchema.partial();

export const reorderPhasesSchema = z.object({
  phase_ids: z.array(uuidSchema),
});
