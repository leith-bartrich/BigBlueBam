#!/usr/bin/env node

/**
 * Seed script for the Helpdesk app.
 *
 * Populates one org's helpdesk with multi-tenant aware demo data covering
 * every Wave 2 addition plus the baseline schema:
 *
 *   - 2 helpdesk_users scoped to org_id (migration 0109/0110). One verified;
 *     the other carries email_verification_token_hash per migration 0113.
 *   - 1 helpdesk_settings row per org with sla_first_response_minutes=120
 *     and sla_resolution_minutes=1440 (migration 0111 columns).
 *   - 12 tickets spanning 6 status states (new, open, pending, resolved,
 *     closed, reopened) with a priority mix. Tied to the first project in
 *     the org (Mage if present).
 *   - Each ticket gets >=3 ticket_messages (requester/agent/requester).
 *     One ticket has 2 internal-only + 3 public messages.
 *   - 1 ticket with first-response SLA imminent (first_response_at NULL,
 *     created_at = now() - sla_first_response + 30 minutes).
 *   - 1 ticket with sla_breached_at set + a matching helpdesk_sla_breaches
 *     row (migration 0111).
 *   - 1 ticket with a helpdesk_ticket_attachments row (migration 0114).
 *   - 1 ticket cross-linked to a Bam task via tickets.task_id when
 *     available.
 *   - 3 tickets containing the word "billing" to exercise the G5 full-text
 *     search generated tsvector (migration 0112).
 *   - 5 helpdesk_ticket_events rows across varied event_types
 *     (migrations 0010 + 0115 Bolt-aware columns).
 *   - 1 helpdesk_agent_api_keys row for alice as the on-call agent.
 *
 * Idempotency model follows scripts/seed-bearing.mjs:
 *   - SELECT ... LIMIT 1 before INSERT for named rows.
 *   - ON CONFLICT DO NOTHING where a natural unique key exists.
 *   - NEVER DELETE FROM. Re-runs must be safe.
 *
 * Column names verified against:
 *   apps/helpdesk-api/src/db/schema/helpdesk-users.ts            (org_id, email_verification_token_hash)
 *   apps/helpdesk-api/src/db/schema/helpdesk-settings.ts         (sla_first_response_minutes, sla_resolution_minutes)
 *   apps/helpdesk-api/src/db/schema/tickets.ts                   (helpdesk_user_id, task_id, first_response_at, sla_breached_at)
 *   apps/helpdesk-api/src/db/schema/ticket-messages.ts           (author_type: customer|agent|system, author_id, author_name, body, is_internal)
 *   apps/helpdesk-api/src/db/schema/helpdesk-sla-breaches.ts     (sla_type, breached_at)
 *   apps/helpdesk-api/src/db/schema/helpdesk-ticket-attachments.ts (uploaded_by is helpdesk_users.id, filename, content_type, size_bytes, storage_key, scan_status)
 *   apps/helpdesk-api/src/db/schema/ticket-events.ts             (bigserial id, event_type, payload, bolt_event_id, bolt_event_emitted_at)
 *   apps/helpdesk-api/src/db/schema/helpdesk-agent-api-keys.ts   (bbb_user_id, name, key_hash, key_prefix)
 *
 * Ticket status labels: the schema column is free-form varchar(50) with
 * no DB CHECK. The live API validates against
 *   { open, in_progress, waiting_on_customer, resolved, closed }
 * but the seed intentionally uses the plan-mandated six labels
 *   { new, open, pending, resolved, closed, reopened }
 * so QA can exercise legacy + future label sets via direct DB inspection.
 * If this causes UI filter noise, fold any unrecognized labels into 'open'
 * at read time rather than editing this seed (see plan note).
 *
 * Usage:
 *   DATABASE_URL=... SEED_ORG_SLUG=mage-inc node scripts/seed-helpdesk.mjs
 *   node scripts/seed-helpdesk.mjs --org-slug=mage-inc
 *
 * Exits 0 with a one-line summary on success.
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

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** Dummy Argon2id-shaped string so password_hash.notNull is satisfied without
 *  pulling in argon2. The helpdesk auth layer never reads this seed row to
 *  match a login; it is only used to satisfy the column constraint. */
function placeholderHash() {
  return `$argon2id$v=19$m=65536,t=3,p=4$${crypto.randomBytes(16).toString('base64')}$${crypto.randomBytes(32).toString('base64')}`;
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60_000);
}

async function tableExists(name) {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${name}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function columnExists(table, column) {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Helpdesk seed: connecting to database...');

  const orgSlug =
    process.env.SEED_ORG_SLUG ??
    process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];
  const [org] = orgSlug
    ? await sql`SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    : await sql`SELECT id, name FROM organizations ORDER BY created_at LIMIT 1`;
  if (!org) {
    console.error('No org found, run create-admin first');
    process.exit(1);
  }
  console.log(`Using organization: "${org.name}" (${org.id})`);

  const users = await sql`
    SELECT id, email, display_name
    FROM users
    WHERE org_id = ${org.id}
    ORDER BY created_at
  `;
  if (users.length === 0) {
    console.error('No users in org; aborting helpdesk seed.');
    process.exit(1);
  }
  const alice = users[0];

  // Project to attach tickets to, preferring one named Mage.
  const projectRows = await sql`
    SELECT id, name
    FROM projects
    WHERE org_id = ${org.id}
    ORDER BY (CASE WHEN LOWER(name) LIKE '%mage%' THEN 0 ELSE 1 END), created_at
    LIMIT 1
  `;
  const projectId = projectRows.length > 0 ? projectRows[0].id : null;
  if (projectId) {
    console.log(`Attaching tickets to project: "${projectRows[0].name}"`);
  } else {
    console.log('No projects in org; tickets will carry project_id = NULL.');
  }

  // Optional: a Bam task in the same project for the cross-link demo.
  let crossLinkTaskId = null;
  if (projectId && (await tableExists('tasks'))) {
    const [row] = await sql`
      SELECT id FROM tasks WHERE project_id = ${projectId} ORDER BY created_at LIMIT 1
    `;
    crossLinkTaskId = row?.id ?? null;
  }

  // ─── counters ───────────────────────────────────────────────────────────────
  let helpdeskUserCount = 0;
  let ticketCount = 0;
  let messageCount = 0;
  let attachmentCount = 0;
  let breachCount = 0;
  let eventCount = 0;

  // ─── helpdesk_settings ──────────────────────────────────────────────────────
  const SLA_FIRST = 120; // minutes, per plan
  const SLA_RES = 1440;
  {
    const existing = await sql`
      SELECT id FROM helpdesk_settings WHERE org_id = ${org.id} LIMIT 1
    `;
    if (existing.length === 0) {
      await sql`
        INSERT INTO helpdesk_settings (
          id, org_id, sla_first_response_minutes, sla_resolution_minutes,
          require_email_verification, default_priority
        ) VALUES (
          ${uuid()}, ${org.id}, ${SLA_FIRST}, ${SLA_RES}, false, 'medium'
        )
      `;
      console.log(`  + helpdesk_settings (sla_first=${SLA_FIRST}m, sla_res=${SLA_RES}m)`);
    } else {
      // Make sure the SLA minutes match the plan values so the SLA-imminent math works out.
      await sql`
        UPDATE helpdesk_settings
        SET sla_first_response_minutes = ${SLA_FIRST},
            sla_resolution_minutes = ${SLA_RES},
            updated_at = now()
        WHERE org_id = ${org.id}
      `;
    }
  }

  // ─── helpdesk_users ─────────────────────────────────────────────────────────
  // Ellen (verified) and Juan (pending email verification with hashed token)
  const helpdeskUsersSpec = [
    {
      email: 'ellen@acme.example',
      display_name: 'Ellen Acme',
      email_verified: true,
      email_verification_token_hash: null,
    },
    {
      email: 'juan@beta.example',
      display_name: 'Juan Beta',
      email_verified: false,
      // 32-byte random token, store only its SHA-256 hex per migration 0113
      email_verification_token_hash: sha256Hex(crypto.randomBytes(32).toString('hex')),
    },
  ];

  const helpdeskUsersById = [];
  for (const spec of helpdeskUsersSpec) {
    // Scope the lookup by org_id so running the script twice against two
    // orgs does not collide on the global email index (0110 makes this
    // per-org-unique but some stacks may still have the legacy global index).
    const existing = await sql`
      SELECT id FROM helpdesk_users
      WHERE org_id = ${org.id} AND email = ${spec.email}
      LIMIT 1
    `;
    let hid;
    if (existing.length > 0) {
      hid = existing[0].id;
    } else {
      hid = uuid();
      const verifiedAt = spec.email_verified ? minutesAgo(60 * 24 * 3) : null;
      await sql`
        INSERT INTO helpdesk_users (
          id, org_id, email, display_name, password_hash,
          email_verified, email_verification_token_hash, email_verification_sent_at,
          is_active
        ) VALUES (
          ${hid}, ${org.id}, ${spec.email}, ${spec.display_name}, ${placeholderHash()},
          ${spec.email_verified}, ${spec.email_verification_token_hash},
          ${verifiedAt},
          true
        )
      `;
      helpdeskUserCount++;
    }
    helpdeskUsersById.push({ id: hid, email: spec.email, display_name: spec.display_name });
  }
  const ellen = helpdeskUsersById[0];
  const juan = helpdeskUsersById[1];

  // ─── helpdesk_agent_api_keys for alice ──────────────────────────────────────
  if (await tableExists('helpdesk_agent_api_keys')) {
    const existing = await sql`
      SELECT id FROM helpdesk_agent_api_keys
      WHERE bbb_user_id = ${alice.id} AND name = 'seed agent key'
      LIMIT 1
    `;
    if (existing.length === 0) {
      const rawKey = `hdag_${crypto.randomBytes(24).toString('base64url')}`;
      const keyPrefix = rawKey.slice(0, 8);
      const keyHash = sha256Hex(rawKey); // placeholder hash, not an Argon2id; for seed display only
      await sql`
        INSERT INTO helpdesk_agent_api_keys (id, bbb_user_id, name, key_hash, key_prefix)
        VALUES (${uuid()}, ${alice.id}, 'seed agent key', ${keyHash}, ${keyPrefix})
      `;
    }
  }

  // ─── tickets ────────────────────────────────────────────────────────────────

  // 12 base tickets spanning 6 states. Three of them carry the word
  // "billing" in subject or description for the FTS demo. The 11th ticket
  // is the SLA-imminent one; the 12th is the already-breached one.
  const STATUSES = ['new', 'open', 'pending', 'resolved', 'closed', 'reopened'];
  const PRIORITIES = ['low', 'medium', 'high', 'critical'];

  const baseTickets = [];
  let sIndex = 0;
  for (let i = 0; i < 10; i++) {
    const status = STATUSES[sIndex % STATUSES.length];
    sIndex++;
    const priority = PRIORITIES[i % PRIORITIES.length];
    // 3 tickets with "billing" keyword; interleave across statuses.
    const billingHit = i === 1 || i === 4 || i === 7;
    baseTickets.push({
      subject: billingHit
        ? `Billing question about invoice INV-${2000 + i}`
        : `Issue #${i + 1}: ${['login fails', 'slow page load', 'permission denied', 'cannot upload file', 'password reset broken', 'dark mode contrast', 'mobile layout bug', 'sso loopback', 'export missing column', '2FA prompt never appears'][i]}`,
      description: billingHit
        ? 'We were billed twice this cycle and need a refund for the duplicate charge.'
        : 'Customer reported an issue that needs investigation by the agent team.',
      status,
      priority,
      category: billingHit ? 'billing' : null,
      requester: i % 2 === 0 ? ellen : juan,
      agentMessages: i === 2 ? 'internal_heavy' : 'standard',
    });
  }

  // SLA-imminent ticket: first_response_at NULL, created_at so that only
  // 30 minutes remain until the first-response SLA fires.
  const slaImminentTicket = {
    subject: 'Urgent: production is returning 500s intermittently',
    description: 'Our app is seeing sporadic 5xx responses, please prioritize.',
    status: 'open',
    priority: 'critical',
    category: null,
    requester: ellen,
    agentMessages: 'standard',
    isSlaImminent: true,
  };

  // Already-breached ticket: sla_breached_at set, matching sla_breach row.
  const slaBreachedTicket = {
    subject: 'Billing portal redirect loop after login',
    description: 'When I try to view invoices the portal loops back to login.',
    status: 'open',
    priority: 'high',
    category: 'billing',
    requester: juan,
    agentMessages: 'standard',
    isSlaBreached: true,
  };

  const allTickets = [...baseTickets, slaImminentTicket, slaBreachedTicket];

  async function insertTicket(spec, idx) {
    // Idempotency: skip if an identical subject already exists for this requester.
    const existing = await sql`
      SELECT id FROM tickets
      WHERE helpdesk_user_id = ${spec.requester.id} AND subject = ${spec.subject}
      LIMIT 1
    `;
    if (existing.length > 0) return { id: existing[0].id, created: false };

    const tid = uuid();
    let createdAt;
    let firstResponseAt = null;
    let slaBreachedAt = null;
    let resolvedAt = null;
    let closedAt = null;

    if (spec.isSlaImminent) {
      // created SLA_FIRST minutes ago minus 30, so there's 30 minutes left
      createdAt = new Date(Date.now() - (SLA_FIRST - 30) * 60_000);
    } else if (spec.isSlaBreached) {
      createdAt = new Date(Date.now() - (SLA_FIRST + 120) * 60_000);
      slaBreachedAt = new Date(Date.now() - 120 * 60_000);
    } else {
      createdAt = new Date(Date.now() - (30 + idx * 120) * 60_000);
      // Most tickets have a first agent response within an hour.
      if (spec.status !== 'new') {
        firstResponseAt = new Date(createdAt.getTime() + 45 * 60_000);
      }
      if (spec.status === 'resolved') {
        resolvedAt = new Date(createdAt.getTime() + 4 * 60 * 60_000);
      }
      if (spec.status === 'closed') {
        resolvedAt = new Date(createdAt.getTime() + 4 * 60 * 60_000);
        closedAt = new Date(createdAt.getTime() + 24 * 60 * 60_000);
      }
    }

    const taskId = idx === 0 ? crossLinkTaskId : null; // first ticket cross-links to a Bam task if we have one

    await sql`
      INSERT INTO tickets (
        id, helpdesk_user_id, task_id, project_id, subject, description,
        status, priority, category,
        created_at, updated_at, resolved_at, closed_at,
        first_response_at, sla_breached_at
      ) VALUES (
        ${tid}, ${spec.requester.id}, ${taskId}, ${projectId},
        ${spec.subject}, ${spec.description},
        ${spec.status}, ${spec.priority}, ${spec.category},
        ${createdAt}, ${createdAt}, ${resolvedAt}, ${closedAt},
        ${firstResponseAt}, ${slaBreachedAt}
      )
    `;
    ticketCount++;
    return { id: tid, created: true, createdAt };
  }

  const createdTicketRows = [];
  for (let i = 0; i < allTickets.length; i++) {
    const spec = allTickets[i];
    const row = await insertTicket(spec, i);
    createdTicketRows.push({ spec, ...row });
  }

  // ─── ticket_messages (>=3 per ticket, one ticket gets 2 internal + 3 public) ─
  async function insertMessage(ticketId, { authorType, authorId, authorName, body, isInternal, createdAt }) {
    await sql`
      INSERT INTO ticket_messages (
        id, ticket_id, author_type, author_id, author_name, body, is_internal, created_at
      ) VALUES (
        ${uuid()}, ${ticketId}, ${authorType}, ${authorId}, ${authorName}, ${body}, ${isInternal}, ${createdAt}
      )
    `;
    messageCount++;
  }

  for (const row of createdTicketRows) {
    if (!row.created) continue;
    const { spec, id: ticketId, createdAt } = row;
    const base = createdAt?.getTime() ?? Date.now();

    const baseMessages = [
      {
        authorType: 'customer',
        authorId: spec.requester.id,
        authorName: spec.requester.display_name,
        body: spec.description,
        isInternal: false,
        createdAt: new Date(base),
      },
      {
        authorType: 'agent',
        authorId: alice.id,
        authorName: alice.display_name ?? 'Agent',
        body: 'Thanks for the report, looking into this now.',
        isInternal: false,
        createdAt: new Date(base + 30 * 60_000),
      },
      {
        authorType: 'customer',
        authorId: spec.requester.id,
        authorName: spec.requester.display_name,
        body: 'Appreciate the fast response, standing by.',
        isInternal: false,
        createdAt: new Date(base + 45 * 60_000),
      },
    ];

    for (const m of baseMessages) {
      await insertMessage(ticketId, m);
    }

    // Third ticket gets 2 internal-only + (3 already seeded above as public)
    if (spec.agentMessages === 'internal_heavy') {
      await insertMessage(ticketId, {
        authorType: 'agent',
        authorId: alice.id,
        authorName: alice.display_name ?? 'Agent',
        body: '[internal] Escalating to billing ops, see Zendesk ticket Z-4412.',
        isInternal: true,
        createdAt: new Date(base + 60 * 60_000),
      });
      await insertMessage(ticketId, {
        authorType: 'agent',
        authorId: alice.id,
        authorName: alice.display_name ?? 'Agent',
        body: '[internal] Customer is on the enterprise plan, confirmed via Bond deal lookup.',
        isInternal: true,
        createdAt: new Date(base + 65 * 60_000),
      });
    }
  }

  // ─── helpdesk_sla_breaches row for the breached ticket ──────────────────────
  {
    const breachedRow = createdTicketRows.find((r) => r.spec.isSlaBreached);
    if (breachedRow && (await tableExists('helpdesk_sla_breaches'))) {
      const existing = await sql`
        SELECT id FROM helpdesk_sla_breaches
        WHERE ticket_id = ${breachedRow.id} AND sla_type = 'first_response'
        LIMIT 1
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO helpdesk_sla_breaches (
            id, ticket_id, sla_type, breached_at
          ) VALUES (
            ${uuid()}, ${breachedRow.id}, 'first_response', ${minutesAgo(120)}
          )
        `;
        breachCount++;
      }
    }
  }

  // ─── attachment on the first ticket ─────────────────────────────────────────
  if (await tableExists('helpdesk_ticket_attachments')) {
    const firstTicket = createdTicketRows.find((r) => r.created);
    if (firstTicket) {
      const existing = await sql`
        SELECT id FROM helpdesk_ticket_attachments
        WHERE ticket_id = ${firstTicket.id}
        LIMIT 1
      `;
      if (existing.length === 0) {
        const storageKey = `helpdesk/${firstTicket.id}/screenshot.pdf`;
        await sql`
          INSERT INTO helpdesk_ticket_attachments (
            id, ticket_id, uploaded_by, filename, content_type, size_bytes,
            storage_key, scan_status
          ) VALUES (
            ${uuid()}, ${firstTicket.id}, ${firstTicket.spec.requester.id},
            'screenshot.pdf', 'application/pdf', 42000,
            ${storageKey}, 'clean'
          )
        `;
        attachmentCount++;
      }
    }
  }

  // ─── ticket_events rows (5, varied event_type) ──────────────────────────────
  if (await tableExists('helpdesk_ticket_events')) {
    const hasBoltCol = await columnExists('helpdesk_ticket_events', 'bolt_event_emitted_at');
    const seededTicket = createdTicketRows.find((r) => r.created);
    if (seededTicket) {
      const [existingCount] = await sql`
        SELECT COUNT(*)::int AS cnt FROM helpdesk_ticket_events WHERE ticket_id = ${seededTicket.id}
      `;
      if (existingCount.cnt < 5) {
        const events = [
          { event_type: 'ticket.created',        payload: { status: 'new' } },
          { event_type: 'ticket.status.changed', payload: { from: 'new', to: 'open' } },
          { event_type: 'ticket.message.posted', payload: { is_internal: false, author_type: 'agent' } },
          { event_type: 'ticket.message.posted', payload: { is_internal: true,  author_type: 'agent' } },
          { event_type: 'ticket.closed',         payload: { from: 'open', to: 'closed' } },
        ];
        for (let i = 0; i < events.length; i++) {
          const ev = events[i];
          const createdAt = minutesAgo(60 * (5 - i));
          if (hasBoltCol) {
            const boltEventId = `bolt_evt_${crypto.randomBytes(8).toString('hex')}`;
            await sql`
              INSERT INTO helpdesk_ticket_events (
                ticket_id, event_type, payload, created_at,
                bolt_event_id, bolt_event_emitted_at
              ) VALUES (
                ${seededTicket.id}, ${ev.event_type}, ${sql.json(ev.payload)}, ${createdAt},
                ${boltEventId}, ${createdAt}
              )
            `;
          } else {
            await sql`
              INSERT INTO helpdesk_ticket_events (
                ticket_id, event_type, payload, created_at
              ) VALUES (
                ${seededTicket.id}, ${ev.event_type}, ${sql.json(ev.payload)}, ${createdAt}
              )
            `;
          }
          eventCount++;
        }
      }
    }
  } else {
    console.log('  (skipped) helpdesk_ticket_events table not present on this checkout');
  }

  // ─── summary ────────────────────────────────────────────────────────────────

  const [hdUserTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM helpdesk_users WHERE org_id = ${org.id}
  `;
  const [ticketTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM tickets t
    JOIN helpdesk_users h ON h.id = t.helpdesk_user_id
    WHERE h.org_id = ${org.id}
  `;
  const [messageTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM ticket_messages m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN helpdesk_users h ON h.id = t.helpdesk_user_id
    WHERE h.org_id = ${org.id}
  `;
  const [attachTotal] = (await tableExists('helpdesk_ticket_attachments'))
    ? await sql`
        SELECT COUNT(*)::int AS cnt FROM helpdesk_ticket_attachments a
        JOIN tickets t ON t.id = a.ticket_id
        JOIN helpdesk_users h ON h.id = t.helpdesk_user_id
        WHERE h.org_id = ${org.id}
      `
    : [{ cnt: 0 }];
  const [breachTotal] = (await tableExists('helpdesk_sla_breaches'))
    ? await sql`
        SELECT COUNT(*)::int AS cnt FROM helpdesk_sla_breaches b
        JOIN tickets t ON t.id = b.ticket_id
        JOIN helpdesk_users h ON h.id = t.helpdesk_user_id
        WHERE h.org_id = ${org.id}
      `
    : [{ cnt: 0 }];
  const [eventTotal] = (await tableExists('helpdesk_ticket_events'))
    ? await sql`
        SELECT COUNT(*)::int AS cnt FROM helpdesk_ticket_events e
        JOIN tickets t ON t.id = e.ticket_id
        JOIN helpdesk_users h ON h.id = t.helpdesk_user_id
        WHERE h.org_id = ${org.id}
      `
    : [{ cnt: 0 }];

  console.log('');
  console.log(
    `seed-helpdesk: helpdesk_users=${hdUserTotal.cnt} (+${helpdeskUserCount}), ` +
      `tickets=${ticketTotal.cnt} (+${ticketCount}), ` +
      `messages=${messageTotal.cnt} (+${messageCount}), ` +
      `attachments=${attachTotal.cnt} (+${attachmentCount}), ` +
      `sla_breaches=${breachTotal.cnt} (+${breachCount}), ` +
      `events=${eventTotal.cnt} (+${eventCount})`,
  );

  await sql.end();
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
