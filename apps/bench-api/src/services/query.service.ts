import { sql } from 'drizzle-orm';
import { readDb } from '../db/index.js';
import { env } from '../env.js';
import { getDataSource } from '../lib/data-source-registry.js';
import { badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryMeasure {
  field: string;
  agg: 'count' | 'sum' | 'avg' | 'min' | 'max';
  alias?: string;
}

export interface QueryDimension {
  field: string;
  alias?: string;
}

export interface QueryFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is_null' | 'is_not_null' | 'between' | 'like';
  value: unknown;
}

export interface TimeDimension {
  field: string;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface DateRange {
  preset?: string;
  start?: string;
  end?: string;
}

export interface QueryConfig {
  measures: QueryMeasure[];
  dimensions?: QueryDimension[];
  filters?: QueryFilter[];
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  limit?: number;
  time_dimension?: TimeDimension;
  date_range?: DateRange;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

const ALLOWED_IDENTS = /^[a-z_][a-z0-9_]*$/;

function validateIdent(name: string): string {
  if (!ALLOWED_IDENTS.test(name)) {
    throw badRequest(`Invalid identifier: ${name}`);
  }
  return name;
}

function buildFilterSql(f: QueryFilter): string {
  const field = validateIdent(f.field);
  switch (f.op) {
    case 'eq': return `${field} = '${String(f.value).replace(/'/g, "''")}'`;
    case 'neq': return `${field} != '${String(f.value).replace(/'/g, "''")}'`;
    case 'gt': return `${field} > '${String(f.value).replace(/'/g, "''")}'`;
    case 'gte': return `${field} >= '${String(f.value).replace(/'/g, "''")}'`;
    case 'lt': return `${field} < '${String(f.value).replace(/'/g, "''")}'`;
    case 'lte': return `${field} <= '${String(f.value).replace(/'/g, "''")}'`;
    case 'is_null': return `${field} IS NULL`;
    case 'is_not_null': return `${field} IS NOT NULL`;
    case 'in': {
      if (!Array.isArray(f.value)) throw badRequest('IN filter requires an array value');
      const vals = (f.value as string[]).map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
      return `${field} IN (${vals})`;
    }
    case 'between': {
      if (!Array.isArray(f.value) || f.value.length !== 2) throw badRequest('BETWEEN requires [start, end]');
      return `${field} BETWEEN '${String(f.value[0]).replace(/'/g, "''")}' AND '${String(f.value[1]).replace(/'/g, "''")}'`;
    }
    case 'like': return `${field} ILIKE '%${String(f.value).replace(/'/g, "''").replace(/[%_]/g, '\\$&')}%'`;
    default: throw badRequest(`Unknown filter operator: ${f.op}`);
  }
}

function resolveDateRange(dr: DateRange): { start: string; end: string } | null {
  if (dr.start && dr.end) return { start: dr.start, end: dr.end };
  if (!dr.preset) return null;

  const now = new Date();
  let start: Date;
  switch (dr.preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'last_7_days':
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case 'last_30_days':
      start = new Date(now.getTime() - 30 * 86400000);
      break;
    case 'last_90_days':
      start = new Date(now.getTime() - 90 * 86400000);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

export function buildQuery(
  product: string,
  entity: string,
  config: QueryConfig,
): string {
  const source = getDataSource(product, entity);
  if (!source) throw badRequest(`Unknown data source: ${product}.${entity}`);

  const table = validateIdent(source.baseTable);

  // Build SELECT columns
  const selectParts: string[] = [];

  // Time dimension
  if (config.time_dimension) {
    const tf = validateIdent(config.time_dimension.field);
    const gran = validateIdent(config.time_dimension.granularity);
    selectParts.push(`date_trunc('${gran}', ${tf}) AS time_bucket`);
  }

  // Dimensions
  if (config.dimensions) {
    for (const dim of config.dimensions) {
      const f = validateIdent(dim.field);
      const alias = dim.alias ? validateIdent(dim.alias) : f;
      selectParts.push(alias === f ? f : `${f} AS ${alias}`);
    }
  }

  // Measures
  for (const m of config.measures) {
    const f = validateIdent(m.field);
    const alias = m.alias ? validateIdent(m.alias) : `${m.agg}_${f}`;
    if (m.agg === 'count') {
      selectParts.push(`COUNT(${f}) AS ${validateIdent(alias)}`);
    } else {
      selectParts.push(`${m.agg.toUpperCase()}(${f}) AS ${validateIdent(alias)}`);
    }
  }

  if (selectParts.length === 0) throw badRequest('Query must have at least one measure');

  // Build WHERE
  const whereParts: string[] = [];
  if (config.filters) {
    for (const f of config.filters) {
      whereParts.push(buildFilterSql(f));
    }
  }

  // Apply date range to time dimension
  if (config.date_range && config.time_dimension) {
    const range = resolveDateRange(config.date_range);
    if (range) {
      const tf = validateIdent(config.time_dimension.field);
      whereParts.push(`${tf} >= '${range.start}'`);
      whereParts.push(`${tf} <= '${range.end}'`);
    }
  }

  // Build GROUP BY
  const groupByParts: string[] = [];
  if (config.time_dimension) groupByParts.push('time_bucket');
  if (config.dimensions) {
    for (const dim of config.dimensions) {
      groupByParts.push(validateIdent(dim.field));
    }
  }

  // Build ORDER BY
  let orderBy = '';
  if (config.sort && config.sort.length > 0) {
    const sortParts = config.sort.map((s) => {
      const f = validateIdent(s.field);
      return `${f} ${s.dir === 'desc' ? 'DESC' : 'ASC'}`;
    });
    orderBy = `ORDER BY ${sortParts.join(', ')}`;
  } else if (config.time_dimension) {
    orderBy = 'ORDER BY time_bucket ASC';
  }

  // Build LIMIT
  const limit = Math.min(config.limit ?? 1000, 10000);

  // Assemble query
  let q = `SELECT ${selectParts.join(', ')} FROM ${table}`;
  if (whereParts.length > 0) q += ` WHERE ${whereParts.join(' AND ')}`;
  if (groupByParts.length > 0) q += ` GROUP BY ${groupByParts.join(', ')}`;
  if (orderBy) q += ` ${orderBy}`;
  q += ` LIMIT ${limit}`;

  return q;
}

export async function executeQuery(
  product: string,
  entity: string,
  config: QueryConfig,
): Promise<{ rows: Record<string, unknown>[]; sql: string; duration_ms: number }> {
  const queryStr = buildQuery(product, entity, config);
  const start = Date.now();

  try {
    const result = await readDb.execute(
      sql.raw(`SET LOCAL statement_timeout = '${env.QUERY_TIMEOUT_MS}ms'; ${queryStr}`),
    );
    const duration_ms = Date.now() - start;
    return {
      rows: Array.isArray(result) ? (result as Record<string, unknown>[]) : [],
      sql: queryStr,
      duration_ms,
    };
  } catch (err: any) {
    if (err.message?.includes('statement timeout')) {
      throw badRequest('Query exceeded timeout. Try narrowing your filters or reducing the date range.');
    }
    throw err;
  }
}
