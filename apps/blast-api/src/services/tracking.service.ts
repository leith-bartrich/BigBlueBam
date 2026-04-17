import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blastSendLog,
  blastEngagementEvents,
  blastCampaigns,
  blastUnsubscribes,
} from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';
import {
  publishBoltEvent,
  buildCampaignEventPayload,
} from '../lib/bolt-events.js';

/**
 * Very small, dependency-free parser that maps a user_agent string to a
 * coarse client label suitable for device/client breakdown aggregation.
 * Returns `null` when the user_agent is absent. Output is always <=120 chars
 * to fit the denormalized `blast_engagement_events.client_info` column.
 *
 * Prefers email-client tokens over browsers (e.g. Outlook, Apple Mail,
 * Gmail, Yahoo, Thunderbird) so engagement events captured by mail clients
 * are grouped under the mail client rather than the embedded renderer.
 */
function parseClientInfo(userAgent: string | undefined | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  // Email clients first — these are the high-signal buckets for Blast.
  if (ua.includes('outlook')) return 'Outlook';
  if (ua.includes('thunderbird')) return 'Thunderbird';
  if (ua.includes('yahoomailapp') || ua.includes('yahoo! slurp')) return 'Yahoo Mail';
  if (ua.includes('googleimageproxy') || ua.includes('gmailimageproxy')) return 'Gmail';
  if (ua.includes('applemail') || ua.includes('mail/')) return 'Apple Mail';
  if (ua.includes('superhuman')) return 'Superhuman';
  if (ua.includes('mailchimp')) return 'Mailchimp';

  // Bots / prefetchers — useful to filter out of engagement metrics.
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return 'Bot';
  }

  // Browser fallback — rough bucketing sufficient for breakdown charts.
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome') && !ua.includes('chromium')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';

  return 'Other';
}

/**
 * Build the engagement-event payload for `engagement.*` Bolt events. Reuses
 * `buildCampaignEventPayload` for the enriched `campaign.*`, `org.*` fields,
 * then layers on engagement-specific fields. Caller supplies the occurrence
 * timestamp + event-specific extras (clicked_url, bounce_type, ...).
 */
async function buildEngagementEventPayload(args: {
  campaign: typeof blastCampaigns.$inferSelect;
  orgId: string;
  contactId: string;
  toEmail: string;
  eventType: 'opened' | 'clicked' | 'unsubscribed' | 'bounced';
  occurredAt: Date;
  clientInfo: string | null;
  extra?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  // Tracking events are system-initiated (the pixel/redirect fires on behalf
  // of the recipient), so we pass the campaign's creator as the actor to
  // keep the enrichment helper happy and the `org.*` join intact.
  const base = await buildCampaignEventPayload({
    campaign: args.campaign,
    orgId: args.orgId,
    actorId: args.campaign.created_by,
  });

  return {
    ...base,
    'contact.id': args.contactId,
    'contact.email': args.toEmail,
    'engagement.event_type': args.eventType,
    'engagement.occurred_at': args.occurredAt.toISOString(),
    'engagement.client_info': args.clientInfo ?? undefined,
    ...(args.extra ?? {}),
  };
}

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ---------------------------------------------------------------------------
// Process open event
// ---------------------------------------------------------------------------

export async function processOpen(
  token: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
) {
  const [sendLog] = await db
    .select()
    .from(blastSendLog)
    .where(eq(blastSendLog.tracking_token, token))
    .limit(1);

  if (!sendLog) return { pixel: TRACKING_PIXEL };

  const clientInfo = parseClientInfo(userAgent);
  const occurredAt = new Date();

  // Record open event
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'open',
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    client_info: clientInfo,
    occurred_at: occurredAt,
  });

  // Increment campaign open count
  await db
    .update(blastCampaigns)
    .set({
      total_opened: sql`${blastCampaigns.total_opened} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

  // Fire-and-forget enriched `engagement.opened` Bolt event.
  (async () => {
    try {
      const [campaign] = await db
        .select()
        .from(blastCampaigns)
        .where(eq(blastCampaigns.id, sendLog.campaign_id))
        .limit(1);
      if (!campaign) return;
      const payload = await buildEngagementEventPayload({
        campaign,
        orgId: campaign.organization_id,
        contactId: sendLog.contact_id,
        toEmail: sendLog.to_email,
        eventType: 'opened',
        occurredAt,
        clientInfo,
      });
      await publishBoltEvent(
        'engagement.opened',
        'blast',
        payload,
        campaign.organization_id,
        undefined,
        'system',
      );
    } catch {
      // Fire-and-forget — never fail the tracking pixel on Bolt outage.
    }
  })();

  return { pixel: TRACKING_PIXEL };
}

// ---------------------------------------------------------------------------
// Process click event
// ---------------------------------------------------------------------------

export async function processClick(
  token: string,
  url: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
) {
  const [sendLog] = await db
    .select()
    .from(blastSendLog)
    .where(eq(blastSendLog.tracking_token, token))
    .limit(1);

  if (!sendLog) return { redirect_url: url, valid: false as const };

  const clientInfo = parseClientInfo(userAgent);
  const occurredAt = new Date();

  // Record click event
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'click',
    clicked_url: url,
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    client_info: clientInfo,
    occurred_at: occurredAt,
  });

  // Increment campaign click count
  await db
    .update(blastCampaigns)
    .set({
      total_clicked: sql`${blastCampaigns.total_clicked} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

  // Fire-and-forget enriched `engagement.clicked` Bolt event.
  (async () => {
    try {
      const [campaign] = await db
        .select()
        .from(blastCampaigns)
        .where(eq(blastCampaigns.id, sendLog.campaign_id))
        .limit(1);
      if (!campaign) return;
      const payload = await buildEngagementEventPayload({
        campaign,
        orgId: campaign.organization_id,
        contactId: sendLog.contact_id,
        toEmail: sendLog.to_email,
        eventType: 'clicked',
        occurredAt,
        clientInfo,
        extra: { 'engagement.clicked_url': url },
      });
      await publishBoltEvent(
        'engagement.clicked',
        'blast',
        payload,
        campaign.organization_id,
        undefined,
        'system',
      );
    } catch {
      // Fire-and-forget — never fail the click redirect on Bolt outage.
    }
  })();

  return { redirect_url: url, valid: true as const };
}

// ---------------------------------------------------------------------------
// Process unsubscribe
// ---------------------------------------------------------------------------

export async function processUnsubscribe(
  token: string,
  reason?: string,
) {
  const [sendLog] = await db
    .select()
    .from(blastSendLog)
    .where(eq(blastSendLog.tracking_token, token))
    .limit(1);

  if (!sendLog) throw notFound('Invalid unsubscribe token');

  // Get campaign org
  const [campaign] = await db
    .select()
    .from(blastCampaigns)
    .where(eq(blastCampaigns.id, sendLog.campaign_id))
    .limit(1);

  if (!campaign) throw notFound('Campaign not found');

  const occurredAt = new Date();

  // Add to unsubscribe list (upsert; idempotent)
  await db
    .insert(blastUnsubscribes)
    .values({
      organization_id: campaign.organization_id,
      email: sendLog.to_email,
      contact_id: sendLog.contact_id,
      reason: reason ?? 'User unsubscribed via email link',
    })
    .onConflictDoNothing();

  // Record unsubscribe event
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'unsubscribe',
    occurred_at: occurredAt,
  });

  // Increment campaign unsubscribe count
  await db
    .update(blastCampaigns)
    .set({
      total_unsubscribed: sql`${blastCampaigns.total_unsubscribed} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

  // Fire-and-forget enriched `engagement.unsubscribed` Bolt event.
  (async () => {
    try {
      const payload = await buildEngagementEventPayload({
        campaign,
        orgId: campaign.organization_id,
        contactId: sendLog.contact_id,
        toEmail: sendLog.to_email,
        eventType: 'unsubscribed',
        occurredAt,
        clientInfo: null,
        extra: {
          'engagement.unsubscribe_source': 'email_link',
          'engagement.reason': reason ?? undefined,
        },
      });
      await publishBoltEvent(
        'engagement.unsubscribed',
        'blast',
        payload,
        campaign.organization_id,
        undefined,
        'system',
      );
    } catch {
      // Fire-and-forget — never fail the unsubscribe on Bolt outage.
    }
  })();

  return { success: true, email: sendLog.to_email };
}

// ---------------------------------------------------------------------------
// Get unsubscribe info (for rendering the confirmation page)
// ---------------------------------------------------------------------------

export async function getUnsubscribeInfo(token: string) {
  const [sendLog] = await db
    .select()
    .from(blastSendLog)
    .where(eq(blastSendLog.tracking_token, token))
    .limit(1);

  if (!sendLog) throw notFound('Invalid unsubscribe token');

  return { email: sendLog.to_email, campaign_id: sendLog.campaign_id };
}

export { TRACKING_PIXEL };
