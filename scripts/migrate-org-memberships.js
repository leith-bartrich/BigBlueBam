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
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Usage: DATABASE_URL=postgres://... node scripts/migrate-org-memberships.js');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 5 });

async function migrate() {
  console.log('Starting organization_memberships migration...');

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

  // Fetch all users with their org_id and role
  const users = await sql`
    SELECT id, org_id, role FROM users WHERE org_id IS NOT NULL
  `;

  console.log(`Found ${users.length} users to migrate.`);

  let inserted = 0;
  let skipped = 0;

  for (const user of users) {
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

  console.log(`Migration complete: ${inserted} inserted, ${skipped} skipped (already existed).`);
}

try {
  await migrate();
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
