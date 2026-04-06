/**
 * HB-7: Typed client for Bam's /internal/helpdesk/* surface.
 *
 * helpdesk-api uses this client (and only this client) to create or
 * mutate Bam-owned data. All direct SQL writes to `tasks`, `comments`,
 * or `activity_log` from helpdesk-api are forbidden — they have moved
 * into Bam API, which owns the data and attributes every write to the
 * shared HELPDESK_SYSTEM_USER_ID.
 *
 * Transport: Node fetch, POSTing JSON with the X-Internal-Token header.
 * Retry policy: 5xx gets one retry with short backoff (250ms). 4xx and
 * network-level errors do not retry.
 */
import { env } from '../env.js';

type Logger = {
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export interface CreateTaskFromTicketPayload {
  project_id: string;
  phase_id?: string | null;
  title: string;
  description?: string;
  description_plain?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reporter_id?: string | null;
  ticket_id: string;
  ticket_number?: number;
  customer_email?: string;
  customer_name?: string;
  customer_id?: string;
}

export interface PostCommentPayload {
  task_id: string;
  body: string;
  author_label?: string;
  is_system?: boolean;
}

export interface CreatedTaskResponse {
  id: string;
  human_id: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function callInternal<T>(
  method: 'POST',
  path: string,
  body: unknown,
  logger?: Logger,
): Promise<T> {
  const url = `${env.BBB_API_INTERNAL_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Token': env.INTERNAL_HELPDESK_SECRET,
  };

  async function attempt(): Promise<{ status: number; json: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    } finally {
      clearTimeout(timer);
    }
  }

  let resp: { status: number; json: unknown };
  try {
    resp = await attempt();
  } catch (err) {
    logger?.error({ err, url }, 'bbb-client: network error');
    throw new Error('BBB_CLIENT_NETWORK_ERROR');
  }

  if (resp.status >= 500) {
    logger?.warn({ url, status: resp.status }, 'bbb-client: 5xx, retrying once');
    await new Promise((r) => setTimeout(r, 250));
    try {
      resp = await attempt();
    } catch (err) {
      logger?.error({ err, url }, 'bbb-client: network error on retry');
      throw new Error('BBB_CLIENT_NETWORK_ERROR');
    }
  }

  if (resp.status < 200 || resp.status >= 300) {
    logger?.warn({ url, status: resp.status, body: resp.json }, 'bbb-client: non-2xx');
    const err = new Error(`BBB_CLIENT_HTTP_${resp.status}`) as Error & { status?: number; body?: unknown };
    err.status = resp.status;
    err.body = resp.json;
    throw err;
  }

  return resp.json as T;
}

export async function createTaskFromTicket(
  payload: CreateTaskFromTicketPayload,
  logger?: Logger,
): Promise<CreatedTaskResponse> {
  const json = await callInternal<{ data: CreatedTaskResponse }>(
    'POST',
    '/internal/helpdesk/tasks',
    payload,
    logger,
  );
  return json.data;
}

export async function postComment(
  payload: PostCommentPayload,
  logger?: Logger,
): Promise<void> {
  await callInternal<{ data: { id: string } }>(
    'POST',
    '/internal/helpdesk/comments',
    payload,
    logger,
  );
}

export async function moveTaskToTerminal(
  taskId: string,
  logger?: Logger,
): Promise<void> {
  await callInternal<{ data: { id: string; phase_id: string } }>(
    'POST',
    `/internal/helpdesk/tasks/${taskId}/move-to-terminal-phase`,
    undefined,
    logger,
  );
}

export async function reopenTask(
  taskId: string,
  logger?: Logger,
): Promise<void> {
  await callInternal<{ data: { id: string; phase_id: string } }>(
    'POST',
    `/internal/helpdesk/tasks/${taskId}/reopen`,
    undefined,
    logger,
  );
}

export const bbbClient = {
  createTaskFromTicket,
  postComment,
  moveTaskToTerminal,
  reopenTask,
};
