import { env } from '../env.js';

/**
 * Publish an event to Bolt's ingest endpoint for workflow automation.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * `actorId` / `actorType` are forwarded as top-level fields on the ingest
 * request body so Bolt can resolve `{{ event.actor.id }}` in rule templates
 * (the ingest route accepts them as optional top-level fields separate from
 * the payload — see apps/bolt-api/src/routes/event-ingestion.routes.ts).
 */
export async function publishBoltEvent(
  eventType: string,
  source: string,
  payload: Record<string, unknown>,
  orgId: string,
  actorId?: string,
  actorType?: 'user' | 'agent' | 'system',
) {
  try {
    const url = `${env.BOLT_API_INTERNAL_URL}/v1/events/ingest`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': env.INTERNAL_SERVICE_SECRET || '',
      },
      body: JSON.stringify({
        event_type: eventType,
        source,
        payload,
        org_id: orgId,
        ...(actorId ? { actor_id: actorId } : {}),
        ...(actorType ? { actor_type: actorType } : {}),
      }),
    });
  } catch {
    // Fire-and-forget — don't break the source operation if Bolt is down
  }
}
