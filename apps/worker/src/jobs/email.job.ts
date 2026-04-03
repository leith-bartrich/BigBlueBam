import nodemailer from 'nodemailer';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import type { Env } from '../env.js';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let _transport: nodemailer.Transporter | null = null;

function getTransport(env: Env): nodemailer.Transporter | null {
  if (!env.SMTP_HOST) {
    return null;
  }
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
  }
  return _transport;
}

export async function processEmailJob(
  job: Job<EmailJobData>,
  env: Env,
  logger: Logger,
): Promise<void> {
  const { to, subject, html, text } = job.data;

  logger.info({ jobId: job.id, to, subject }, 'Processing email job');

  const transport = getTransport(env);

  if (!transport) {
    logger.warn(
      { to, subject, html: html.substring(0, 200), text: text?.substring(0, 200) },
      'SMTP not configured — logging email instead of sending',
    );
    return;
  }

  const info = await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text: text ?? undefined,
  });

  logger.info({ jobId: job.id, messageId: info.messageId }, 'Email sent successfully');
}
