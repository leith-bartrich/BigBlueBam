import { env } from '../env.js';

/**
 * Publish an event to Bolt's ingest endpoint for workflow automation.
 * Fire-and-forget -- never throws, never blocks the caller.
 */
export async function publishBoltEvent(
  eventType: string,
  payload: Record<string, unknown>,
  orgId: string,
) {
  try {
    const url = `${env.BOLT_API_INTERNAL_URL}/v1/events/ingest`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': env.INTERNAL_SERVICE_SECRET || '',
        },
        body: JSON.stringify({
          event_type: eventType,
          source: 'bond',
          payload,
          org_id: orgId,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Fire-and-forget -- don't break the source operation if Bolt is down
  }
}
