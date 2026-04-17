/**
 * Helpdesk email notification worker.
 *
 * Handles transactional emails for the helpdesk module:
 *   - verification: email verification for new helpdesk portal users
 *   - password_reset: password reset link for helpdesk portal users
 *   - reply_notification: notify customer when an agent replies
 *   - status_change: notify customer when ticket status changes
 *
 * Uses nodemailer. When SMTP_HOST is not set, logs the email content
 * instead of sending (development mode).
 */

import nodemailer from 'nodemailer';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import type { Env } from '../env.js';
import { getSmtpConfig, type ResolvedSmtpConfig } from '../utils/smtp-config.js';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelpdeskEmailType =
  | 'verification'
  | 'password_reset'
  | 'reply_notification'
  | 'status_change';

export interface HelpdeskEmailNotifyJobData {
  type: HelpdeskEmailType;
  to: string;
  subject?: string;
  /** Template variables interpolated into the email body. */
  vars: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Transport cache (same pattern as email.job.ts)
// ---------------------------------------------------------------------------

let cachedTransport: nodemailer.Transporter | null = null;
let cachedFingerprint: string | null = null;

function fingerprintConfig(cfg: ResolvedSmtpConfig): string {
  return [cfg.host, cfg.port, cfg.user ?? '', cfg.pass ?? '', cfg.secure].join('|');
}

async function resolveTransport(env: Env): Promise<nodemailer.Transporter | null> {
  const cfg = await getSmtpConfig(getDb(), env);
  if (!cfg) return null;
  const fp = fingerprintConfig(cfg);
  if (cachedTransport && fp === cachedFingerprint) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  cachedFingerprint = fp;
  return cachedTransport;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildEmail(type: HelpdeskEmailType, vars: Record<string, string>): {
  subject: string;
  html: string;
  text: string;
} {
  switch (type) {
    case 'verification':
      return {
        subject: 'Verify your email address',
        html: `<p>Hello ${vars.name ?? ''},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${vars.link ?? '#'}">Verify Email</a></p><p>If you did not create an account, you can ignore this email.</p>`,
        text: `Hello ${vars.name ?? ''},\n\nPlease verify your email by visiting: ${vars.link ?? '#'}\n\nIf you did not create an account, you can ignore this email.`,
      };

    case 'password_reset':
      return {
        subject: 'Reset your password',
        html: `<p>Hello ${vars.name ?? ''},</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${vars.link ?? '#'}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
        text: `Hello ${vars.name ?? ''},\n\nReset your password at: ${vars.link ?? '#'}\n\nThis link expires in 1 hour.`,
      };

    case 'reply_notification':
      return {
        subject: `Re: ${vars.ticket_subject ?? 'Your support request'}`,
        html: `<p>Hello ${vars.name ?? ''},</p><p>An agent has replied to your support request <strong>#${vars.ticket_number ?? ''}</strong>:</p><blockquote style="border-left: 3px solid #e5e7eb; padding-left: 12px; color: #4b5563;">${vars.reply_body ?? ''}</blockquote><p>You can reply to this email or visit your <a href="${vars.portal_link ?? '#'}">support portal</a> to continue the conversation.</p>`,
        text: `Hello ${vars.name ?? ''},\n\nAn agent replied to ticket #${vars.ticket_number ?? ''}:\n\n${vars.reply_body ?? ''}\n\nVisit your support portal: ${vars.portal_link ?? '#'}`,
      };

    case 'status_change':
      return {
        subject: `Ticket #${vars.ticket_number ?? ''} status updated to ${vars.new_status ?? ''}`,
        html: `<p>Hello ${vars.name ?? ''},</p><p>The status of your support request <strong>#${vars.ticket_number ?? ''}</strong> has been updated to <strong>${vars.new_status ?? ''}</strong>.</p><p>${vars.new_status === 'resolved' ? 'If your issue is not fully resolved, please reply and we will reopen the ticket.' : ''}</p><p><a href="${vars.portal_link ?? '#'}">View in support portal</a></p>`,
        text: `Hello ${vars.name ?? ''},\n\nTicket #${vars.ticket_number ?? ''} status updated to: ${vars.new_status ?? ''}.\n\n${vars.new_status === 'resolved' ? 'If your issue is not fully resolved, please reply and we will reopen the ticket.' : ''}\n\nView in portal: ${vars.portal_link ?? '#'}`,
      };

    default:
      return {
        subject: 'Helpdesk notification',
        html: `<p>${JSON.stringify(vars)}</p>`,
        text: JSON.stringify(vars),
      };
  }
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

export async function processHelpdeskEmailNotifyJob(
  job: Job<HelpdeskEmailNotifyJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const { type, to, vars } = job.data;
  const email = buildEmail(type, vars);
  const subject = job.data.subject ?? email.subject;

  logger.info(
    { jobId: job.id, type, to, subject },
    'helpdesk-email-notify: processing',
  );

  const transport = await resolveTransport(env);

  if (!transport) {
    logger.warn(
      { type, to, subject, html: email.html.substring(0, 200) },
      'helpdesk-email-notify: SMTP not configured, logging email instead of sending',
    );
    return;
  }

  const cfg = await getSmtpConfig(getDb(), env);

  await transport.sendMail({
    from: cfg?.from ?? env.EMAIL_FROM,
    to,
    subject,
    html: email.html,
    text: email.text,
  });

  logger.info({ jobId: job.id, type, to }, 'helpdesk-email-notify: sent');
}
