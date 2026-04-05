// Lightweight BullMQ producer for the shared `email` queue.
//
// The worker service (apps/worker) owns actual SMTP delivery via
// processEmailJob. The API only enqueues jobs here. Job shape must match
// apps/worker/src/jobs/email.job.ts → EmailJobData.
//
// We expose sendGuestInvitationEmail as the single caller for P1-30. The
// function returns `email_sent` = true only when the job was successfully
// enqueued AND SMTP is configured. When SMTP is unset, we still enqueue so
// the worker will log it, but we return email_sent = false so the API
// response accurately reflects that the invitee was not actually emailed.

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env.js';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let _queue: Queue<EmailJobData> | null = null;

function getQueue(): Queue<EmailJobData> {
  if (!_queue) {
    const connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    _queue = new Queue<EmailJobData>('email', { connection });
  }
  return _queue;
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface GuestInvitationEmailParams {
  to: string;
  token: string;
  orgName: string;
  inviterName: string;
}

/**
 * Enqueue a guest invitation email containing the acceptance link.
 * Returns true if the job was successfully enqueued, false otherwise.
 * Callers should still treat SMTP-unconfigured as `email_sent: false`.
 */
export async function sendGuestInvitationEmail(
  params: GuestInvitationEmailParams,
): Promise<boolean> {
  const { to, token, orgName, inviterName } = params;
  const acceptUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/guests/accept/${token}`;

  const safeOrg = escapeHtml(orgName);
  const safeInviter = escapeHtml(inviterName);
  const safeUrl = escapeHtml(acceptUrl);

  const subject = `You've been invited to ${orgName} on BigBlueBam`;
  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
<h2>You've been invited to ${safeOrg}</h2>
<p>${safeInviter} has invited you to collaborate on BigBlueBam.</p>
<p>
  <a href="${safeUrl}"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">
    Accept invitation
  </a>
</p>
<p>Or copy this link into your browser:<br/><code>${safeUrl}</code></p>
<p style="color:#666;font-size:12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
</body></html>`;

  const text = `You've been invited to ${orgName} on BigBlueBam by ${inviterName}.

Accept your invitation: ${acceptUrl}

If you weren't expecting this invitation, you can safely ignore this email.`;

  try {
    await getQueue().add(
      'guest-invitation',
      { to, subject, html, text },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
    return isSmtpConfigured();
  } catch {
    return false;
  }
}
