import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterChannels,
  banterMessages,
} from '../db/schema/index.js';
import { broadcastToChannel } from './realtime.js';

/**
 * Activity Feed Bot — posts system messages to Banter channels
 * when Bam events occur (task created/completed, sprint started/completed, etc.)
 *
 * Called from the Bam API or worker via internal HTTP or shared queue.
 */

const BOT_USER_ID = '00000000-0000-0000-0000-000000000000'; // System bot

interface FeedEvent {
  org_id: string;
  channel_slug: string; // Target channel slug (e.g., "general" or a project-specific channel)
  event_type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Post an activity feed message to a Banter channel.
 * If the channel doesn't exist or the bot isn't a member, silently skip.
 */
export async function postActivityFeedMessage(event: FeedEvent): Promise<void> {
  try {
    // Find the channel by slug + org
    const [channel] = await db
      .select()
      .from(banterChannels)
      .where(
        and(
          eq(banterChannels.slug, event.channel_slug),
          eq(banterChannels.org_id, event.org_id),
          eq(banterChannels.is_archived, false),
        ),
      )
      .limit(1);

    if (!channel) return;

    // Insert system message
    const [message] = await db
      .insert(banterMessages)
      .values({
        channel_id: channel.id,
        author_id: BOT_USER_ID,
        content: event.message,
        content_plain: event.message.replace(/<[^>]*>/g, '').slice(0, 500),
        content_format: 'markdown',
        is_system: true,
        is_bot: true,
        metadata: {
          event_type: event.event_type,
          ...event.metadata,
        },
      })
      .returning();

    // Update channel last_message
    await db
      .update(banterChannels)
      .set({
        last_message_at: new Date(),
        last_message_preview: event.message.slice(0, 200),
        message_count: sql`${banterChannels.message_count} + 1`,
      })
      .where(eq(banterChannels.id, channel.id));

    broadcastToChannel(channel.id, {
      type: 'message.created',
      data: {
        message: {
          ...message,
          author: {
            id: BOT_USER_ID,
            display_name: 'BigBlueBam Bot',
            avatar_url: null,
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical: silently fail
  }
}

/**
 * Format common Bam events into feed messages.
 */
export function formatTaskCreated(taskTitle: string, creatorName: string, projectName: string): string {
  return `**${creatorName}** created a new task in **${projectName}**: *${taskTitle}*`;
}

export function formatTaskCompleted(taskTitle: string, assigneeName: string, projectName: string): string {
  return `**${assigneeName}** completed task in **${projectName}**: *${taskTitle}*`;
}

export function formatSprintStarted(sprintName: string, projectName: string): string {
  return `Sprint **${sprintName}** started in **${projectName}**`;
}

export function formatSprintCompleted(sprintName: string, projectName: string, stats: { completed: number; total: number }): string {
  return `Sprint **${sprintName}** completed in **${projectName}** — ${stats.completed}/${stats.total} tasks done`;
}

export function formatTicketCreated(ticketTitle: string, customerName: string): string {
  return `New helpdesk ticket from **${customerName}**: *${ticketTitle}*`;
}
