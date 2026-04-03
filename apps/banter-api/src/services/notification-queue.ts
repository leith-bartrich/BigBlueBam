import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../env.js';

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('banter-notifications', { connection });
  }
  return queue;
}

export interface MentionNotification {
  type: 'banter-mention';
  mentioned_user_id: string;
  channel_id: string;
  channel_name: string;
  message_id: string;
  author_display_name: string;
  content_preview: string;
  org_id: string;
}

export interface DMNotification {
  type: 'banter-dm';
  recipient_user_id: string;
  channel_id: string;
  message_id: string;
  author_display_name: string;
  content_preview: string;
  org_id: string;
}

export interface ThreadReplyNotification {
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

export interface ChannelInviteNotification {
  type: 'banter-channel-invite';
  invited_user_id: string;
  channel_id: string;
  channel_name: string;
  inviter_display_name: string;
  org_id: string;
}

type NotificationData =
  | MentionNotification
  | DMNotification
  | ThreadReplyNotification
  | ChannelInviteNotification;

export async function enqueueNotification(data: NotificationData): Promise<void> {
  try {
    await getQueue().add(data.type, data, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  } catch {
    // Non-critical: don't fail the request if notification queueing fails
  }
}

/** Extract @mentioned user names from message content */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}
