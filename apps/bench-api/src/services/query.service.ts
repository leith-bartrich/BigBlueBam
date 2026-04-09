import { readConnection } from '../db/index.js';
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
// Validation helpers
// ---------------------------------------------------------------------------

const ALLOWED_IDENTS = /^[a-z_][a-z0-9_]*$/;

/** Strict ISO 8601 date/datetime pattern — rejects anything that isn't a plain date or timestamp. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

function validateIdent(name: string): string {
  if (!ALLOWED_IDENTS.test(name)) {
    throw badRequest(`Invalid identifier: ${name}`);
  }
  return name;
}

function validateDateString(value: string): string {
  if (!ISO_DATE_RE.test(value)) {
    throw badRequest(`Invalid date value: ${value}`);
  }
  // Also verify it parses to a real date
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Invalid date value: ${value}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Parameterized query builder
// ---------------------------------------------------------------------------

/** Accumulates positional parameters ($1, $2, ...) alongside the SQL string. */
interface ParameterizedQuery {
  text: string;
  params: unknown[];
}

function addParam(pq: ParameterizedQuery, value: unknown): string {
  pq.params.push(value);
  return `$${pq.params.length}`;
}

function buildFilterClause(f: QueryFilter, pq: ParameterizedQuery): string {
  const field = validateIdent(f.field);
  switch (f.op) {
    case 'eq': return `${field} = ${addParam(pq, String(f.value))}`;
    case 'neq': return `${field} != ${addParam(pq, String(f.value))}`;
    case 'gt': return `${field} > ${addParam(pq, String(f.value))}`;
    case 'gte': return `${field} >= ${addParam(pq, String(f.value))}`;
    case 'lt': return `${field} < ${addParam(pq, String(f.value))}`;
    case 'lte': return `${field} <= ${addParam(pq, String(f.value))}`;
    case 'is_null': return `${field} IS NULL`;
    case 'is_not_null': return `${field} IS NOT NULL`;
    case 'in': {
      if (!Array.isArray(f.value)) throw badRequest('IN filter requires an array value');
      const placeholders = (f.value as unknown[]).map((v) => addParam(pq, String(v)));
      return `${field} IN (${placeholders.join(', ')})`;
    }
    case 'between': {
      if (!Array.isArray(f.value) || f.value.length !== 2) throw badRequest('BETWEEN requires [start, end]');
      return `${field} BETWEEN ${addParam(pq, String(f.value[0]))} AND ${addParam(pq, String(f.value[1]))}`;
    }
    case 'like': return `${field} ILIKE ${addParam(pq, `%${String(f.value).replace(/[%_\\]/g, '\\$&')}%`)}`;
    default: throw badRequest(`Unknown filter operator: ${f.op}`);
  }
}

function resolveDateRange(dr: DateRange): { start: string; end: string } | null {
  if (dr.start && dr.end) {
    return { start: validateDateString(dr.start), end: validateDateString(dr.end) };
  }
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

/**
 * Build a parameterized analytical query.
 *
 * @param orgId - The authenticated user's organization ID, always injected as
 *   a WHERE filter to enforce tenant isolation.
 */
export function buildQuery(
  product: string,
  entity: string,
  config: QueryConfig,
  orgId: string,
): ParameterizedQuery {
  const source = getDataSource(product, entity);
  if (!source) throw badRequest(`Unknown data source: ${product}.${entity}`);

  const table = validateIdent(source.baseTable);
  const pq: ParameterizedQuery = { text: '', params: [] };

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

  // Build WHERE — always starts with org_id tenant isolation
  const whereParts: string[] = [`organization_id = ${addParam(pq, orgId)}`];

  if (config.filters) {
    for (const f of config.filters) {
      whereParts.push(buildFilterClause(f, pq));
    }
  }

  // Apply date range to time dimension
  if (config.date_range && config.time_dimension) {
    const range = resolveDateRange(config.date_range);
    if (range) {
      const tf = validateIdent(config.time_dimension.field);
      whereParts.push(`${tf} >= ${addParam(pq, range.start)}`);
      whereParts.push(`${tf} <= ${addParam(pq, range.end)}`);
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
  q += ` WHERE ${whereParts.join(' AND ')}`;
  if (groupByParts.length > 0) q += ` GROUP BY ${groupByParts.join(', ')}`;
  if (orderBy) q += ` ${orderBy}`;
  q += ` LIMIT ${limit}`;

  pq.text = q;
  return pq;
}

export async function executeQuery(
  product: string,
  entity: string,
  config: QueryConfig,
  orgId: string,
): Promise<{ rows: Record<string, unknown>[]; sql: string; duration_ms: number }> {
  const pq = buildQuery(product, entity, config, orgId);
  const start = Date.now();

  try {
    // Run inside a transaction so SET LOCAL is scoped and automatically reset
    const result = await readConnection.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = '${Number(env.QUERY_TIMEOUT_MS)}ms'`);
      return tx.unsafe(pq.text, pq.params);
    });
    const duration_ms = Date.now() - start;
    return {
      rows: Array.isArray(result) ? (result as Record<string, unknown>[]) : [],
      sql: pq.text,
      duration_ms,
    };
  } catch (err: any) {
    if (err.message?.includes('statement timeout')) {
      throw badRequest('Query exceeded timeout. Try narrowing your filters or reducing the date range.');
    }
    throw err;
  }
}
