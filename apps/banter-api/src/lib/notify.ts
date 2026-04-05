import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * Unified notifications emitter for Banter.
 *
 * Writes directly into the shared `notifications` table (see migration
 * 0019) so events surface in the SAME bell the BBB frontend already
 * renders. All fields map 1:1 to the notifications columns.
 *
 * This helper is intentionally fire-and-forget at the call site: every
 * caller should wrap it in try/catch so a notification insert failure
 * never breaks message delivery. The helper itself also swallows
 * errors defensively.
 */

export type BanterNotificationCategory = 'mention' | 'dm' | 'thread_reply';

export interface EmitNotificationOpts {
  /** Recipient user id (NOT the actor). */
  user_id: string;
  /** Org the event belongs to (used for active-org scoping). */
  org_id: string;
  /** Short human-readable subject for the bell list. */
  title: string;
  /** Longer body; typically a content preview. */
  body: string;
  /** Normalized event kind. */
  category: BanterNotificationCategory;
  /** Absolute URL path the client navigates to on click. */
  deep_link: string;
  /** Arbitrary per-event context (channel_id, message_id, ...). */
  metadata?: Record<string, unknown>;
}

/**
 * Shape of user.notification_prefs that this module honors. Everything
 * is optional and defaults to ENABLED when unspecified.
 *
 *   { banter: { mentions: true, dms: true, thread_replies: true } }
 */
interface BanterPrefs {
  banter?: {
    mentions?: boolean;
    dms?: boolean;
    thread_replies?: boolean;
  };
}

const CATEGORY_PREF_KEY: Record<BanterNotificationCategory, keyof NonNullable<BanterPrefs['banter']>> = {
  mention: 'mentions',
  dm: 'dms',
  thread_reply: 'thread_replies',
};

/**
 * Returns true if the user has opted IN (or not opted out) of the
 * given banter notification category. Defaults to true on missing
 * prefs, lookup failures, or malformed JSON.
 */
async function userWantsCategory(
  user_id: string,
  category: BanterNotificationCategory,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ notification_prefs: users.notification_prefs })
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1);
    if (!row) return true;
    const prefs = row.notification_prefs as BanterPrefs | null;
    const banter = prefs?.banter;
    if (!banter) return true;
    const key = CATEGORY_PREF_KEY[category];
    // undefined -> true (opt-in by default), explicit false -> skip
    return banter[key] !== false;
  } catch {
    return true;
  }
}

/**
 * Insert a notification row. Safe to call from inside request
 * handlers; never throws.
 */
export async function emitNotification(opts: EmitNotificationOpts): Promise<void> {
  try {
    if (!(await userWantsCategory(opts.user_id, opts.category))) {
      return;
    }

    // `type` is the legacy free-form varchar(50) column; keep it in
    // sync with category so pre-polymorphic consumers still bucket
    // these rows correctly.
    const legacyType = `banter_${opts.category}`;

    await db.execute(sql`
      INSERT INTO notifications (
        id, user_id, org_id, type, title, body,
        source_app, deep_link, category, metadata, is_read, created_at
      ) VALUES (
        gen_random_uuid(),
        ${opts.user_id},
        ${opts.org_id},
        ${legacyType},
        ${opts.title.slice(0, 500)},
        ${opts.body.slice(0, 2000)},
        'banter',
        ${opts.deep_link},
        ${opts.category},
        ${JSON.stringify(opts.metadata ?? {})}::jsonb,
        false,
        NOW()
      )
    `);
  } catch {
    // Swallow: notification failures MUST NOT block messaging.
  }
}

// ── Deep-link builders ────────────────────────────────────────────
// Centralized so call sites stay boring and the URL shape can change
// in one place if nginx routing moves.

export function channelDeepLink(slug: string, messageId?: string): string {
  const base = `/banter/channels/${slug}`;
  return messageId ? `${base}?message=${messageId}` : base;
}

export function dmDeepLink(channelId: string, messageId?: string): string {
  const base = `/banter/dm/${channelId}`;
  return messageId ? `${base}?message=${messageId}` : base;
}

export function threadDeepLink(
  slug: string,
  threadParentId: string,
  messageId?: string,
): string {
  const base = `/banter/channels/${slug}?thread=${threadParentId}`;
  return messageId ? `${base}&message=${messageId}` : base;
}
