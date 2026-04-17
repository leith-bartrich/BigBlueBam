#!/usr/bin/env node

/**
 * Seed script for the Bearing (Goals & OKRs) app.
 * Populates the database with realistic demo data including periods,
 * goals, key results, watchers, updates, and historical snapshots.
 *
 * Usage: node scripts/seed-bearing.mjs
 *
 * Requires a running PostgreSQL with the Bearing schema applied.
 * Uses DATABASE_URL env var or defaults to local dev connection.
 */

import postgres from 'postgres';
import crypto from 'node:crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/bigbluebam';

const sql = postgres(DATABASE_URL);

// ─── helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Calculate KR progress percentage based on direction, start, target, current */
function krProgress(direction, startVal, targetVal, currentVal) {
  if (direction === 'decrease') {
    if (startVal === targetVal) return currentVal <= targetVal ? 100 : 0;
    const pct = ((startVal - currentVal) / (startVal - targetVal)) * 100;
    return clamp(Math.round(pct * 100) / 100, 0, 100);
  }
  if (targetVal === startVal) return currentVal >= targetVal ? 100 : 0;
  const pct = ((currentVal - startVal) / (targetVal - startVal)) * 100;
  return clamp(Math.round(pct * 100) / 100, 0, 100);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Bearing seed: connecting to database...');

  // 1. Look up the target organization (honors SEED_ORG_SLUG env / --org-slug=
  // CLI flag, else first-by-created-at).
  const orgSlug =
    process.env.SEED_ORG_SLUG ??
    process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];
  const orgs = orgSlug
    ? await sql`SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    : await sql`SELECT id, name FROM organizations ORDER BY created_at LIMIT 1`;
  if (orgs.length === 0) {
    console.error(
      `ERROR: No organization${orgSlug ? ` with slug "${orgSlug}"` : 's'} found. Run create-admin first.`,
    );
    process.exit(1);
  }
  const org = orgs[0];
  console.log(`Using organization: "${org.name}" (${org.id})`);

  // 2. Look up users who are members of this org (join through
  // organization_memberships so users whose primary users.org_id is
  // elsewhere but who have a membership here are included).
  const users = await sql`
    SELECT u.id, u.display_name
    FROM users u
    JOIN organization_memberships m ON m.user_id = u.id
    WHERE m.org_id = ${org.id} AND u.is_active = true
    ORDER BY m.joined_at
    LIMIT 10
  `;
  if (users.length === 0) {
    console.error('ERROR: No active users found in the organization. Create users first.');
    process.exit(1);
  }
  console.log(`Found ${users.length} users: ${users.map((u) => u.display_name).join(', ')}`);

  const creatorId = users[0].id;
  const ownerIds = users.map((u) => u.id);

  // Look up a project for the project-scoped goal
  const projects = await sql`
    SELECT id, name FROM projects WHERE org_id = ${org.id} LIMIT 1
  `;
  const projectId = projects.length > 0 ? projects[0].id : null;
  if (projectId) {
    console.log(`Using project: "${projects[0].name}" for project-scoped goal`);
  } else {
    console.log('No projects found; project-scoped goal will use org scope instead.');
  }

  // ─── counters ─────────────────────────────────────────────────────────────
  let periodCount = 0;
  let goalCount = 0;
  let krCount = 0;
  let watcherCount = 0;
  let updateCount = 0;
  let snapshotCount = 0;

  // ─── periods ──────────────────────────────────────────────────────────────

  let periodQ2Id = uuid();
  let periodQ1Id = uuid();
  let periodH2Id = uuid();

  const periodsData = [
    { id: periodQ2Id, name: 'Q2 2026', period_type: 'quarter', starts_at: '2026-04-01', ends_at: '2026-06-30', status: 'active' },
    { id: periodQ1Id, name: 'Q1 2026', period_type: 'quarter', starts_at: '2026-01-01', ends_at: '2026-03-31', status: 'completed' },
    { id: periodH2Id, name: 'H2 2026', period_type: 'half', starts_at: '2026-07-01', ends_at: '2026-12-31', status: 'planning' },
  ];

  for (const p of periodsData) {
    const res = await sql`
      INSERT INTO bearing_periods (id, organization_id, name, period_type, starts_at, ends_at, status, created_by)
      VALUES (${p.id}, ${org.id}, ${p.name}, ${p.period_type}, ${p.starts_at}, ${p.ends_at}, ${p.status}, ${creatorId})
      ON CONFLICT (organization_id, name) DO NOTHING
      RETURNING id
    `;
    if (res.length > 0) {
      periodCount++;
    } else {
      // Period already existed; look up the canonical id so downstream
      // inserts that reference p.id still find it.
      const [existing] = await sql`
        SELECT id FROM bearing_periods WHERE organization_id = ${org.id} AND name = ${p.name} LIMIT 1
      `;
      if (existing) p.id = existing.id;
    }
  }

  // After the loop the three id slots point at the real rows (new or
  // pre-existing). Re-export them so the goalsSpec references resolve.
  const [pQ2, pQ1, pH2] = periodsData;
  periodQ2Id = pQ2.id;
  periodQ1Id = pQ1.id;
  periodH2Id = pH2.id;

  // ─── goals and key results ────────────────────────────────────────────────

  const goalsSpec = [
    // === Q2 2026 goals ===
    {
      period_id: periodQ2Id,
      title: 'Increase Platform Adoption',
      scope: 'organization',
      status: 'on_track',
      progress: 65,
      icon: '\u{1F680}',
      color: '#4F46E5',
      owner_idx: 0,
      keyResults: [
        { title: 'Reach 500 monthly active users', metric_type: 'number', target_value: 500, current_value: 325, start_value: 100, unit: 'users', direction: 'increase' },
        { title: 'Achieve 85% weekly retention rate', metric_type: 'percentage', target_value: 85, current_value: 72, start_value: 50, unit: null, direction: 'increase' },
        { title: 'Launch self-service onboarding flow', metric_type: 'boolean', target_value: 1, current_value: 0, start_value: 0, unit: null, direction: 'increase' },
      ],
      update: { body: 'Good progress on user acquisition. Onboarding flow design in review.', daysAgo: 14 },
    },
    {
      period_id: periodQ2Id,
      title: 'Improve Engineering Velocity',
      scope: 'team',
      team_name: 'Engineering',
      status: 'at_risk',
      progress: 40,
      icon: '\u26A1',
      color: '#0891B2',
      owner_idx: 1,
      keyResults: [
        { title: 'Reduce average cycle time to 3 days', metric_type: 'number', target_value: 3, current_value: 4.2, start_value: 6, unit: 'days', direction: 'decrease' },
        { title: 'Increase sprint velocity to 45 points', metric_type: 'number', target_value: 45, current_value: 38, start_value: 30, unit: 'points', direction: 'increase' },
        { title: 'Zero critical bugs in production', metric_type: 'number', target_value: 0, current_value: 2, start_value: 5, unit: null, direction: 'decrease' },
      ],
      update: { body: 'Cycle time still high \u2014 investigating blockers in code review process.', daysAgo: 7 },
    },
    {
      period_id: periodQ2Id,
      title: 'Launch Customer Portal v2',
      scope: projectId ? 'project' : 'organization',
      project_id: projectId,
      status: 'on_track',
      progress: 55,
      icon: '\u{1F3AF}',
      color: '#059669',
      owner_idx: 2 % ownerIds.length,
      keyResults: [
        { title: 'Complete all portal redesign tickets', metric_type: 'percentage', target_value: 100, current_value: 55, start_value: 0, unit: null, direction: 'increase' },
        { title: 'Pass security audit with zero P1 findings', metric_type: 'number', target_value: 0, current_value: 0, start_value: 3, unit: null, direction: 'decrease' },
        { title: 'Achieve 90% positive feedback score', metric_type: 'percentage', target_value: 90, current_value: 0, start_value: 0, unit: null, direction: 'increase' },
      ],
    },
    {
      period_id: periodQ2Id,
      title: 'Strengthen Team Knowledge Base',
      scope: 'organization',
      status: 'behind',
      progress: 20,
      icon: '\u{1F4DA}',
      color: '#D97706',
      owner_idx: 3 % ownerIds.length,
      keyResults: [
        { title: 'Publish 50 Beacon articles', metric_type: 'number', target_value: 50, current_value: 12, start_value: 0, unit: 'articles', direction: 'increase' },
        { title: 'Achieve 80% search satisfaction', metric_type: 'percentage', target_value: 80, current_value: 45, start_value: 20, unit: null, direction: 'increase' },
      ],
      update: { body: 'Behind schedule on article publishing. Scheduling knowledge sprint next week.', daysAgo: 3 },
    },
    {
      period_id: periodQ2Id,
      title: 'Establish Workflow Automation',
      scope: 'organization',
      status: 'achieved',
      progress: 100,
      icon: '\u2699\uFE0F',
      color: '#7C3AED',
      owner_idx: 4 % ownerIds.length,
      keyResults: [
        { title: 'Deploy 10 Bolt automations', metric_type: 'number', target_value: 10, current_value: 12, start_value: 0, unit: 'automations', direction: 'increase' },
        { title: 'Reduce manual task routing by 80%', metric_type: 'percentage', target_value: 80, current_value: 85, start_value: 0, unit: null, direction: 'increase' },
      ],
    },
    // === Q1 2026 goals (completed period) ===
    {
      period_id: periodQ1Id,
      title: 'Ship MVP to Beta Users',
      scope: 'organization',
      status: 'achieved',
      progress: 100,
      icon: '\u{1F680}',
      color: '#10B981',
      owner_idx: 0,
      keyResults: [
        { title: 'Complete all Phase 1 features', metric_type: 'percentage', target_value: 100, current_value: 100, start_value: 0, unit: null, direction: 'increase' },
        { title: 'Onboard 20 beta users', metric_type: 'number', target_value: 20, current_value: 23, start_value: 0, unit: 'users', direction: 'increase' },
      ],
    },
    {
      period_id: periodQ1Id,
      title: 'Build Core Infrastructure',
      scope: 'organization',
      status: 'achieved',
      progress: 95,
      icon: '\u{1F3D7}\uFE0F',
      color: '#6366F1',
      owner_idx: 1 % ownerIds.length,
      keyResults: [
        { title: 'Set up CI/CD pipeline', metric_type: 'boolean', target_value: 1, current_value: 1, start_value: 0, unit: null, direction: 'increase' },
        { title: 'Achieve 95% uptime SLA', metric_type: 'percentage', target_value: 95, current_value: 97, start_value: 0, unit: null, direction: 'increase' },
      ],
    },
  ];

  const goalIds = []; // track for watchers
  const activeKrSpecs = []; // track KRs in active period for snapshots

  for (const g of goalsSpec) {
    const goalId = uuid();

    // Check if goal already exists (by title + period)
    const existing = await sql`
      SELECT id FROM bearing_goals
      WHERE period_id = ${g.period_id} AND title = ${g.title}
      LIMIT 1
    `;

    let effectiveGoalId;
    if (existing.length > 0) {
      effectiveGoalId = existing[0].id;
      console.log(`  Goal already exists: "${g.title}" - skipping`);
    } else {
      await sql`
        INSERT INTO bearing_goals (
          id, organization_id, period_id, scope, project_id, team_name,
          title, icon, color, status, status_override, progress,
          owner_id, created_by
        ) VALUES (
          ${goalId}, ${org.id}, ${g.period_id}, ${g.scope}, ${g.project_id || null}, ${g.team_name || null},
          ${g.title}, ${g.icon}, ${g.color}, ${g.status}, true, ${g.progress / 100},
          ${ownerIds[g.owner_idx]}, ${creatorId}
        )
      `;
      effectiveGoalId = goalId;
      goalCount++;
      console.log(`  + Goal: "${g.title}" (${g.status}, ${g.progress}%)`);
    }

    goalIds.push(effectiveGoalId);

    // Key results
    for (let i = 0; i < g.keyResults.length; i++) {
      const kr = g.keyResults[i];
      const krId = uuid();
      const progress = krProgress(kr.direction, kr.start_value, kr.target_value, kr.current_value);

      const existingKr = await sql`
        SELECT id FROM bearing_key_results
        WHERE goal_id = ${effectiveGoalId} AND title = ${kr.title}
        LIMIT 1
      `;

      let effectiveKrId;
      if (existingKr.length > 0) {
        effectiveKrId = existingKr[0].id;
      } else {
        await sql`
          INSERT INTO bearing_key_results (
            id, goal_id, title, metric_type, target_value, current_value, start_value,
            unit, direction, progress, owner_id, sort_order
          ) VALUES (
            ${krId}, ${effectiveGoalId}, ${kr.title}, ${kr.metric_type},
            ${kr.target_value}, ${kr.current_value}, ${kr.start_value},
            ${kr.unit}, ${kr.direction}, ${progress / 100},
            ${ownerIds[(g.owner_idx + i) % ownerIds.length]}, ${i}
          )
        `;
        effectiveKrId = krId;
        krCount++;
      }

      // Track active-period KRs for snapshot generation
      if (g.period_id === periodQ2Id) {
        activeKrSpecs.push({
          id: effectiveKrId,
          start_value: kr.start_value,
          current_value: kr.current_value,
          target_value: kr.target_value,
          direction: kr.direction,
          isNew: existingKr.length === 0,
        });
      }
    }

    // Update (status note)
    if (g.update) {
      const existingUpdate = await sql`
        SELECT id FROM bearing_updates
        WHERE goal_id = ${effectiveGoalId} AND body = ${g.update.body}
        LIMIT 1
      `;
      if (existingUpdate.length === 0) {
        await sql`
          INSERT INTO bearing_updates (
            id, goal_id, author_id, status, status_at_time, progress_at_time, body, created_at
          )
          VALUES (
            ${uuid()}, ${effectiveGoalId}, ${ownerIds[g.owner_idx]}, ${g.status},
            ${g.status}, ${g.progress / 100}, ${g.update.body}, ${daysAgo(g.update.daysAgo)}
          )
        `;
        updateCount++;
      }
    }
  }

  // ─── watchers ─────────────────────────────────────────────────────────────

  // Add watchers to the first 3 goals (Q2 goals)
  const watchGoals = goalIds.slice(0, 3);
  for (let gi = 0; gi < watchGoals.length; gi++) {
    // Each goal gets 2-3 watchers (different from owner)
    const watcherUserIds = ownerIds
      .filter((_, idx) => idx !== gi) // exclude goal owner
      .slice(0, gi + 2); // 2, 3, 4 watchers respectively

    for (const uid of watcherUserIds) {
      const res = await sql`
        INSERT INTO bearing_goal_watchers (id, goal_id, user_id)
        VALUES (${uuid()}, ${watchGoals[gi]}, ${uid})
        ON CONFLICT (goal_id, user_id) DO NOTHING
        RETURNING id
      `;
      if (res.length > 0) watcherCount++;
    }
  }

  // ─── snapshots (daily progress for active period KRs) ─────────────────────

  // Generate ~45 days of snapshots (March 1 to April 7 roughly)
  const snapshotDays = 45;

  for (const kr of activeKrSpecs) {
    // Check if snapshots already exist for this KR
    const existingSnapshots = await sql`
      SELECT COUNT(*)::int AS cnt FROM bearing_kr_snapshots
      WHERE key_result_id = ${kr.id}
    `;
    if (existingSnapshots[0].cnt > 5) {
      continue; // already has snapshots, skip
    }

    const rows = [];
    for (let d = snapshotDays; d >= 0; d--) {
      const t = 1 - d / snapshotDays; // 0..1 progress fraction over time
      // Add some noise to simulate realistic progress
      const noise = (Math.sin(d * 1.7) * 0.05 + Math.cos(d * 0.9) * 0.03);
      const effectiveT = clamp(t + noise, 0, 1);

      const value = Number(lerp(kr.start_value, kr.current_value, effectiveT).toFixed(2));
      const progress = krProgress(kr.direction, kr.start_value, kr.target_value, value);
      const recordedAt = daysAgo(d);

      rows.push({
        id: uuid(),
        key_result_id: kr.id,
        value,
        progress: progress / 100,
        recorded_at: recordedAt,
      });
    }

    // Bulk insert snapshots
    if (rows.length > 0) {
      await sql`
        INSERT INTO bearing_kr_snapshots ${sql(rows, 'id', 'key_result_id', 'value', 'progress', 'recorded_at')}
        ON CONFLICT DO NOTHING
      `;
      snapshotCount += rows.length;
    }
  }

  // ─── summary ──────────────────────────────────────────────────────────────

  console.log('');
  console.log('='.repeat(60));
  console.log(`Seeded ${periodCount} periods, ${goalCount} goals, ${krCount} key results, ${snapshotCount} snapshots`);
  console.log(`Added ${watcherCount} watchers, ${updateCount} status updates`);
  console.log('='.repeat(60));

  await sql.end();
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
