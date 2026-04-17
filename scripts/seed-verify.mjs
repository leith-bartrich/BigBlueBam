#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Post-seed verification script.
 *
 * Connects to the database, asserts minimum row counts per table, and exits
 * non-zero if any check fails.  Designed to run after `seed-all.mjs` to
 * confirm seed data is present.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/seed-verify.mjs
 *   # or via pnpm workspace shortcut:
 *   pnpm seed:verify
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL env var is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 2 });

// Minimum row counts expected after a successful seed run.
// If a table does not exist yet (migration not applied), the check is
// treated as a warning rather than a failure.
const EXPECTATIONS = [
  { table: 'organizations', min: 1 },
  { table: 'users', min: 6 },
  { table: 'projects', min: 2 },
  { table: 'tasks', min: 15 },
  { table: 'sprints', min: 2 },
  { table: 'beacon_entries', min: 100 },
  { table: 'beacon_comments', min: 5 },
  { table: 'bearing_goals', min: 4 },
  { table: 'banter_channels', min: 6 },
  { table: 'banter_messages', min: 10 },
  { table: 'tickets', min: 12 },
  { table: 'bond_companies', min: 3 },
  { table: 'bond_contacts', min: 5 },
  { table: 'bond_deals', min: 3 },
  { table: 'bolt_automations', min: 3 },
  { table: 'book_events', min: 2 },
  { table: 'blast_campaigns', min: 2 },
  { table: 'blank_forms', min: 2 },
  { table: 'bench_dashboards', min: 1 },
  { table: 'bill_invoices', min: 2 },
  { table: 'brief_documents', min: 2 },
];

async function getRowCount(table) {
  try {
    const rows = await sql.unsafe(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    return { count: rows[0]?.n ?? 0, exists: true };
  } catch {
    return { count: 0, exists: false };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('seed-verify: asserting minimum row counts');
  console.log('='.repeat(60));

  let failures = 0;
  let warnings = 0;
  let passes = 0;

  for (const { table, min } of EXPECTATIONS) {
    const { count, exists } = await getRowCount(table);

    if (!exists) {
      console.log(`  WARN  ${table.padEnd(30)} table missing (migration not applied?)`);
      warnings++;
      continue;
    }

    if (count < min) {
      console.log(`  FAIL  ${table.padEnd(30)} got ${count}, expected >= ${min}`);
      failures++;
    } else {
      console.log(`  OK    ${table.padEnd(30)} ${count} rows (>= ${min})`);
      passes++;
    }
  }

  console.log('');
  console.log(`Results: ${passes} passed, ${failures} failed, ${warnings} warnings`);

  await sql.end({ timeout: 2 });

  if (failures > 0) {
    console.error(`FAIL: ${failures} table(s) below minimum row count.`);
    process.exit(1);
  }

  console.log('All seed verification checks passed.');
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
