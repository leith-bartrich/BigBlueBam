/**
 * Canonical publishBoltEvent for all BigBlueBam services.
 *
 * Fire-and-forget: never throws, never blocks the caller. If Bolt ingest is
 * unreachable the error is swallowed so the originating operation is not
 * affected.
 *
 * Event naming convention: pass the bare event name (e.g. `deal.rotting`,
 * not `bond.deal.rotting`) and supply the `source` app name as a separate
 * argument. The Bolt drift guard rejects prefixed event strings.
 *
 * Env lookup falls back across several keys so the single module works in
 * every service: BOLT_API_INTERNAL_URL is the canonical name, but the older
 * BOLT_API_URL is accepted for compatibility. INTERNAL_SERVICE_SECRET is
 * required for auth; empty string is allowed and sent as-is (ingest returns
 * 401 which is then swallowed by the outer try/catch).
 */

export type BoltActorType = 'user' | 'agent' | 'system';

function resolveBoltUrl(): string {
  const envObj = (typeof process !== 'undefined' && process.env) || {};
  return (
    envObj.BOLT_API_INTERNAL_URL ||
    envObj.BOLT_API_URL ||
    'http://bolt-api:4006'
  );
}

function resolveInternalSecret(): string {
  const envObj = (typeof process !== 'undefined' && process.env) || {};
  return envObj.INTERNAL_SERVICE_SECRET || '';
}

export async function publishBoltEvent(
  eventType: string,
  source: string,
  payload: Record<string, unknown>,
  orgId: string,
  actorId?: string,
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
        actor_id: actorId,
        actor_type: resolvedActorType,
      }),
    });
  } catch {
    // Fire-and-forget. Do not break the source operation if Bolt is down.
  }
}
