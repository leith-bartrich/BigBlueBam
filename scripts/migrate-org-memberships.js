#!/usr/bin/env node

/**
 * migrate-org-memberships.js
 *
 * Backfills the organization_memberships table from users.org_id and users.role.
 * Each user gets one row with is_default=true for their current org_id.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so it can be run multiple times safely.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/migrate-org-memberships.js
 *
 * Flags:
 *   --dry-run         Do not write any rows; print what would happen.
 *   --allow-orphans   Proceed even if users with NULL org_id or zero memberships
 *                     exist. Without this flag the script exits non-zero when
 *                     orphans are detected, so operators are forced to look.
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const ALLOW_ORPHANS = process.argv.includes('--allow-orphans');

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Usage: DATABASE_URL=postgres://... node scripts/migrate-org-memberships.js');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 5 });

async function migrate() {
  console.log(
    `Starting organization_memberships migration${DRY_RUN ? ' (DRY RUN — no writes)' : ''}...`,
  );

  // Ensure the table exists
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'organization_memberships'
    ) AS exists
  `;

  if (!tableCheck[0].exists) {
    console.error('ERROR: organization_memberships table does not exist. Run init.sql first.');
    process.exit(1);
  }

  // P2-16: detect orphans BEFORE touching anything. Two separate categories:
  //   (a) users with NULL org_id          → unfixable by this script
  //   (b) users with zero memberships     → fixable iff org_id is set
  // If either category is non-empty, dump the affected emails and exit 1
  // unless the operator explicitly passes --allow-orphans.
  const [{ count: nullOrgCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM users WHERE org_id IS NULL
  `;
  const [{ count: noMembershipCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_memberships om WHERE om.user_id = u.id
    )
  `;

  let nullUsers = [];
  if (nullOrgCount > 0) {
    console.warn(
      `WARNING: ${nullOrgCount} user(s) have NULL org_id — they cannot be ` +
        `backfilled by this script and must be assigned to an org manually.`,
    );
    nullUsers = await sql`
      SELECT id, email FROM users WHERE org_id IS NULL ORDER BY email
    `;
    for (const u of nullUsers) {
      console.warn(`  - NULL org_id: id=${u.id} email=${u.email}`);
    }
  }

  if (noMembershipCount > 0) {
    console.warn(
      `WARNING: ${noMembershipCount} user(s) have zero organization_memberships rows.`,
    );
    const noMemberUsers = await sql`
      SELECT u.id, u.email, u.org_id FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_memberships om WHERE om.user_id = u.id
      )
      ORDER BY u.email
    `;
    for (const u of noMemberUsers) {
      const where = u.org_id
        ? `will be backfilled to org_id=${u.org_id}`
        : 'cannot be backfilled (NULL org_id)';
      console.warn(`  - no memberships: id=${u.id} email=${u.email} — ${where}`);
    }
  }

  if ((nullOrgCount > 0 || noMembershipCount > 0) && !ALLOW_ORPHANS && !DRY_RUN) {
    console.error(
      '\nERROR: Orphaned users detected. Refusing to run without --allow-orphans.\n' +
        '       Re-run with --dry-run to preview, or --allow-orphans to backfill\n' +
        '       only the users that have a non-NULL users.org_id. Users with\n' +
        '       NULL org_id will still be skipped — resolve those manually.',
    );
    process.exit(1);
  }

  // Fetch all users with their org_id and role
  const users = await sql`
    SELECT id, org_id, role FROM users WHERE org_id IS NOT NULL
  `;

  console.log(`Found ${users.length} users to migrate.`);

  let inserted = 0;
  let skipped = 0;

  for (const user of users) {
    if (DRY_RUN) {
      // Check whether a row already exists to get an accurate preview count.
      const existing = await sql`
        SELECT 1 FROM organization_memberships
        WHERE user_id = ${user.id} AND org_id = ${user.org_id}
        LIMIT 1
      `;
      if (existing.length === 0) inserted++;
      else skipped++;
      continue;
    }

    const result = await sql`
      INSERT INTO organization_memberships (user_id, org_id, role, is_default, joined_at)
      VALUES (${user.id}, ${user.org_id}, ${user.role}, true, now())
      ON CONFLICT (user_id, org_id) DO NOTHING
    `;

    if (result.count > 0) {
      inserted++;
      if (inserted % 100 === 0) {
        console.log(`  ...inserted ${inserted} memberships so far`);
      }
    } else {
      skipped++;
    }
  }

  console.log(
    `Migration ${DRY_RUN ? 'preview' : 'complete'}: ` +
      `${inserted} ${DRY_RUN ? 'would be inserted' : 'inserted'}, ` +
      `${skipped} skipped (already existed), ` +
      `${nullUsers.length} user(s) with NULL org_id skipped entirely.`,
  );
}

try {
  await migrate();
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
