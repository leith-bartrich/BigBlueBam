import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

/**
 * Banter message partition manager.
 *
 * Migration 0106 pre-creates monthly partitions through 2028-06. This module
 * exposes the helpers the worker's `banter-partition-monthly` job will call to
 * keep the horizon rolling forward. The helpers are idempotent and safe to run
 * against a database that already has the target partition.
 *
 * NOTE: Whether `banter_messages` is actually a partitioned parent table
 * depends on how 0000_init.sql was applied on a given environment. On a fresh
 * environment using the committed `0000_init.sql`, `banter_messages` is a
 * plain (unpartitioned) table, so the `CREATE TABLE ... PARTITION OF`
 * statements here (and in migration 0106) will fail. The planned follow-up
 * work (tracked separately) migrates the parent to a partitioned table via an
 * `expand-contract` step. Until then, `ensureNextMonthPartition()` will no-op
 * gracefully when the parent is not partitioned.
 */

export interface PartitionInfo {
  name: string;
  from: string;
  to: string;
}

/**
 * Compute the partition name + range bounds for a given year/month.
 * Months are 1-indexed (1 = January, 12 = December).
 */
export function computePartitionInfo(year: number, month: number): PartitionInfo {
  if (month < 1 || month > 12) {
    throw new Error(`computePartitionInfo: month out of range: ${month}`);
  }
  const name = `banter_messages_${year}_${String(month).padStart(2, '0')}`;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { name, from, to };
}

/**
 * Query pg_tables to see whether a partition with the given name already
 * exists in the `public` schema. Partitions in PostgreSQL are regular tables
 * with a parent link, so they appear in pg_tables.
 */
export async function partitionExists(partitionName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ${partitionName}
    LIMIT 1
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Check whether `banter_messages` is set up as a partitioned parent table.
 * Returns false if the table is a plain (unpartitioned) table.
 */
export async function isParentPartitioned(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    WHERE c.relname = 'banter_messages'
    LIMIT 1
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Create a monthly partition of `banter_messages` if it does not already
 * exist. Returns `true` if a new partition was created, `false` if it was
 * already present or if the parent is not partitioned.
 *
 * This is idempotent and safe to call repeatedly.
 */
export async function ensurePartition(info: PartitionInfo): Promise<boolean> {
  if (await partitionExists(info.name)) {
    return false;
  }
  if (!(await isParentPartitioned())) {
    return false;
  }

  // sql.raw is safe here because `info` is constructed by computePartitionInfo
  // from numeric inputs we control (year + month). No user input flows in.
  await db.execute(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS ${info.name} PARTITION OF banter_messages ` +
        `FOR VALUES FROM ('${info.from}') TO ('${info.to}')`,
    ),
  );
  return true;
}

/**
 * Ensure the partition for `now + monthsAhead` months exists. Intended entry
 * point for the daily worker job. `monthsAhead` defaults to 2 so we always
 * keep at least one month of headroom beyond the current month.
 */
export async function ensureNextMonthPartition(
  now: Date = new Date(),
  monthsAhead = 2,
): Promise<PartitionInfo | null> {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 1));
  const info = computePartitionInfo(target.getUTCFullYear(), target.getUTCMonth() + 1);
  const created = await ensurePartition(info);
  return created ? info : null;
}
