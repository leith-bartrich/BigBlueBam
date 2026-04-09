import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blastSendLog,
  blastCampaigns,
  blastUnsubscribes,
} from '../db/schema/index.js';

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

  if (!sendLog && payload.email) {
    [sendLog] = await db
      .select()
      .from(blastSendLog)
      .where(eq(blastSendLog.to_email, payload.email))
      .limit(1);
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

  // Increment campaign bounce count
  await db
    .update(blastCampaigns)
    .set({
      total_bounced: sql`${blastCampaigns.total_bounced} + 1`,
    })
    .where(eq(blastCampaigns.id, sendLog.campaign_id));

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

  if (!sendLog && payload.email) {
    [sendLog] = await db
      .select()
      .from(blastSendLog)
      .where(eq(blastSendLog.to_email, payload.email))
      .limit(1);
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
  }

  return { processed: true, send_log_id: sendLog.id };
}
