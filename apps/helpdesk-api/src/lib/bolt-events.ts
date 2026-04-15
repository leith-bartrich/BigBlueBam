/**
 * Canonical publishBoltEvent for helpdesk-api.
 *
 * Mirrors `@bigbluebam/shared`'s canonical 6+1 signature (event_type, source,
 * payload, org_id, actor_id?, actor_type?) so helpdesk emits the same wire
 * shape as every other service. A local copy avoids adding a new workspace
 * dependency in the helpdesk-api package.json this wave; the body is kept
 * in lock-step with packages/shared/src/bolt-events.ts and should be
 * replaced with a direct import once the helpdesk-api build adopts the
 * shared workspace dependency.
 *
 * Fire-and-forget: never throws, never blocks the caller. Bolt ingest
 * failures are swallowed so a Bolt outage cannot stall helpdesk operations.
 *
 * Event naming convention: pass the bare event name (e.g. `ticket.created`,
 * not `helpdesk.ticket.created`) and supply the `source` app name as a
 * separate argument. Bolt's drift guard rejects prefixed event strings.
 */

export type BoltActorType = 'user' | 'agent' | 'system';

function resolveBoltUrl(): string {
  return (
    process.env.BOLT_API_INTERNAL_URL ||
    process.env.BOLT_API_URL ||
    'http://bolt-api:4006'
  );
}

function resolveInternalSecret(): string {
  return process.env.INTERNAL_SERVICE_SECRET || '';
}

export async function publishBoltEvent(
  eventType: string,
  source: string,
  payload: Record<string, unknown>,
  orgId: string,
  actorId?: string | null,
  actorType?: BoltActorType,
): Promise<void> {
  try {
    const resolvedActorType: BoltActorType =
      actorType ?? (actorId ? 'user' : 'system');
    const url = `${resolveBoltUrl()}/v1/events/ingest`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': resolveInternalSecret(),
      },
      body: JSON.stringify({
        event_type: eventType,
        source,
        payload,
        org_id: orgId,
        actor_id: actorId ?? undefined,
        actor_type: resolvedActorType,
      }),
    });
  } catch {
    // Fire-and-forget. Do not break the source operation if Bolt is down.
  }
}
