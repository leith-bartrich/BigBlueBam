import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blastSendLog,
  blastEngagementEvents,
  blastCampaigns,
  blastUnsubscribes,
  bondContacts,
} from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

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

  // Record open event
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'open',
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
  });

  // Increment campaign open count
  await db
    .update(blastCampaigns)
    .set({
      total_opened: sql`${blastCampaigns.total_opened} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

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

  if (!sendLog) return { redirect_url: url };

  // Record click event
  await db.insert(blastEngagementEvents).values({
    send_log_id: sendLog.id,
    campaign_id: sendLog.campaign_id,
    contact_id: sendLog.contact_id,
    event_type: 'click',
    clicked_url: url,
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
  });

  // Increment campaign click count
  await db
    .update(blastCampaigns)
    .set({
      total_clicked: sql`${blastCampaigns.total_clicked} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

  return { redirect_url: url };
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

  // Add to unsubscribe list (upsert — idempotent)
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
  });

  // Increment campaign unsubscribe count
  await db
    .update(blastCampaigns)
    .set({
      total_unsubscribed: sql`${blastCampaigns.total_unsubscribed} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

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
