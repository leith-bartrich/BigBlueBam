import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { benchWidgets, benchDashboards } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';
import { getDataSource } from '../lib/data-source-registry.js';
import * as queryService from './query.service.js';
import type { QueryConfig } from './query.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateWidgetInput {
  name: string;
  widget_type: string;
  data_source: string;
  entity: string;
  query_config: QueryConfig;
  viz_config?: Record<string, unknown>;
  kpi_config?: Record<string, unknown>;
  cache_ttl_seconds?: number;
}

export interface UpdateWidgetInput {
  name?: string;
  widget_type?: string;
  data_source?: string;
  entity?: string;
  query_config?: QueryConfig;
  viz_config?: Record<string, unknown>;
  kpi_config?: Record<string, unknown>;
  cache_ttl_seconds?: number | null;
}

// ---------------------------------------------------------------------------
// Create widget
// ---------------------------------------------------------------------------

export async function createWidget(
  dashboardId: string,
  orgId: string,
  input: CreateWidgetInput,
) {
  // Verify dashboard exists and belongs to org
  const [dash] = await db
    .select({ id: benchDashboards.id })
    .from(benchDashboards)
    .where(and(eq(benchDashboards.id, dashboardId), eq(benchDashboards.organization_id, orgId)))
    .limit(1);

  if (!dash) throw notFound('Dashboard not found');

  // Verify data source exists
  const source = getDataSource(input.data_source, input.entity);
  if (!source) throw badRequest(`Unknown data source: ${input.data_source}.${input.entity}`);

  const [widget] = await db
    .insert(benchWidgets)
    .values({
      dashboard_id: dashboardId,
      name: input.name,
      widget_type: input.widget_type,
      data_source: input.data_source,
      entity: input.entity,
      query_config: input.query_config,
      viz_config: input.viz_config ?? {},
      kpi_config: input.kpi_config,
      cache_ttl_seconds: input.cache_ttl_seconds,
    })
    .returning();

  return widget!;
}

// ---------------------------------------------------------------------------
// Get widget
// ---------------------------------------------------------------------------

export async function getWidget(id: string) {
  const [widget] = await db
    .select()
    .from(benchWidgets)
    .where(eq(benchWidgets.id, id))
    .limit(1);

  if (!widget) throw notFound('Widget not found');
  return widget;
}

// ---------------------------------------------------------------------------
// Update widget
// ---------------------------------------------------------------------------

export async function updateWidget(id: string, input: UpdateWidgetInput) {
  if (input.data_source && input.entity) {
    const source = getDataSource(input.data_source, input.entity);
    if (!source) throw badRequest(`Unknown data source: ${input.data_source}.${input.entity}`);
  }

  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.widget_type !== undefined) updateData.widget_type = input.widget_type;
  if (input.data_source !== undefined) updateData.data_source = input.data_source;
  if (input.entity !== undefined) updateData.entity = input.entity;
  if (input.query_config !== undefined) updateData.query_config = input.query_config;
  if (input.viz_config !== undefined) updateData.viz_config = input.viz_config;
  if (input.kpi_config !== undefined) updateData.kpi_config = input.kpi_config;
  if (input.cache_ttl_seconds !== undefined) updateData.cache_ttl_seconds = input.cache_ttl_seconds;

  const [updated] = await db
    .update(benchWidgets)
    .set(updateData)
    .where(eq(benchWidgets.id, id))
    .returning();

  if (!updated) throw notFound('Widget not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete widget
// ---------------------------------------------------------------------------

export async function deleteWidget(id: string) {
  const [deleted] = await db
    .delete(benchWidgets)
    .where(eq(benchWidgets.id, id))
    .returning({ id: benchWidgets.id });

  if (!deleted) throw notFound('Widget not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Execute widget query
// ---------------------------------------------------------------------------

export async function executeWidgetQuery(id: string, orgId: string) {
  const widget = await getWidget(id);
  return queryService.executeQuery(
    widget.data_source,
    widget.entity,
    widget.query_config as QueryConfig,
    orgId,
  );
}
