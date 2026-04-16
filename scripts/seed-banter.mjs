#!/usr/bin/env node

/**
 * Seed script for the Banter (chat) app.
 *
 * Populates one org's banter workspace with realistic demo data covering
 * every Wave 2 addition plus the baseline schema:
 *
 *   - 6 channels: #general, #engineering, #design, #random (public),
 *     #leadership (private, 3 members), #viewers (public with one
 *     viewer-role member per migration 0107)
 *   - ~50 messages per channel spread across the last 14 days with
 *     round-robin authorship
 *   - 1 thread root on #engineering with 5 replies (thread_parent_id)
 *   - 3 reactions per top-level message drawn from a small emoji pool
 *   - 1 pin (#general) + 1 bookmark (first user)
 *   - 1 DM channel (type='dm') with 2 members and 10 messages
 *   - 1 presence row per user, one per status (online/idle/in_call/dnd/
 *     offline) to cover migration 0105
 *   - 1 message with edit_permission='thread_starter' and 1 with 'none'
 *     to cover migration 0108
 *   - 1 call + 4-line transcript
 *   - 1 message with a cross-product markdown embed to the Acme Bond
 *     deal so testers can click through
 *
 * Idempotency model follows scripts/seed-bearing.mjs:
 *   - SELECT ... LIMIT 1 before INSERT for named rows (channels, calls)
 *   - ON CONFLICT DO NOTHING on natural unique keys
 *     (memberships, reactions, pins, bookmarks, presence by user_id)
 *   - Count-gate bulk generators (messages per channel >= 40 skips)
 *
 * Column names verified against:
 *   apps/banter-api/src/db/schema/channels.ts            (type, slug, name, display_name, created_by, org_id)
 *   apps/banter-api/src/db/schema/messages.ts            (thread_parent_id, edit_permission, content, content_plain)
 *   apps/banter-api/src/db/schema/channel-memberships.ts (role: owner|admin|member|viewer)
 *   apps/banter-api/src/db/schema/message-reactions.ts   (emoji, unique on (message_id, user_id, emoji))
 *   apps/banter-api/src/db/schema/pins.ts                (banter_pins)
 *   apps/banter-api/src/db/schema/bookmarks.ts           (banter_bookmarks, unique on (user_id, message_id))
 *   apps/banter-api/src/db/schema/user-presence.ts       (status enum + in_call_channel_id)
 *   apps/banter-api/src/db/schema/calls.ts               (livekit_room_name required, type, status)
 *   apps/banter-api/src/db/schema/call-transcripts.ts    (speaker_id, content, started_at, ended_at)
 *
 * Usage:
 *   DATABASE_URL=... SEED_ORG_SLUG=mage-inc node scripts/seed-banter.mjs
 *   node scripts/seed-banter.mjs --org-slug=mage-inc
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

function pick(arr, i) {
  return arr[i % arr.length];
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60_000);
}

function randomTimestampWithinDays(days) {
  const offsetMs = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - offsetMs);
}

const MESSAGE_POOL = [
  'Morning team.',
  'Sprint planning at 10.',
  'Quick question about the API schema, anyone free?',
  'PR up for review when you have a minute.',
  'I just deployed to staging, keep an eye on the logs.',
  'Design review today at 3 pm if anyone wants to join.',
  'Coffee?',
  'Docs updated, take a look.',
  'Found a bug in the presence indicator, ticket incoming.',
  'Wrapping up the onboarding flow PR.',
  'Anyone seeing slow response times on the Bond API?',
  'Good progress on the viewer-role work, should land tomorrow.',
  'Postgres migration ran clean on my machine.',
  'I updated the Brief template, let me know what you think.',
  'Lunch anyone?',
  'Taking a 30 minute focus block.',
  'Back.',
  'Standup notes in the doc.',
  'Heading out early today, back tomorrow.',
  'Great work shipping that!',
  'Small refactor coming for the WS broadcaster.',
  'Meeting moved to Thursday.',
  'Ran the e2e suite, all green.',
  'Wave 2 feature gaps are mostly closed now.',
  'Clean checkout, ready to cut a release.',
];

const EMOJI_POOL = [':thumbsup:', ':heart:', ':fire:', ':eyes:', ':rocket:'];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Banter seed: connecting to database...');

  // Standard dynamic org lookup (matches sibling seeders this wave)
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
    SELECT u.id, u.email, u.display_name
    FROM users u
    JOIN organization_memberships m ON m.user_id = u.id
    WHERE m.org_id = ${org.id}
    ORDER BY m.joined_at
  `;
  if (users.length < 2) {
    console.error('Need at least 2 users in the org for Banter seed; aborting.');
    process.exit(1);
  }
  console.log(`Found ${users.length} users.`);

  const userIds = users.map((u) => u.id);
  const alice = users[0];
  const bob = users[1];

  // ─── counters ───────────────────────────────────────────────────────────────
  let channelCount = 0;
  let messageCount = 0;
  let reactionCount = 0;
  let threadReplyCount = 0;
  let presenceCount = 0;
  let callCount = 0;

  // ─── channels ───────────────────────────────────────────────────────────────

  const channelSpecs = [
    { slug: 'general',     name: 'general',     display_name: 'General',     type: 'public',  description: 'Company-wide chat' },
    { slug: 'engineering', name: 'engineering', display_name: 'Engineering', type: 'public',  description: 'Engineering channel' },
    { slug: 'design',      name: 'design',      display_name: 'Design',      type: 'public',  description: 'Design + product' },
    { slug: 'random',      name: 'random',      display_name: 'Random',      type: 'public',  description: 'Off-topic watercooler' },
    { slug: 'leadership',  name: 'leadership',  display_name: 'Leadership',  type: 'private', description: 'Private leadership channel' },
    { slug: 'viewers',     name: 'viewers',     display_name: 'Viewers',     type: 'public',  description: 'Announcements-only, viewer-role demo' },
  ];

  const channelsById = {};
  for (const spec of channelSpecs) {
    const existing = await sql`
      SELECT id FROM banter_channels WHERE org_id = ${org.id} AND slug = ${spec.slug} LIMIT 1
    `;
    let cid;
    if (existing.length > 0) {
      cid = existing[0].id;
    } else {
      cid = uuid();
      await sql`
        INSERT INTO banter_channels (
          id, org_id, name, display_name, slug, type, description,
          created_by, is_default
        ) VALUES (
          ${cid}, ${org.id}, ${spec.name}, ${spec.display_name}, ${spec.slug},
          ${spec.type}, ${spec.description}, ${alice.id}, ${spec.slug === 'general'}
        )
      `;
      channelCount++;
    }
    channelsById[spec.slug] = cid;
  }

  // Memberships: alice is owner of every channel; bob is admin of engineering;
  // #leadership gets alice/bob/carol only; #viewers gets alice (admin) + eve
  // as a viewer-role member (migration 0107).
  async function addMembership(channelId, userId, role) {
    await sql`
      INSERT INTO banter_channel_memberships (id, channel_id, user_id, role)
      VALUES (${uuid()}, ${channelId}, ${userId}, ${role})
      ON CONFLICT (channel_id, user_id) DO NOTHING
    `;
  }

  for (const slug of ['general', 'engineering', 'design', 'random']) {
    for (let i = 0; i < userIds.length; i++) {
      await addMembership(channelsById[slug], userIds[i], i === 0 ? 'owner' : 'member');
    }
  }
  if (userIds.length >= 2) {
    await addMembership(channelsById.engineering, userIds[1], 'admin');
  }
  // Leadership: first 3 users only
  const leadershipMembers = userIds.slice(0, Math.min(3, userIds.length));
  for (let i = 0; i < leadershipMembers.length; i++) {
    await addMembership(channelsById.leadership, leadershipMembers[i], i === 0 ? 'owner' : 'member');
  }
  // Viewers: alice admin, one viewer-role user (prefer the 5th user if present, else bob)
  await addMembership(channelsById.viewers, alice.id, 'admin');
  const viewerUser = users[4] ?? bob;
  await addMembership(channelsById.viewers, viewerUser.id, 'viewer');

  // ─── messages per channel ───────────────────────────────────────────────────

  async function countMessages(channelId) {
    const [row] = await sql`
      SELECT COUNT(*)::int AS cnt FROM banter_messages WHERE channel_id = ${channelId}
    `;
    return row.cnt;
  }

  const TARGET_PER_CHANNEL = 50;

  // Insert top-level messages, returning the ids so we can attach reactions,
  // pins, bookmarks, and thread replies.
  const topLevelMessageIdsByChannel = {};

  for (const slug of ['general', 'engineering', 'design', 'random', 'leadership', 'viewers']) {
    const channelId = channelsById[slug];
    const existing = await countMessages(channelId);
    if (existing >= TARGET_PER_CHANNEL - 5) {
      // Already seeded, just grab existing top-level ids for downstream use
      const ids = await sql`
        SELECT id FROM banter_messages
        WHERE channel_id = ${channelId} AND thread_parent_id IS NULL
        ORDER BY created_at DESC LIMIT 10
      `;
      topLevelMessageIdsByChannel[slug] = ids.map((r) => r.id);
      continue;
    }

    const need = TARGET_PER_CHANNEL - existing;
    const ids = [];
    for (let i = 0; i < need; i++) {
      const author = pick(userIds, i);
      const content = pick(MESSAGE_POOL, i + slug.length);
      const ts = randomTimestampWithinDays(14);
      const mid = uuid();
      await sql`
        INSERT INTO banter_messages (
          id, channel_id, author_id, content, content_plain, content_format, created_at
        ) VALUES (
          ${mid}, ${channelId}, ${author}, ${content}, ${content}, 'plain', ${ts}
        )
      `;
      ids.push(mid);
      messageCount++;
    }
    topLevelMessageIdsByChannel[slug] = ids;
  }

  // ─── cross-product embed message in #general ────────────────────────────────
  // Plain markdown link that works even if the Acme scenario hasn't run yet.
  {
    const embedBody = '[deal: Acme Corp enterprise contract](/bond/deals/ACME)';
    const already = await sql`
      SELECT id FROM banter_messages
      WHERE channel_id = ${channelsById.general} AND content = ${embedBody}
      LIMIT 1
    `;
    if (already.length === 0) {
      await sql`
        INSERT INTO banter_messages (
          id, channel_id, author_id, content, content_plain, content_format, created_at
        ) VALUES (
          ${uuid()}, ${channelsById.general}, ${alice.id}, ${embedBody},
          ${embedBody}, 'plain', ${minutesAgo(60)}
        )
      `;
      messageCount++;
    }
  }

  // ─── thread with 5 replies on #engineering ──────────────────────────────────
  {
    const rootBody = 'Thread: deploy freeze Thursday afternoon, any blockers?';
    const existingRoot = await sql`
      SELECT id FROM banter_messages
      WHERE channel_id = ${channelsById.engineering} AND content = ${rootBody}
      LIMIT 1
    `;
    let rootId;
    if (existingRoot.length > 0) {
      rootId = existingRoot[0].id;
    } else {
      rootId = uuid();
      await sql`
        INSERT INTO banter_messages (
          id, channel_id, author_id, content, content_plain, content_format, created_at
        ) VALUES (
          ${rootId}, ${channelsById.engineering}, ${alice.id}, ${rootBody}, ${rootBody},
          'plain', ${minutesAgo(180)}
        )
      `;
      messageCount++;
    }
    // Count existing replies so re-runs don't pile up
    const [replyRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM banter_messages WHERE thread_parent_id = ${rootId}
    `;
    const needReplies = Math.max(0, 5 - replyRow.cnt);
    const replyBodies = [
      'All green on my end.',
      'I have one PR mid-flight, should land before noon.',
      'Can we push it to Friday morning?',
      'Works for me.',
      'I will handle the DB migration.',
    ];
    for (let i = 0; i < needReplies; i++) {
      await sql`
        INSERT INTO banter_messages (
          id, channel_id, author_id, thread_parent_id,
          content, content_plain, content_format, created_at
        ) VALUES (
          ${uuid()}, ${channelsById.engineering}, ${pick(userIds, i + 1)}, ${rootId},
          ${replyBodies[i]}, ${replyBodies[i]}, 'plain', ${minutesAgo(170 - i * 10)}
        )
      `;
      threadReplyCount++;
      messageCount++;
    }
    // Update reply_count / last_reply_at on root for UI parity
    await sql`
      UPDATE banter_messages
      SET reply_count = (SELECT COUNT(*) FROM banter_messages WHERE thread_parent_id = ${rootId}),
          last_reply_at = (SELECT MAX(created_at) FROM banter_messages WHERE thread_parent_id = ${rootId})
      WHERE id = ${rootId}
    `;
  }

  // ─── edit_permission demo messages ──────────────────────────────────────────
  {
    const threadStarterBody = '[thread-starter-only edit] kickoff thread for the Q2 launch.';
    const noneBody = '[locked message] compliance statement, no edits allowed.';
    for (const [body, perm] of [
      [threadStarterBody, 'thread_starter'],
      [noneBody, 'none'],
    ]) {
      const already = await sql`
        SELECT id FROM banter_messages
        WHERE channel_id = ${channelsById.general} AND content = ${body}
        LIMIT 1
      `;
      if (already.length === 0) {
        await sql`
          INSERT INTO banter_messages (
            id, channel_id, author_id, content, content_plain, content_format,
            edit_permission, created_at
          ) VALUES (
            ${uuid()}, ${channelsById.general}, ${alice.id}, ${body}, ${body}, 'plain',
            ${perm}, ${minutesAgo(120)}
          )
        `;
        messageCount++;
      }
    }
  }

  // ─── reactions on top-level messages ────────────────────────────────────────
  for (const slug of Object.keys(topLevelMessageIdsByChannel)) {
    const ids = topLevelMessageIdsByChannel[slug];
    for (let i = 0; i < ids.length; i++) {
      const mid = ids[i];
      // 3 reactions, each from a different user with a different emoji
      for (let r = 0; r < 3; r++) {
        const reactor = pick(userIds, i + r + 1);
        const emoji = EMOJI_POOL[(i + r) % EMOJI_POOL.length];
        const res = await sql`
          INSERT INTO banter_message_reactions (id, message_id, user_id, emoji)
          VALUES (${uuid()}, ${mid}, ${reactor}, ${emoji})
          ON CONFLICT (message_id, user_id, emoji) DO NOTHING
          RETURNING id
        `;
        if (res.length > 0) reactionCount++;
      }
    }
  }

  // ─── pinned message in #general ─────────────────────────────────────────────
  {
    const [firstGeneral] = await sql`
      SELECT id FROM banter_messages
      WHERE channel_id = ${channelsById.general} AND thread_parent_id IS NULL
      ORDER BY created_at ASC LIMIT 1
    `;
    if (firstGeneral) {
      await sql`
        INSERT INTO banter_pins (id, channel_id, message_id, pinned_by)
        VALUES (${uuid()}, ${channelsById.general}, ${firstGeneral.id}, ${alice.id})
        ON CONFLICT (channel_id, message_id) DO NOTHING
      `;
    }
  }

  // ─── bookmarked message for alice ───────────────────────────────────────────
  {
    const [engMsg] = await sql`
      SELECT id FROM banter_messages
      WHERE channel_id = ${channelsById.engineering} AND thread_parent_id IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (engMsg) {
      await sql`
        INSERT INTO banter_bookmarks (id, user_id, message_id, note)
        VALUES (${uuid()}, ${alice.id}, ${engMsg.id}, 'Follow up on this thread')
        ON CONFLICT (user_id, message_id) DO NOTHING
      `;
    }
  }

  // ─── DM channel between alice and bob with 10 messages ──────────────────────
  {
    const dmSlug = `dm-${alice.id.slice(0, 8)}-${bob.id.slice(0, 8)}`;
    const existingDm = await sql`
      SELECT id FROM banter_channels WHERE org_id = ${org.id} AND slug = ${dmSlug} LIMIT 1
    `;
    let dmChannelId;
    if (existingDm.length > 0) {
      dmChannelId = existingDm[0].id;
    } else {
      dmChannelId = uuid();
      await sql`
        INSERT INTO banter_channels (
          id, org_id, name, display_name, slug, type, description, created_by
        ) VALUES (
          ${dmChannelId}, ${org.id}, ${dmSlug}, ${`${alice.display_name ?? 'Alice'} + ${bob.display_name ?? 'Bob'}`},
          ${dmSlug}, 'dm', 'Direct message', ${alice.id}
        )
      `;
      channelCount++;
    }
    await addMembership(dmChannelId, alice.id, 'member');
    await addMembership(dmChannelId, bob.id, 'member');

    const [dmCountRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM banter_messages WHERE channel_id = ${dmChannelId}
    `;
    const needDmMessages = Math.max(0, 10 - dmCountRow.cnt);
    const dmLines = [
      'Hey, got a minute?',
      'Sure, what is up?',
      'Can you review PR #412?',
      'On it, looking now.',
      'Thanks!',
      'LGTM, one small nit in the test file.',
      'Fixed, pushing now.',
      'Merged.',
      'Nice, shipping after lunch.',
      'Perfect, talk soon.',
    ];
    for (let i = 0; i < needDmMessages; i++) {
      const author = i % 2 === 0 ? alice.id : bob.id;
      const body = dmLines[i];
      await sql`
        INSERT INTO banter_messages (
          id, channel_id, author_id, content, content_plain, content_format, created_at
        ) VALUES (
          ${uuid()}, ${dmChannelId}, ${author}, ${body}, ${body}, 'plain',
          ${minutesAgo(240 - i * 10)}
        )
      `;
      messageCount++;
    }
  }

  // ─── presence rows (one per status) ─────────────────────────────────────────
  {
    const statuses = ['online', 'idle', 'in_call', 'dnd', 'offline'];
    for (let i = 0; i < statuses.length && i < userIds.length; i++) {
      const status = statuses[i];
      const inCallChannel = status === 'in_call' ? channelsById.general : null;
      const res = await sql`
        INSERT INTO banter_user_presence (
          id, user_id, status, in_call_channel_id, updated_at, last_activity_at
        ) VALUES (
          ${uuid()}, ${userIds[i]}, ${status}, ${inCallChannel}, now(), now()
        )
        ON CONFLICT (user_id) DO UPDATE
          SET status = EXCLUDED.status,
              in_call_channel_id = EXCLUDED.in_call_channel_id,
              updated_at = now(),
              last_activity_at = now()
        RETURNING id
      `;
      if (res.length > 0) presenceCount++;
    }
  }

  // ─── call + transcript ──────────────────────────────────────────────────────
  {
    const callTitle = 'Engineering standup huddle';
    const existingCall = await sql`
      SELECT id FROM banter_calls
      WHERE channel_id = ${channelsById.engineering} AND title = ${callTitle}
      LIMIT 1
    `;
    let callId;
    if (existingCall.length > 0) {
      callId = existingCall[0].id;
    } else {
      callId = uuid();
      const startedAt = minutesAgo(60);
      const endedAt = minutesAgo(40);
      await sql`
        INSERT INTO banter_calls (
          id, channel_id, started_by, type, status, livekit_room_name,
          title, peak_participant_count, started_at, ended_at, duration_seconds
        ) VALUES (
          ${callId}, ${channelsById.engineering}, ${alice.id}, 'huddle', 'ended',
          ${`banter-${callId}`}, ${callTitle}, 3, ${startedAt}, ${endedAt}, 1200
        )
      `;
      callCount++;
    }

    const [txCount] = await sql`
      SELECT COUNT(*)::int AS cnt FROM banter_call_transcripts WHERE call_id = ${callId}
    `;
    if (txCount.cnt === 0) {
      const lines = [
        { speaker: alice.id, text: 'Morning team, quick standup.' },
        { speaker: bob.id,   text: 'I finished the migration work.' },
        { speaker: pick(userIds, 2), text: 'Design review is on track for Thursday.' },
        { speaker: alice.id, text: 'Great, let us wrap up.' },
      ];
      let t = 0;
      for (const line of lines) {
        const startedAt = new Date(Date.now() - (60 - t) * 60_000);
        const endedAt = new Date(Date.now() - (60 - t - 0.5) * 60_000);
        await sql`
          INSERT INTO banter_call_transcripts (
            id, call_id, speaker_id, content, started_at, ended_at, confidence, is_final
          ) VALUES (
            ${uuid()}, ${callId}, ${line.speaker}, ${line.text},
            ${startedAt}, ${endedAt}, 0.95, true
          )
        `;
        t += 5;
      }
    }
  }

  // ─── summary ────────────────────────────────────────────────────────────────

  const [channelTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM banter_channels WHERE org_id = ${org.id}
  `;
  const [messageTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM banter_messages m
    JOIN banter_channels c ON c.id = m.channel_id
    WHERE c.org_id = ${org.id}
  `;
  const [presenceTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM banter_user_presence p
    JOIN users u ON u.id = p.user_id
    WHERE u.org_id = ${org.id}
  `;
  const [reactionTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM banter_message_reactions r
    JOIN banter_messages m ON m.id = r.message_id
    JOIN banter_channels c ON c.id = m.channel_id
    WHERE c.org_id = ${org.id}
  `;
  const [callTotal] = await sql`
    SELECT COUNT(*)::int AS cnt FROM banter_calls ca
    JOIN banter_channels c ON c.id = ca.channel_id
    WHERE c.org_id = ${org.id}
  `;

  console.log('');
  console.log(
    `seed-banter: channels=${channelTotal.cnt} (+${channelCount}), ` +
      `messages=${messageTotal.cnt} (+${messageCount}), ` +
      `presence=${presenceTotal.cnt} (+${presenceCount}), ` +
      `threads=1 replies=${threadReplyCount}, ` +
      `reactions=${reactionTotal.cnt} (+${reactionCount}), ` +
      `calls=${callTotal.cnt} (+${callCount})`,
  );

  await sql.end();
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
