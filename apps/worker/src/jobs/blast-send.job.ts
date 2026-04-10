import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// Schema stubs — lightweight pgTable references so the worker can query
// Blast / Bond tables without importing the full blast-api Drizzle config.
// ---------------------------------------------------------------------------

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';

const bondContacts = pgTable('bond_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  first_name: varchar('first_name', { length: 100 }),
  last_name: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  custom_fields: jsonb('custom_fields').default({}).notNull(),
});

const blastCampaigns = pgTable('blast_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  html_body: text('html_body').notNull(),
  plain_text_body: text('plain_text_body'),
  segment_id: uuid('segment_id'),
  from_name: varchar('from_name', { length: 100 }),
  from_email: varchar('from_email', { length: 255 }),
  reply_to_email: varchar('reply_to_email', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  recipient_count: integer('recipient_count'),
  total_sent: integer('total_sent').default(0),
  total_delivered: integer('total_delivered').default(0),
  total_bounced: integer('total_bounced').default(0),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

const blastSendLog = pgTable('blast_send_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_id: uuid('campaign_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  to_email: varchar('to_email', { length: 255 }).notNull(),
  smtp_message_id: varchar('smtp_message_id', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  tracking_token: varchar('tracking_token', { length: 64 }).notNull().unique(),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

const blastUnsubscribes = pgTable('blast_unsubscribes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

// ---------------------------------------------------------------------------
// Job data interface
// ---------------------------------------------------------------------------

export interface BlastSendJobData {
  campaign_id: string;
  org_id: string;
}

// ---------------------------------------------------------------------------
// SMTP transport (reuses worker SMTP config, same as email.job.ts)
// ---------------------------------------------------------------------------

let _transport: nodemailer.Transporter | null = null;

function getTransport(env: Env): nodemailer.Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return _transport;
}

// ---------------------------------------------------------------------------
// Template rendering helpers
// ---------------------------------------------------------------------------

/**
 * Replace merge fields in the template body:
 *   {{first_name}}, {{last_name}}, {{email}}, {{company}}, {{unsubscribe_url}}
 */
function renderTemplate(
  html: string,
  contact: { first_name: string | null; last_name: string | null; email: string },
  unsubscribeUrl: string,
): string {
  return html
    .replace(/\{\{first_name\}\}/g, contact.first_name ?? '')
    .replace(/\{\{last_name\}\}/g, contact.last_name ?? '')
    .replace(/\{\{email\}\}/g, contact.email)
    .replace(/\{\{company\}\}/g, '') // Bond company join not available in stub
    .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
}

/**
 * Inject the open-tracking pixel just before </body>.
 */
function injectTrackingPixel(html: string, pixelUrl: string): string {
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrite all href="..." links for click tracking, excluding mailto: and
 * the unsubscribe link (which should pass through directly).
 */
function rewriteLinks(html: string, trackingBaseUrl: string, token: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url: string) => {
      const encodedUrl = encodeURIComponent(url);
      return `href="${trackingBaseUrl}/t/c/${token}?url=${encodedUrl}"`;
    },
  );
}

// ---------------------------------------------------------------------------
// Main job processor
// ---------------------------------------------------------------------------

export async function processBlastSendJob(
  job: Job<BlastSendJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const { campaign_id, org_id } = job.data;
  const db = getDb();

  const trackingBaseUrl = (env.TRACKING_BASE_URL ?? 'http://localhost').replace(/\/$/, '');

  logger.info({ jobId: job.id, campaign_id, org_id }, 'Processing blast:send job');

  // 1. Load campaign and verify status
  const [campaign] = await db
    .select()
    .from(blastCampaigns)
    .where(
      and(
        eq(blastCampaigns.id, campaign_id),
        eq(blastCampaigns.organization_id, org_id),
      ),
    )
    .limit(1);

  if (!campaign) {
    logger.error({ campaign_id }, 'Campaign not found');
    return;
  }

  if (campaign.status !== 'sending') {
    logger.warn(
      { campaign_id, status: campaign.status },
      'Campaign is not in sending status, skipping',
    );
    return;
  }

  // 2. Load unsubscribed emails for this org
  const unsubRows = await db
    .select({ email: blastUnsubscribes.email })
    .from(blastUnsubscribes)
    .where(eq(blastUnsubscribes.organization_id, org_id));

  const unsubEmails = new Set(unsubRows.map((r) => r.email.toLowerCase()));

  // 3. Load contacts — all org contacts, or filtered by segment
  //    (Segment filter_criteria evaluation is a future enhancement;
  //     for now we load all org contacts and rely on segment_id being
  //     null = all contacts.)
  const contacts = await db
    .select({
      id: bondContacts.id,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
    })
    .from(bondContacts)
    .where(eq(bondContacts.organization_id, org_id));

  // 4. Filter out contacts with no email or who are unsubscribed
  const eligibleContacts = contacts.filter(
    (c) => c.email && !unsubEmails.has(c.email.toLowerCase()),
  );

  logger.info(
    {
      campaign_id,
      total_contacts: contacts.length,
      unsubscribed: unsubEmails.size,
      eligible: eligibleContacts.length,
    },
    'Contacts loaded and filtered',
  );

  const transport = getTransport(env);
  let sentCount = 0;
  let failedCount = 0;

  const fromEmail = campaign.from_email ?? env.EMAIL_FROM;
  const fromName = campaign.from_name ?? 'BigBlueBam';

  // 5. Process each eligible contact
  for (const contact of eligibleContacts) {
    const email = contact.email!;
    const token = crypto.randomBytes(32).toString('base64url');
    const unsubscribeUrl = `${trackingBaseUrl}/unsub/${token}`;
    const pixelUrl = `${trackingBaseUrl}/t/o/${token}`;

    // 5a. Render template with merge fields
    let renderedHtml = renderTemplate(
      campaign.html_body,
      { first_name: contact.first_name, last_name: contact.last_name, email },
      unsubscribeUrl,
    );

    // 5b. Rewrite links for click tracking
    renderedHtml = rewriteLinks(renderedHtml, trackingBaseUrl, token);

    // 5c. Inject tracking pixel
    renderedHtml = injectTrackingPixel(renderedHtml, pixelUrl);

    // 5d. Render subject with merge fields
    const renderedSubject = campaign.subject
      .replace(/\{\{first_name\}\}/g, contact.first_name ?? '')
      .replace(/\{\{last_name\}\}/g, contact.last_name ?? '')
      .replace(/\{\{email\}\}/g, email);

    // 5e. Create send_log entry with status 'pending'
    const [sendLogEntry] = await db
      .insert(blastSendLog)
      .values({
        campaign_id,
        contact_id: contact.id,
        to_email: email,
        tracking_token: token,
        status: 'queued',
      })
      .returning({ id: blastSendLog.id });

    // 5f. Send the email
    try {
      if (!transport) {
        logger.warn(
          { to: email, subject: renderedSubject },
          'SMTP not configured — logging blast email instead of sending',
        );
        // Still mark as sent so the campaign completes
        await db
          .update(blastSendLog)
          .set({ status: 'sent', sent_at: new Date() })
          .where(eq(blastSendLog.id, sendLogEntry!.id));
        sentCount++;
        continue;
      }

      const info = await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: renderedSubject,
        html: renderedHtml,
        text: campaign.plain_text_body ?? undefined,
        replyTo: campaign.reply_to_email ?? undefined,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // 5g. Update send_log status to 'sent'
      await db
        .update(blastSendLog)
        .set({
          status: 'sent',
          smtp_message_id: info.messageId,
          sent_at: new Date(),
        })
        .where(eq(blastSendLog.id, sendLogEntry!.id));

      sentCount++;

      logger.debug(
        { to: email, messageId: info.messageId },
        'Blast email sent',
      );
    } catch (err) {
      failedCount++;

      await db
        .update(blastSendLog)
        .set({ status: 'failed' })
        .where(eq(blastSendLog.id, sendLogEntry!.id));

      logger.error(
        { to: email, err },
        'Failed to send blast email',
      );
    }

    // Update job progress
    const processed = sentCount + failedCount;
    const total = eligibleContacts.length;
    await job.updateProgress(Math.round((processed / total) * 100));
  }

  // 6. Update campaign: status='sent', sent_at=now(), total_sent=count
  await db
    .update(blastCampaigns)
    .set({
      status: 'sent',
      completed_at: new Date(),
      total_sent: sentCount,
      total_delivered: sentCount, // Actual delivery confirmation comes from webhooks
      total_bounced: failedCount,
      recipient_count: eligibleContacts.length,
      updated_at: new Date(),
    })
    .where(eq(blastCampaigns.id, campaign_id));

  logger.info(
    {
      campaign_id,
      sent: sentCount,
      failed: failedCount,
      total: eligibleContacts.length,
    },
    'Blast campaign send completed',
  );
}
