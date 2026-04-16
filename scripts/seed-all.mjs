#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Master seed orchestrator.
 *
 * Resolves the target organization once, then invokes every per-app seeder
 * in dependency phases. Child seeders receive SEED_ORG_SLUG and
 * BBB_SEED_ORG_ID via the environment so they do not have to repeat the
 * lookup.
 *
 * Phase A: seed-platform.mjs          (must succeed; everything depends on users/projects/tasks)
 * Phase B: per-app seeders            (non-fatal on failure, run serially for log clarity)
 * Phase C: seed-banter.mjs + seed-helpdesk.mjs  (depend on Phase A users)
 * Phase D: seed-acme-scenario.mjs     (cross-app chain across every prior phase)
 *
 * Missing child scripts are skipped with a warning so the orchestrator
 * degrades gracefully during rollout.
 *
 * Usage:
 *   DATABASE_URL=... SEED_ORG_SLUG=mage-inc node scripts/seed-all.mjs
 *   # or from the seed sidecar:
 *   docker compose --profile seed run --rm seed
 */

import postgres from 'postgres';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL env var is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 2 });

// Tables we report row counts for at the end. These are the visible
// surface per surface. A missing table is tolerated (we log 'n/a') so
// the orchestrator still runs on a stack that has not applied every
// Wave 2 migration yet.
const REPORT_TABLES = [
  'users',
  'projects',
  'tasks',
  'sprints',
  'beacon_entries',
  'beacon_comments',
  'beacon_attachments',
  'bearing_goals',
  'banter_channels',
  'banter_messages',
  'banter_user_presence',
  'tickets',
  'helpdesk_ticket_attachments',
  'bond_companies',
  'bond_contacts',
  'bond_deals',
  'bond_import_mappings',
  'bolt_automations',
  'book_events',
  'blast_campaigns',
  'blank_forms',
  'bench_saved_reports',
  'bill_invoices',
  'brief_documents',
];

// Phase ordering. Each entry is the basename under scripts/.
// Phase A is fatal on failure; Phases B/C/D collect errors and continue.
const PHASE_A = ['seed-platform.mjs'];

const PHASE_B = [
  'seed-beacons.js',
  'seed-bearing.mjs',
  'seed-bill.mjs',
  'seed-bench.sql',
  'seed-blank.sql',
  'seed-blast.sql',
  'seed-board.sql',
  'seed-bolt.sql',
  'seed-bond.sql',
  'seed-book.sql',
  'seed-brief.js',
];

const PHASE_C = ['seed-banter.mjs', 'seed-helpdesk.mjs'];

const PHASE_D = ['seed-acme-scenario.mjs'];

// ─── helpers ──────────────────────────────────────────────────────────────

async function fileExists(p) {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

function spawnJs(absPath, env) {
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [absPath], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => resolveP(code ?? 1));
    child.on('error', (err) => {
      console.error(`  spawn error: ${err.message}`);
      resolveP(1);
    });
  });
}

/**
 * Run a .sql seed file via postgres-js. Substitute any :org_id,
 * :user_1..:user_N placeholders with real UUIDs from the caller-supplied
 * context. If the file uses hardcoded UUIDs (the historical pattern) the
 * substitution is a no-op and the statement runs as-is.
 */
async function runSqlSeed(absPath, ctx) {
  let body = await readFile(absPath, 'utf8');

  // Substitute :org_id first so it never accidentally eats :org_id_backup
  // or similar names. Use a word-boundary-aware replace.
  body = body.replace(/:org_id\b/g, `'${ctx.orgId}'::uuid`);

  // :user_1 .. :user_N - round-robin through the available user pool.
  body = body.replace(/:user_(\d+)\b/g, (_m, n) => {
    const idx = (Number(n) - 1) % Math.max(1, ctx.userIds.length);
    const uid = ctx.userIds[idx] ?? ctx.userIds[0];
    return `'${uid}'::uuid`;
  });

  // postgres-js .unsafe executes raw SQL including multiple statements.
  await sql.unsafe(body);
}

async function runChild(name, phase, ctx) {
  const absPath = resolve(SCRIPTS_DIR, name);
  if (!(await fileExists(absPath))) {
    console.log(`  SKIP ${name}: not found on disk`);
    return { name, status: 'skipped', reason: 'not-found', durationMs: 0 };
  }

  const ext = extname(name);
  const started = Date.now();
  let code = 0;
  let errMsg = null;

  try {
    if (ext === '.mjs' || ext === '.js') {
      code = await spawnJs(absPath, {
        SEED_ORG_SLUG: ctx.orgSlug,
        BBB_SEED_ORG_ID: ctx.orgId,
      });
    } else if (ext === '.sql') {
      await runSqlSeed(absPath, ctx);
      code = 0;
    } else {
      console.log(`  SKIP ${name}: unsupported extension ${ext}`);
      return { name, status: 'skipped', reason: 'bad-ext', durationMs: 0 };
    }
  } catch (err) {
    code = 1;
    errMsg = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - started;
  const secs = (durationMs / 1000).toFixed(1);
  if (code === 0) {
    console.log(`  OK ${name} (${secs}s)`);
    return { name, status: 'ok', durationMs };
  }
  console.log(`  FAIL ${name} (${secs}s): exit ${code}${errMsg ? ` - ${errMsg}` : ''}`);
  return { name, status: 'fail', reason: errMsg ?? `exit ${code}`, durationMs, phase };
}

async function resolveOrg() {
  const orgSlug =
    process.env.SEED_ORG_SLUG ??
    process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];

  const [org] = orgSlug
    ? await sql`SELECT id, name, slug FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    : await sql`SELECT id, name, slug FROM organizations ORDER BY created_at LIMIT 1`;

  if (!org) {
    console.error('FATAL: no org found. Run `create-admin` first.');
    await sql.end({ timeout: 2 });
    process.exit(1);
  }
  return org;
}

async function resolveUserPool(orgId) {
  // Round-robin pool used when substituting :user_N placeholders in .sql
  // seed files. Returns whatever users exist today in creation order.
  const rows = await sql`
    SELECT id FROM users
    WHERE org_id = ${orgId} AND is_active = true
    ORDER BY created_at
    LIMIT 20
  `;
  return rows.map((r) => r.id);
}

async function tableRowCount(name) {
  try {
    const rows = await sql.unsafe(`SELECT COUNT(*)::int AS n FROM "${name}"`);
    return rows[0]?.n ?? 0;
  } catch {
    return null; // table missing on this stack
  }
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(72));
  console.log('BigBlueBam master seed orchestrator');
  console.log('='.repeat(72));

  const org = await resolveOrg();
  console.log(`Seeding into org: ${org.name} (${org.slug}) ${org.id}`);

  // Phase A user pool is going to grow when seed-platform runs, but we need
  // a starter set to substitute placeholders for any Phase B SQL file that
  // references :user_N. After Phase A completes we re-read the pool so
  // later phases see the fuller roster.
  let userIds = await resolveUserPool(org.id);
  const baseCtx = () => ({ orgSlug: org.slug, orgId: org.id, userIds });

  const results = [];

  // ── Phase A ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('─── Phase A: platform ──────────────────────────────────────');
  for (const name of PHASE_A) {
    const res = await runChild(name, 'A', baseCtx());
    results.push(res);
    if (res.status === 'fail') {
      console.error('');
      console.error(`Phase A script ${name} failed. Aborting subsequent phases.`);
      console.error('Nothing else can reliably seed without platform users + projects.');
      await sql.end({ timeout: 2 });
      process.exit(1);
    }
  }
  // Refresh the user pool after Phase A adds the named users.
  userIds = await resolveUserPool(org.id);

  // ── Phase B ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('─── Phase B: per-app seeders ──────────────────────────────');
  for (const name of PHASE_B) {
    results.push(await runChild(name, 'B', baseCtx()));
  }

  // ── Phase C ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('─── Phase C: cross-user surfaces (banter + helpdesk) ──────');
  for (const name of PHASE_C) {
    results.push(await runChild(name, 'C', baseCtx()));
  }

  // ── Phase D ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('─── Phase D: Acme cross-app scenario ──────────────────────');
  for (const name of PHASE_D) {
    results.push(await runChild(name, 'D', baseCtx()));
  }

  // ── Row count summary ───────────────────────────────────────────────────
  console.log('');
  console.log('─── Rowcount summary ──────────────────────────────────────');
  for (const t of REPORT_TABLES) {
    const n = await tableRowCount(t);
    console.log(`  rowcount: ${t}=${n ?? 'n/a'}`);
  }

  // ── Final status ────────────────────────────────────────────────────────
  const fails = results.filter((r) => r.status === 'fail');
  const skips = results.filter((r) => r.status === 'skipped');
  console.log('');
  console.log('─── Seed run complete ─────────────────────────────────────');
  console.log(`  ok:      ${results.filter((r) => r.status === 'ok').length}`);
  console.log(`  skipped: ${skips.length}`);
  console.log(`  failed:  ${fails.length}`);
  for (const f of fails) {
    console.log(`    - ${f.name} (phase ${f.phase}): ${f.reason}`);
  }

  await sql.end({ timeout: 2 });

  // Phase A failure already exited above. A non-fatal Phase B/C/D failure
  // still returns 0 so CI-style runs can continue; operators see the
  // failure list in the log.
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FATAL:', err instanceof Error ? err.stack ?? err.message : err);
  try {
    await sql.end({ timeout: 2 });
  } catch {
    // ignore
  }
  process.exit(1);
});
