import { z } from 'zod';
import { ORG_ROLES } from '../constants/index.js';
import { uuidSchema } from './common.js';

export const updateOrgSchema = z.object({
  name: z.string().max(255).optional(),
  logo_url: z.string().url().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES),
  project_ids: z.array(uuidSchema).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});
