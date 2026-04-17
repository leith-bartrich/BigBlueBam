import { z } from 'zod';

// Bench (analytics / dashboards) schemas.

export const BenchWidgetKind = z.enum(['table', 'line', 'bar', 'pie', 'number', 'heatmap', 'markdown']);
export const BenchRefreshMode = z.enum(['manual', 'on_view', 'interval', 'scheduled']);

export const benchQueryConfigSchema = z.object({
  source: z.string().min(1).max(50),
  fields: z.array(z.string()).min(1),
  filters: z.array(z.record(z.string(), z.unknown())).optional(),
  group_by: z.array(z.string()).optional(),
  order_by: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(10_000).default(1000),
});

export const createBenchWidgetSchema = z.object({
  title: z.string().min(1).max(255),
  kind: BenchWidgetKind,
  query_config: benchQueryConfigSchema,
  display_config: z.record(z.string(), z.unknown()).optional(),
  x: z.number().int().nonnegative().default(0),
  y: z.number().int().nonnegative().default(0),
  width: z.number().int().min(1).max(24).default(6),
  height: z.number().int().min(1).max(24).default(4),
});

export const updateBenchWidgetSchema = createBenchWidgetSchema.partial();

export const createBenchDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  refresh_mode: BenchRefreshMode.default('on_view'),
  refresh_interval_seconds: z.number().int().min(10).optional(),
});

export const updateBenchDashboardSchema = createBenchDashboardSchema.partial();

export type BenchQueryConfig = z.infer<typeof benchQueryConfigSchema>;
export type CreateBenchWidgetInput = z.infer<typeof createBenchWidgetSchema>;
export type CreateBenchDashboardInput = z.infer<typeof createBenchDashboardSchema>;
