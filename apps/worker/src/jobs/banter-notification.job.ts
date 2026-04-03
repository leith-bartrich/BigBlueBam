import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ── Job types ─────────────────────────────────────────────────────

export interface BanterMentionJobData {
  type: 'banter-mention';
  mentioned_user_id: string;
  channel_id: string;
  channel_name: string;
  message_id: string;
  author_display_name: string;
  content_preview: string;
  org_id: string;
}

export interface BanterDMJobData {
  type: 'banter-dm';
  recipient_user_id: string;
  channel_id: string;
  message_id: string;
  author_display_name: string;
  content_preview: string;
  org_id: string;
}

export interface BanterThreadReplyJobData {
  type: 'banter-thread-reply';
  thread_author_id: string;
  channel_id: string;
  channel_name: string;
  message_id: string;
  thread_parent_id: string;
  author_display_name: string;
  content_preview: string;
  org_id: string;
}

export interface BanterChannelInviteJobData {
  type: 'banter-channel-invite';
  invited_user_id: string;
  channel_id: string;
  channel_name: string;
  inviter_display_name: string;
  org_id: string;
}

export type BanterNotificationJobData =
  | BanterMentionJobData
  | BanterDMJobData
  | BanterThreadReplyJobData
  | BanterChannelInviteJobData;

// ── Processor ─────────────────────────────────────────────────────

export async function processBanterNotificationJob(
  job: Job<BanterNotificationJobData>,
  logger: Logger,
): Promise<void> {
  const data = job.data;
  logger.info({ jobId: job.id, type: data.type }, 'Processing Banter notification job');

  const db = getDb();

  switch (data.type) {
    case 'banter-mention': {
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, metadata)
        VALUES (
          gen_random_uuid(),
          ${data.mentioned_user_id},
          'banter_mention',
          ${`${data.author_display_name} mentioned you in #${data.channel_name}`},
          ${data.content_preview.slice(0, 300)},
          false,
          NOW(),
          ${JSON.stringify({
            channel_id: data.channel_id,
            message_id: data.message_id,
            channel_name: data.channel_name,
          })}::jsonb
        )
      `);
      break;
    }

    case 'banter-dm': {
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, metadata)
        VALUES (
          gen_random_uuid(),
          ${data.recipient_user_id},
          'banter_dm',
          ${`New message from ${data.author_display_name}`},
          ${data.content_preview.slice(0, 300)},
          false,
          NOW(),
          ${JSON.stringify({
            channel_id: data.channel_id,
            message_id: data.message_id,
          })}::jsonb
        )
      `);
      break;
    }

    case 'banter-thread-reply': {
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, metadata)
        VALUES (
          gen_random_uuid(),
          ${data.thread_author_id},
          'banter_thread_reply',
          ${`${data.author_display_name} replied to your thread in #${data.channel_name}`},
          ${data.content_preview.slice(0, 300)},
          false,
          NOW(),
          ${JSON.stringify({
            channel_id: data.channel_id,
            message_id: data.message_id,
            thread_parent_id: data.thread_parent_id,
            channel_name: data.channel_name,
          })}::jsonb
        )
      `);
      break;
    }

    case 'banter-channel-invite': {
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at, metadata)
        VALUES (
          gen_random_uuid(),
          ${data.invited_user_id},
          'banter_channel_invite',
          ${`${data.inviter_display_name} invited you to #${data.channel_name}`},
          ${`You've been added to the channel #${data.channel_name}`},
          false,
          NOW(),
          ${JSON.stringify({
            channel_id: data.channel_id,
            channel_name: data.channel_name,
          })}::jsonb
        )
      `);
      break;
    }
  }

  logger.info({ jobId: job.id, type: data.type }, 'Banter notification created');
}
