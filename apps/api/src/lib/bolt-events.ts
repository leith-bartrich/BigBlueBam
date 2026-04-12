import { env } from '../env.js';

/**
 * Publish an event to Bolt's ingest endpoint for workflow automation.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param actorId  user.id of whoever triggered the action (undefined for system events)
 * @param actorType defaults to 'user' if actorId is set, otherwise 'system'
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
    const resolvedActorType = actorType ?? (actorId ? 'user' : 'system');
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
        actor_id: actorId,
        actor_type: resolvedActorType,
      }),
    });
  } catch {
    // Fire-and-forget — don't break the source operation if Bolt is down
  }
}
