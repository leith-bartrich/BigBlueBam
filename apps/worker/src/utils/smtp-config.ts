// SMTP config resolver.
//
// Looks up SMTP settings with this precedence:
//
//   1. system_settings rows (smtp_host / smtp_port / smtp_user /
//      smtp_password / smtp_from / smtp_secure) — editable from the Bam
//      SuperUser Settings → Email section.
//   2. Environment variables (SMTP_HOST / SMTP_PORT / SMTP_USER /
//      SMTP_PASS / EMAIL_FROM) — baked in at deploy time via the deploy
//      script or the Railway service Variables tab.
//
// Per-key fallback: if the operator has filled in some DB values and left
// others empty, the empty ones fall back to env vars individually. That
// way an operator can, for example, put the SMTP host + user in the UI
// and keep the password in env vars without having to mirror the whole
// config in both places.
//
// The result is cached in-process for 30 seconds so every email job
// doesn't hammer postgres. The cache is invalidated on a per-process
// basis; there's no pub/sub for "SMTP settings changed" events, so a
// change in the UI takes up to 30 seconds to propagate to worker
// processes. That's fine for transactional email — operators changing
// SMTP settings don't expect instant propagation.

import { sql } from 'drizzle-orm';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedSmtpConfig {
  value: ResolvedSmtpConfig | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
let cache: CachedSmtpConfig | null = null;

/** Drop the cache. Call this if you need to force a re-read (e.g. in tests). */
export function clearSmtpConfigCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Resolved shape
// ---------------------------------------------------------------------------

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  user: string | null;
  pass: string | null;
  from: string;
  secure: boolean;
  source: 'db' | 'env' | 'mixed';
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Type of the drizzle db instance. We accept any value that has an
 * `execute()` method returning `{ rows: Array<{key, value}> }` so both
 * postgres-js and node-postgres drivers work.
 */
type DbLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function parseStringOrNumberToInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * Load SMTP-related rows from `system_settings` as a plain object keyed by
 * the setting name. Returns an empty object on any error (so we fall
 * through cleanly to env vars).
 *
 * The system_settings `value` column stores JSON-stringified values — the
 * PUT route wraps whatever the operator submits in JSON.stringify() — so
 * we need to JSON.parse each row's value.
 */
async function loadDbSettings(db: DbLike): Promise<Record<string, unknown>> {
  const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_secure'] as const;
  try {
    const result = await db.execute(
      sql`SELECT key, value FROM system_settings WHERE key IN (${sql.join(
        SMTP_KEYS.map((k) => sql`${k}`),
        sql`, `,
      )})`,
    );
    // drizzle + postgres-js returns { rows: [...] } OR a plain array
    // depending on driver config; accept both.
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as { key?: string; value?: unknown };
      if (typeof r.key !== 'string') continue;
      let parsed: unknown = r.value;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // Value wasn't valid JSON — treat the raw string as the value.
        }
      }
      out[r.key] = parsed;
    }
    return out;
  } catch {
    // If the DB lookup fails for any reason (table missing on a fresh
    // deploy, network blip, RLS violation), don't crash the worker —
    // fall through to env vars.
    return {};
  }
}

/**
 * Resolve the effective SMTP config. Returns `null` if neither the DB
 * nor env vars have enough info to connect (host is the minimum).
 */
export async function getSmtpConfig(
  db: DbLike,
  env: Env,
): Promise<ResolvedSmtpConfig | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  const dbSettings = await loadDbSettings(db);

  const dbHost = typeof dbSettings.smtp_host === 'string' ? dbSettings.smtp_host : null;
  const dbPort = parseStringOrNumberToInt(dbSettings.smtp_port);
  const dbUser = typeof dbSettings.smtp_user === 'string' ? dbSettings.smtp_user : null;
  const dbPass = typeof dbSettings.smtp_password === 'string' ? dbSettings.smtp_password : null;
  const dbFrom = typeof dbSettings.smtp_from === 'string' ? dbSettings.smtp_from : null;
  const dbSecure = parseBoolean(dbSettings.smtp_secure);

  const host = dbHost ?? env.SMTP_HOST ?? null;
  if (!host) {
    cache = { value: null, expiresAt: now + CACHE_TTL_MS };
    return null;
  }

  const port = dbPort ?? env.SMTP_PORT;
  const user = dbUser ?? env.SMTP_USER ?? null;
  const pass = dbPass ?? env.SMTP_PASS ?? null;
  const from = dbFrom ?? env.EMAIL_FROM;
  // Default secure=true on port 465, false otherwise — matches nodemailer's
  // recommendation and the existing email.job.ts heuristic.
  const secure = dbSecure ?? port === 465;

  // Classify the source for logging.
  const anyFromDb = Boolean(dbHost || dbPort !== null || dbUser || dbPass || dbFrom || dbSecure !== null);
  const anyFromEnv = Boolean(env.SMTP_HOST || env.SMTP_USER || env.SMTP_PASS);
  let source: ResolvedSmtpConfig['source'] = 'env';
  if (anyFromDb && !anyFromEnv) source = 'db';
  else if (anyFromDb && anyFromEnv) source = 'mixed';
  else if (!anyFromDb && anyFromEnv) source = 'env';
  else source = 'env';

  const resolved: ResolvedSmtpConfig = { host, port, user, pass, from, secure, source };
  cache = { value: resolved, expiresAt: now + CACHE_TTL_MS };
  return resolved;
}
