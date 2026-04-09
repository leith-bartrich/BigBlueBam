import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { benchMaterializedViews } from '../db/schema/index.js';
import { badRequest, notFound } from '../lib/utils.js';

/** Strict identifier: lowercase letters, digits, underscores. Max 63 chars (PG limit). */
const SAFE_IDENT = /^[a-z_][a-z0-9_]{0,62}$/;

function validateViewName(name: string): string {
  if (!SAFE_IDENT.test(name)) {
    throw badRequest(`Invalid materialized view name: ${name}`);
  }
  return name;
}

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
  const safeName = validateViewName(viewName);

  const [view] = await db
    .select()
    .from(benchMaterializedViews)
    .where(eq(benchMaterializedViews.view_name, safeName))
    .limit(1);

  if (!view) throw notFound(`Materialized view not found: ${safeName}`);

  const start = Date.now();
  try {
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${safeName}`));
  } catch {
    // CONCURRENTLY requires a unique index; fall back to non-concurrent
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${safeName}`));
  }
  const durationMs = Date.now() - start;

  await db
    .update(benchMaterializedViews)
    .set({
      last_refreshed_at: new Date(),
      refresh_duration_ms: durationMs,
    })
    .where(eq(benchMaterializedViews.view_name, safeName));

  return { view_name: safeName, duration_ms: durationMs, refreshed_at: new Date().toISOString() };
}
