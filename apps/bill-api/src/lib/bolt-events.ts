import { env } from '../env.js';

/**
 * Publish an event to Bolt's ingest endpoint for workflow automation.
 * Fire-and-forget — never throws, never blocks the caller.
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
    const resolvedActorType = actorType ?? (actorId ? 'user' : 'system');
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
        actor_id: actorId,
        actor_type: resolvedActorType,
      }),
    });
  } catch {
    // Fire-and-forget — don't break the source operation if Bolt is down
  }
}
