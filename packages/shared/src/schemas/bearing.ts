import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────
export const BearingPeriodType = z.enum(['quarter', 'half', 'year', 'custom']);
export const BearingPeriodStatus = z.enum(['planning', 'active', 'completed', 'archived']);
export const BearingGoalScope = z.enum(['organization', 'team', 'project']);
export const BearingGoalStatus = z.enum(['on_track', 'at_risk', 'behind', 'achieved', 'cancelled']);
export const BearingMetricType = z.enum(['percentage', 'number', 'currency', 'boolean']);
export const BearingDirection = z.enum(['increase', 'decrease']);
export const BearingProgressMode = z.enum(['manual', 'linked', 'rollup']);
export const BearingLinkType = z.enum(['epic', 'project', 'task_query']);

// ── Period schemas ─────────────────────────────────────────────────────
export const createBearingPeriodSchema = z.object({
  name: z.string().min(1).max(100),
  period_type: BearingPeriodType,
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateBearingPeriodSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  period_type: BearingPeriodType.optional(),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: BearingPeriodStatus.optional(),
});

// ── Goal schemas ───────────────────────────────────────────────────────
export const createBearingGoalSchema = z.object({
  period_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  scope: BearingGoalScope.default('organization'),
  project_id: z.string().uuid().optional(),
  team_name: z.string().max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  owner_id: z.string().uuid(),
});

export const updateBearingGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  scope: BearingGoalScope.optional(),
  project_id: z.string().uuid().nullable().optional(),
  team_name: z.string().max(100).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  owner_id: z.string().uuid().optional(),
});

export const overrideBearingGoalStatusSchema = z.object({
  status: BearingGoalStatus,
  status_override: z.boolean().default(true),
});

// ── Key Result schemas ─────────────────────────────────────────────────
export const createBearingKeyResultSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  metric_type: BearingMetricType.default('percentage'),
  target_value: z.number(),
  start_value: z.number().default(0),
  unit: z.string().max(20).optional(),
  direction: BearingDirection.default('increase'),
  progress_mode: BearingProgressMode.default('manual'),
  owner_id: z.string().uuid().optional(),
});

export const updateBearingKeyResultSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  metric_type: BearingMetricType.optional(),
  target_value: z.number().optional(),
  start_value: z.number().optional(),
  unit: z.string().max(20).nullable().optional(),
  direction: BearingDirection.optional(),
  progress_mode: BearingProgressMode.optional(),
  owner_id: z.string().uuid().nullable().optional(),
});

export const setBearingKrValueSchema = z.object({
  current_value: z.number(),
});

// ── KR Link schemas ────────────────────────────────────────────────────
export const createBearingKrLinkSchema = z.object({
  link_type: BearingLinkType,
  epic_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  task_query: z.record(z.unknown()).optional(),
  weight: z.number().min(0).max(100).default(1.0),
});

// ── Status Update schemas ──────────────────────────────────────────────
export const createBearingUpdateSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ── Report schemas ─────────────────────────────────────────────────────
export const generateBearingReportSchema = z.object({
  period_id: z.string().uuid().optional(),
  format: z.enum(['markdown', 'json']).default('markdown'),
});
