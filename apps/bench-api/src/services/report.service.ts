import { eq, and, asc, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { benchScheduledReports, benchDashboards } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateReportInput {
  dashboard_id: string;
  name: string;
  cron_expression: string;
  cron_timezone?: string;
  delivery_method: string;
  delivery_target: string;
  export_format?: string;
  enabled?: boolean;
}

export interface UpdateReportInput {
  name?: string;
  cron_expression?: string;
  cron_timezone?: string;
  delivery_method?: string;
  delivery_target?: string;
  export_format?: string;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// List reports
// ---------------------------------------------------------------------------

export async function listReports(orgId: string, search?: string) {
  const conditions = [eq(benchScheduledReports.organization_id, orgId)];
  if (search && search.trim().length > 0) {
    conditions.push(ilike(benchScheduledReports.name, `%${search.trim()}%`));
  }

  return db
    .select({
      id: benchScheduledReports.id,
      name: benchScheduledReports.name,
      dashboard_id: benchScheduledReports.dashboard_id,
      dashboard_name: benchDashboards.name,
      cron_expression: benchScheduledReports.cron_expression,
      cron_timezone: benchScheduledReports.cron_timezone,
      delivery_method: benchScheduledReports.delivery_method,
      delivery_target: benchScheduledReports.delivery_target,
      export_format: benchScheduledReports.export_format,
      enabled: benchScheduledReports.enabled,
      last_sent_at: benchScheduledReports.last_sent_at,
      created_at: benchScheduledReports.created_at,
      updated_at: benchScheduledReports.updated_at,
    })
    .from(benchScheduledReports)
    .innerJoin(benchDashboards, eq(benchScheduledReports.dashboard_id, benchDashboards.id))
    .where(and(...conditions))
    .orderBy(asc(benchScheduledReports.created_at));
}

// ---------------------------------------------------------------------------
// Create report
// ---------------------------------------------------------------------------

export async function createReport(orgId: string, userId: string, input: CreateReportInput) {
  // Verify dashboard exists and belongs to org
  const [dash] = await db
    .select({ id: benchDashboards.id })
    .from(benchDashboards)
    .where(and(eq(benchDashboards.id, input.dashboard_id), eq(benchDashboards.organization_id, orgId)))
    .limit(1);

  if (!dash) throw notFound('Dashboard not found');

  const [report] = await db
    .insert(benchScheduledReports)
    .values({
      dashboard_id: input.dashboard_id,
      organization_id: orgId,
      name: input.name,
      cron_expression: input.cron_expression,
      cron_timezone: input.cron_timezone ?? 'UTC',
      delivery_method: input.delivery_method,
      delivery_target: input.delivery_target,
      export_format: input.export_format ?? 'pdf',
      enabled: input.enabled ?? true,
      created_by: userId,
    })
    .returning();

  return report!;
}

// ---------------------------------------------------------------------------
// Update report
// ---------------------------------------------------------------------------

export async function updateReport(id: string, orgId: string, input: UpdateReportInput) {
  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.cron_expression !== undefined) updateData.cron_expression = input.cron_expression;
  if (input.cron_timezone !== undefined) updateData.cron_timezone = input.cron_timezone;
  if (input.delivery_method !== undefined) updateData.delivery_method = input.delivery_method;
  if (input.delivery_target !== undefined) updateData.delivery_target = input.delivery_target;
  if (input.export_format !== undefined) updateData.export_format = input.export_format;
  if (input.enabled !== undefined) updateData.enabled = input.enabled;

  const [updated] = await db
    .update(benchScheduledReports)
    .set(updateData)
    .where(and(eq(benchScheduledReports.id, id), eq(benchScheduledReports.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Report not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete report
// ---------------------------------------------------------------------------

export async function deleteReport(id: string, orgId: string) {
  const [deleted] = await db
    .delete(benchScheduledReports)
    .where(and(eq(benchScheduledReports.id, id), eq(benchScheduledReports.organization_id, orgId)))
    .returning({ id: benchScheduledReports.id });

  if (!deleted) throw notFound('Report not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Send now (trigger immediate generation)
// ---------------------------------------------------------------------------

export async function sendReportNow(id: string, orgId: string) {
  const [report] = await db
    .select()
    .from(benchScheduledReports)
    .where(and(eq(benchScheduledReports.id, id), eq(benchScheduledReports.organization_id, orgId)))
    .limit(1);

  if (!report) throw notFound('Report not found');

  // Update last_sent_at
  await db
    .update(benchScheduledReports)
    .set({ last_sent_at: new Date() })
    .where(eq(benchScheduledReports.id, id));

  // In production, this would enqueue a BullMQ job for report generation.
  // For now, we return a confirmation.
  return { report_id: id, status: 'queued', queued_at: new Date().toISOString() };
}
