import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { benchMaterializedViews } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// List materialized views
// ---------------------------------------------------------------------------

export async function listMaterializedViews() {
  return db.select().from(benchMaterializedViews);
}

// ---------------------------------------------------------------------------
// Refresh a materialized view
// ---------------------------------------------------------------------------

export async function refreshView(viewName: string) {
  const [view] = await db
    .select()
    .from(benchMaterializedViews)
    .where(eq(benchMaterializedViews.view_name, viewName))
    .limit(1);

  if (!view) throw notFound(`Materialized view not found: ${viewName}`);

  const start = Date.now();
  try {
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`));
  } catch {
    // CONCURRENTLY requires a unique index; fall back to non-concurrent
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${viewName}`));
  }
  const durationMs = Date.now() - start;

  await db
    .update(benchMaterializedViews)
    .set({
      last_refreshed_at: new Date(),
      refresh_duration_ms: durationMs,
    })
    .where(eq(benchMaterializedViews.view_name, viewName));

  return { view_name: viewName, duration_ms: durationMs, refreshed_at: new Date().toISOString() };
}
