import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blastSendLog,
  blastCampaigns,
  blastEngagementEvents,
  blastUnsubscribes,
} from '../db/schema/index.js';
import {
  publishBoltEvent,
  buildCampaignEventPayload,
} from '../lib/bolt-events.js';

/**
 * Emit an `engagement.bounced` Bolt event for a send_log row that has just
 * been marked bounced or complained. Runs fire-and-forget; never blocks the
 * webhook handler on Bolt availability.
 */
async function emitBounceEvent(args: {
  campaignId: string;
  contactId: string;
  toEmail: string;
  bounceType: 'hard' | 'soft' | 'complaint';
  reason: string | undefined;
}): Promise<void> {
  try {
    const [campaign] = await db
      .select()
      .from(blastCampaigns)
      .where(eq(blastCampaigns.id, args.campaignId))
      .limit(1);
    if (!campaign) return;

    const base = await buildCampaignEventPayload({
      campaign,
      orgId: campaign.organization_id,
      actorId: campaign.created_by,
    });

    const payload: Record<string, unknown> = {
      ...base,
      'contact.id': args.contactId,
      'contact.email': args.toEmail,
      'engagement.event_type': 'bounced',
      'engagement.occurred_at': new Date().toISOString(),
      'engagement.bounce_type': args.bounceType,
      'engagement.reason': args.reason ?? undefined,
    };

    await publishBoltEvent(
      'engagement.bounced',
      'blast',
      payload,
      campaign.organization_id,
      undefined,
      'system',
    );
  } catch {
    // Fire-and-forget — never fail a webhook on Bolt outage.
  }
}

// ---------------------------------------------------------------------------
// Process bounce webhook
// ---------------------------------------------------------------------------

export async function processBounce(payload: {
  message_id?: string;
  email?: string;
  bounce_type: 'hard' | 'soft' | 'complaint';
  reason?: string;
}) {
  // Find the send log entry by SMTP message ID or email
  let sendLog;

  if (payload.message_id) {
    [sendLog] = await db
      .select()
      .from(blastSendLog)
      .where(eq(blastSendLog.smtp_message_id, payload.message_id))
      .limit(1);
  }

  // BLAST-012: When falling back to email match (no message_id), require
  // message_id to avoid cross-org bounce mis-attribution. Email-only lookups
  // are ambiguous because the same address may appear in multiple orgs' send logs.
  if (!sendLog && !payload.message_id && payload.email) {
    return { processed: false, reason: 'Bounce by email-only match rejected — message_id required to prevent cross-org mis-attribution' };
  }

  if (!sendLog) {
    return { processed: false, reason: 'Send log entry not found' };
  }

  // Update send log status
  await db
    .update(blastSendLog)
    .set({
      status: 'bounced',
      bounce_type: payload.bounce_type,
      bounce_reason: payload.reason,
      bounced_at: new Date(),
    })
    .where(eq(blastSendLog.id, sendLog.id));

  // Record a denormalized engagement row so analytics queries that scan
  // blast_engagement_events see the bounce alongside opens/clicks.
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'bounce',
  });

  // Increment campaign bounce count
  await db
    .update(blastCampaigns)
    .set({
      total_bounced: sql`${blastCampaigns.total_bounced} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

  // Fire-and-forget `engagement.bounced` Bolt event.
  void emitBounceEvent({
    campaignId: sendLog.campaign_id,
    contactId: sendLog.contact_id,
    toEmail: sendLog.to_email,
    bounceType: payload.bounce_type,
    reason: payload.reason,
  });

  return { processed: true, send_log_id: sendLog.id };
}

// ---------------------------------------------------------------------------
// Process complaint webhook (FBL)
// ---------------------------------------------------------------------------

export async function processComplaint(payload: {
  message_id?: string;
  email?: string;
}) {
  let sendLog;

  if (payload.message_id) {
    [sendLog] = await db
      .select()
      .from(blastSendLog)
      .where(eq(blastSendLog.smtp_message_id, payload.message_id))
      .limit(1);
  }

  // BLAST-012: Reject email-only fallback to prevent cross-org mis-attribution
  if (!sendLog && !payload.message_id && payload.email) {
    return { processed: false, reason: 'Complaint by email-only match rejected — message_id required to prevent cross-org mis-attribution' };
  }

  if (!sendLog) {
    return { processed: false, reason: 'Send log entry not found' };
  }

  // Update send log status to complained
  await db
    .update(blastSendLog)
    .set({
      status: 'complained',
      bounce_type: 'complaint',
      bounced_at: new Date(),
    })
    .where(eq(blastSendLog.id, sendLog.id));

  // Get campaign for org ID
  const [campaign] = await db
    .select()
    .from(blastCampaigns)
    .where(eq(blastCampaigns.id, sendLog.campaign_id))
    .limit(1);

  if (campaign) {
    // Record a denormalized engagement row for the complaint so analytics
    // queries can aggregate bounces/complaints from blast_engagement_events.
    await db.insert(blastEngagementEvents).values({
      send_log_id: sendLog.id,
      campaign_id: sendLog.campaign_id,
      contact_id: sendLog.contact_id,
      event_type: 'complaint',
    });

    // Increment complaint count
    await db
      .update(blastCampaigns)
      .set({
        total_complained: sql`${blastCampaigns.total_complained} + 1`,
      })
      .where(eq(blastCampaigns.id, campaign.id));

    // Auto-unsubscribe (complaint = unsubscribe + flag)
    await db
      .insert(blastUnsubscribes)
      .values({
        organization_id: campaign.organization_id,
        email: sendLog.to_email,
        contact_id: sendLog.contact_id,
        reason: 'Spam complaint via feedback loop',
      })
      .onConflictDoNothing();

    // Fire-and-forget `engagement.bounced` Bolt event (complaint variant).
    void emitBounceEvent({
      campaignId: sendLog.campaign_id,
      contactId: sendLog.contact_id,
      toEmail: sendLog.to_email,
      bounceType: 'complaint',
      reason: 'Spam complaint via feedback loop',
    });
  }

  return { processed: true, send_log_id: sendLog.id };
}
