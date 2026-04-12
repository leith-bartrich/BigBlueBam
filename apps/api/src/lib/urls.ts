// ---------------------------------------------------------------------------
// URL builders for deep-links into the Bam SPA.
//
// Used by Bolt event payloads, notifications, Slack, and anywhere else we
// need to hand off a canonical link to a Bam entity. The base URL comes from
// env.FRONTEND_URL (default `http://localhost/b3`) so it stays consistent with
// the existing slack-notify.service.ts / email-queue.ts link building.
// ---------------------------------------------------------------------------

import { env } from '../env.js';

function base(): string {
  return env.FRONTEND_URL.replace(/\/$/, '');
}

export function taskUrl(projectId: string, taskId: string): string {
  return `${base()}/projects/${projectId}/board?task=${taskId}`;
}

export function projectUrl(projectId: string): string {
  return `${base()}/projects/${projectId}`;
}

export function sprintUrl(projectId: string, sprintId: string): string {
  return `${base()}/projects/${projectId}/sprints/${sprintId}`;
}

export function epicUrl(projectId: string, epicId: string): string {
  return `${base()}/projects/${projectId}/epics/${epicId}`;
}
