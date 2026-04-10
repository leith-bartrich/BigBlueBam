import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { banterChannels, organizations, users } from '../db/schema/index.js';
import { channelDeepLink, dmDeepLink, threadDeepLink } from './notify.js';

/**
 * Enrichment helpers for Bolt event payloads emitted by banter-api.
 *
 * Every Banter event payload the producer emits needs a fully-populated
 * `channel`, `actor`, and `org` object so that Bolt rule templates can
 * reference things like `{{ event.channel.handle }}` or
 * `{{ event.actor.email }}` without having to chain a resolver step.
 *
 * See: apps/bolt-api/src/services/event-catalog.ts banterEvents, and
 * docs/bolt-id-mapping-strategy.md Appendix B § banter.
 */

export interface EnrichedChannel {
  id: string;
  name: string | null;
  handle: string | null;
  type: string | null;
  description: string | null;
  member_count: number | null;
  url: string;
}

export interface EnrichedActor {
  id: string;
  name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface EnrichedOrg {
  id: string;
  name: string | null;
  slug: string | null;
}

/**
 * Load a channel row (by id) and shape it for event payloads.
 * Returns a minimal fallback object if the channel can't be found.
 */
export async function loadEnrichedChannel(channelId: string): Promise<EnrichedChannel> {
  const [row] = await db
    .select({
      id: banterChannels.id,
      name: banterChannels.name,
      slug: banterChannels.slug,
      type: banterChannels.type,
      description: banterChannels.description,
      member_count: banterChannels.member_count,
    })
    .from(banterChannels)
    .where(eq(banterChannels.id, channelId))
    .limit(1);

  if (!row) {
    return {
      id: channelId,
      name: null,
      handle: null,
      type: null,
      description: null,
      member_count: null,
      url: '',
    };
  }

  const isDm = row.type === 'dm' || row.type === 'group_dm';
  const url = isDm ? dmDeepLink(row.id) : channelDeepLink(row.slug);

  return {
    id: row.id,
    name: row.name,
    handle: row.slug,
    type: row.type,
    description: row.description,
    member_count: row.member_count,
    url,
  };
}

/**
 * Load a user row (by id) and shape it as the fully-populated actor
 * object expected in Bolt event payloads.
 *
 * Note: the Banter `users` table has no `name` column — `display_name`
 * is the canonical label. We surface it as both `actor.name` and
 * `actor.display_name` so rule templates can use either.
 */
export async function loadEnrichedActor(userId: string): Promise<EnrichedActor> {
  const [row] = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return {
      id: userId,
      name: null,
      display_name: null,
      email: null,
      avatar_url: null,
    };
  }

  return {
    id: row.id,
    name: row.display_name,
    display_name: row.display_name,
    email: row.email,
    avatar_url: row.avatar_url,
  };
}

/**
 * Load the org row and shape it for payload.org.
 */
export async function loadEnrichedOrg(orgId: string): Promise<EnrichedOrg> {
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!row) {
    return { id: orgId, name: null, slug: null };
  }

  return { id: row.id, name: row.name, slug: row.slug };
}

/**
 * Build a message deep-link URL appropriate to the channel type and
 * whether the message is a thread reply.
 */
export function buildMessageUrl(
  channel: { type: string | null; handle: string | null; id: string },
  messageId: string,
  threadParentId: string | null,
): string {
  if (channel.type === 'dm' || channel.type === 'group_dm') {
    return dmDeepLink(channel.id, messageId);
  }
  if (threadParentId && channel.handle) {
    return threadDeepLink(channel.handle, threadParentId, messageId);
  }
  if (channel.handle) {
    return channelDeepLink(channel.handle, messageId);
  }
  return '';
}
