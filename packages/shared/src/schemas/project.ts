import { z } from 'zod';
import { PROJECT_ROLES, PROJECT_TEMPLATES, DEFAULT_SPRINT_DURATION_DAYS } from '../constants/index.js';
import { uuidSchema, hexColorSchema } from './common.js';

export const createProjectSchema = z.object({
  name: z.string().max(255),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().optional(),
  icon: z.string().max(10).optional(),
  color: hexColorSchema.optional(),
  task_id_prefix: z.string().regex(/^[A-Z]{2,6}$/),
  default_sprint_duration_days: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_SPRINT_DURATION_DAYS)
    .optional(),
  template: z.enum(PROJECT_TEMPLATES).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const addProjectMemberSchema = z.object({
  user_id: uuidSchema,
  role: z.enum(PROJECT_ROLES),
});
