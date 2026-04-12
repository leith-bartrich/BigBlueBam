/**
 * Fire-and-forget Bolt event publisher for the worker process.
 *
 * Mirrors apps/bond-api/src/lib/bolt-events.ts but is kept local to the worker
 * so the worker does not cross-import from bond-api (workspace boundary rule).
 *
 * Contract:
 *   - Never throws. A failed POST is logged via the provided logger and the
 *     caller proceeds. Callers rely on this to keep batch sweeps moving even
 *     when bolt-api is down.
 *   - 5 second abort timeout per request.
 *   - Source is configurable; stale-deal sweep uses 'bond'.
 */

import type { Logger } from 'pino';

export interface PublishBoltEventOptions {
  /** Logical source app emitting the event (e.g. 'bond'). */
  source: string;
  /** Optional actor id — system events (cron sweeps) omit this. */
  actorId?: string;
  /** Optional actor type — system events pass 'system'. */
  actorType?: string;
  /** Override the base URL (mostly for tests). Defaults to env BOLT_API_INTERNAL_URL. */
  boltApiUrl?: string;
  /** Override the shared secret. Defaults to env INTERNAL_SERVICE_SECRET. */
  internalSecret?: string;
  /** Abort timeout in ms (default 5000). */
  timeoutMs?: number;
}

/**
 * Publish a single event to Bolt's ingest endpoint.
 * Always returns — errors are swallowed after being logged.
 */
export async function publishBoltEvent(
  eventType: string,
  payload: Record<string, unknown>,
  orgId: string,
  opts: PublishBoltEventOptions,
  logger: Logger,
): Promise<void> {
  const boltApiUrl = opts.boltApiUrl ?? process.env.BOLT_API_INTERNAL_URL ?? 'http://bolt-api:4006';
  const internalSecret = opts.internalSecret ?? process.env.INTERNAL_SERVICE_SECRET ?? '';
  const timeoutMs = opts.timeoutMs ?? 5000;

  const url = `${boltApiUrl}/v1/events/ingest`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
      },
      body: JSON.stringify({
        event_type: eventType,
        source: opts.source,
        payload,
        org_id: orgId,
        actor_id: opts.actorId,
        actor_type: opts.actorType,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn(
        { eventType, orgId, status: res.status },
        'publishBoltEvent: non-2xx response from bolt-api',
      );
    }
  } catch (err) {
    // Fire-and-forget — never rethrow. Batch sweeps must keep going even when
    // bolt-api is unreachable or times out.
    logger.warn(
      { eventType, orgId, err: err instanceof Error ? err.message : String(err) },
      'publishBoltEvent: failed to publish event (swallowed)',
    );
  } finally {
    clearTimeout(timeout);
  }
}
