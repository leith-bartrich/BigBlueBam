import { z } from 'zod';

// ─── Request schemas ────────────────────────────────────────────────────────

export const superuserListOrgsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().max(255).optional(),
});

export const superuserSwitchContextSchema = z.object({
  org_id: z.string().uuid(),
});

// ─── Response schemas ───────────────────────────────────────────────────────

export const superuserOrgListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  type: z.string().nullable(),
  parent_org_id: z.string().uuid().nullable(),
  created_at: z.string(),
  member_count: z.number().int(),
  project_count: z.number().int(),
  task_count: z.number().int(),
  last_activity_at: z.string().nullable(),
});

export const superuserOrgListResponseSchema = z.object({
  data: z.array(superuserOrgListItemSchema),
  next_cursor: z.string().nullable(),
});

export const superuserOrgDetailProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  task_count: z.number().int(),
});

export const superuserOrgDetailOwnerSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  display_name: z.string(),
});

export const superuserOrgDetailActivitySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  action: z.string(),
  created_at: z.string(),
});

export const superuserOrgDetailResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  type: z.string().nullable(),
  parent_org_id: z.string().uuid().nullable(),
  plan: z.string(),
  logo_url: z.string().nullable(),
  settings: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  owners: z.array(superuserOrgDetailOwnerSchema),
  projects: z.array(superuserOrgDetailProjectSchema),
  member_counts_by_role: z.record(z.number().int()),
  recent_activity: z.array(superuserOrgDetailActivitySchema),
});

export const superuserOverviewResponseSchema = z.object({
  total_orgs: z.number().int(),
  total_users: z.number().int(),
  total_active_sessions: z.number().int(),
  total_projects: z.number().int(),
  total_tasks: z.number().int(),
  total_tickets: z.number().int(),
  total_banter_channels: z.number().int(),
  new_users_7d: z.number().int(),
  new_users_30d: z.number().int(),
  new_orgs_7d: z.number().int(),
  new_orgs_30d: z.number().int(),
});

export const superuserSwitchContextResponseSchema = z.object({
  active_org_id: z.string().uuid(),
});

export const superuserClearContextResponseSchema = z.object({
  ok: z.literal(true),
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type SuperuserListOrgsQuery = z.infer<typeof superuserListOrgsQuerySchema>;
export type SuperuserSwitchContextInput = z.infer<typeof superuserSwitchContextSchema>;
export type SuperuserOrgListItem = z.infer<typeof superuserOrgListItemSchema>;
export type SuperuserOrgListResponse = z.infer<typeof superuserOrgListResponseSchema>;
export type SuperuserOrgDetailResponse = z.infer<typeof superuserOrgDetailResponseSchema>;
export type SuperuserOverviewResponse = z.infer<typeof superuserOverviewResponseSchema>;
