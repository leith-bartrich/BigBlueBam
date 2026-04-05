// SQL migration runner.
//
// Reads every file from MIGRATIONS_DIR in lexicographic order, applies any
// that have not yet been recorded in `schema_migrations`, and records their
// SHA-256 checksum. If a previously-applied migration's checksum has changed
// the runner aborts loudly — migrations must be append-only and immutable.
//
// NOTE: the checksum is computed over the SQL *body* — the leading block of
// `--` comment lines and blank lines is stripped before hashing. This lets
// maintainers edit the documented header (`-- Why:` / `-- Client impact:`)
// without invalidating the fingerprint. Any change to executable SQL still
// trips the mismatch guard. See `bodyChecksum()` below.
//
// Migration files are expected to be idempotent (IF NOT EXISTS, ADD COLUMN
// IF NOT EXISTS, etc.) so that re-running against a DB in an unknown state
// is safe. Each file is applied inside a single transaction; any error
// aborts that file and halts the runner.
//
// Intended to run as a one-shot container (docker-compose `migrate` service)
// that must complete successfully before api/helpdesk-api/banter-api/worker
// start. Running it against an already-up-to-date DB is a no-op.

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), 'migrations');

interface MigrationFile {
  id: string; // filename without .sql (e.g. "0001_baseline")
  filename: string;
  sql: string;
  checksum: string;
  // One-time migration aid: checksum of the full file (including the
  // header comment block). Older DBs recorded this form. If a stored
  // checksum matches `legacyChecksum` we re-stamp it to the new body
  // checksum in place rather than aborting.
  legacyChecksum: string;
}

interface AppliedRow {
  id: string;
  checksum: string;
  applied_at: Date;
}

// Compute the checksum over the SQL *body* only — i.e. strip the leading
// comment-only header (blank lines and lines starting with `--`) before
// hashing. This lets us edit/amend migration header blocks (the
// documented `-- Why:` / `-- Client impact:` fields, etc.) without
// triggering a checksum mismatch on already-applied migrations. Only the
// executable SQL is fingerprinted; changing any non-comment character
// will still abort the runner as intended.
function bodyChecksum(sql: string): string {
  const lines = sql.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '' || trimmed.startsWith('--')) {
      i++;
      continue;
    }
    break;
  }
  const body = lines.slice(i).join('\n');
  return createHash('sha256').update(body).digest('hex');
}

function loadMigrations(dir: string): MigrationFile[] {
  if (!existsSync(dir)) {
    throw new Error(
      `Migrations directory does not exist: ${dir}\n` +
        `Set MIGRATIONS_DIR or bundle the migrations/ folder into the image.`,
    );
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((filename) => {
    const fullPath = join(dir, filename);
    const sql = readFileSync(fullPath, 'utf8');
    const checksum = bodyChecksum(sql);
    const legacyChecksum = createHash('sha256').update(sql).digest('hex');
    return {
      id: filename.replace(/\.sql$/, ''),
      filename,
      sql,
      checksum,
      legacyChecksum,
    };
  });
}

async function ensureTrackingTable(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(sql: postgres.Sql): Promise<Map<string, AppliedRow>> {
  const rows = await sql<
    AppliedRow[]
  >`SELECT id, checksum, applied_at FROM schema_migrations`;
  const byId = new Map<string, AppliedRow>();
  for (const row of rows) byId.set(row.id, row);
  return byId;
}

async function applyMigration(
  sql: postgres.Sql,
  migration: MigrationFile,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx.unsafe(migration.sql);
    await tx`
      INSERT INTO schema_migrations (id, checksum)
      VALUES (${migration.id}, ${migration.checksum})
      ON CONFLICT (id) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()
    `;
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`[migrate] migrations dir: ${MIGRATIONS_DIR}`);
  const migrations = loadMigrations(MIGRATIONS_DIR);
  console.log(`[migrate] found ${migrations.length} migration file(s)`);

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await ensureTrackingTable(sql);
    const applied = await getApplied(sql);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const m of migrations) {
      const prior = applied.get(m.id);
      if (prior) {
        if (prior.checksum !== m.checksum) {
          // The recorded checksum may also be a legacy full-file hash
          // (from before body-only hashing was introduced). If it matches
          // the current full-file hash, the SQL body is unchanged — quiet
          // re-stamp. Otherwise, allow an opt-in rescue via env var for
          // the one-time header-addition rollout.
          if (prior.checksum === m.legacyChecksum) {
            console.log(
              `[migrate] re-stamping ${m.filename} (legacy full-file checksum → body-only)`,
            );
            await sql`
              UPDATE schema_migrations
              SET checksum = ${m.checksum}
              WHERE id = ${m.id}
            `;
            skippedCount++;
            continue;
          }
          if (process.env.MIGRATE_ALLOW_HEADER_RESTAMP === '1') {
            console.warn(
              `[migrate] MIGRATE_ALLOW_HEADER_RESTAMP=1 → re-stamping ${m.filename} ` +
                `(caller asserts SQL body unchanged; only header comments edited)`,
            );
            await sql`
              UPDATE schema_migrations
              SET checksum = ${m.checksum}
              WHERE id = ${m.id}
            `;
            skippedCount++;
            continue;
          }
          throw new Error(
            `[migrate] CHECKSUM MISMATCH on ${m.filename}\n` +
              `  recorded: ${prior.checksum}\n` +
              `  current:  ${m.checksum}\n` +
              `  Migrations are immutable (SQL body only; header comments are not hashed).\n` +
              `  If you only edited the header comment block and the SQL body is\n` +
              `  unchanged, rerun once with MIGRATE_ALLOW_HEADER_RESTAMP=1.\n` +
              `  Otherwise: create a new migration file to amend.`,
          );
        }
        skippedCount++;
        continue;
      }
      console.log(`[migrate] applying ${m.filename}`);
      await applyMigration(sql, m);
      appliedCount++;
    }

    console.log(
      `[migrate] done — ${appliedCount} applied, ${skippedCount} already up-to-date`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
