// §12 Wave 5 bolt observability
// ---------------------------------------------------------------------------
// Runtime catalog drift detector.
//
// On every ingest event, we check whether (source, event_type) exists in the
// static catalog. If it does not, we fire a platform `catalog.drift_detected`
// event — once per (source, event_type) per 24 hours, suppressed via a Redis
// key with a 24h TTL. Suppression is best-effort: a Redis outage simply means
// we fall back to "always fire" rather than "never fire".
//
// Called fire-and-forget from event-ingestion.routes.ts so a catalog check
// never blocks or fails the ingest path.
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import { publishBoltEvent } from '@bigbluebam/shared';
import { getEventDefinition } from './event-catalog.js';

const SUPPRESS_TTL_SECONDS = 24 * 60 * 60; // 24h
const SUPPRESS_KEY_PREFIX = 'bolt:drift:seen:';

export interface DriftDetectorInput {
  source: string;
  eventType: string;
  eventId: string;
  orgId: string;
  actorId?: string;
}

/**
 * Check whether the given ingest event is present in the catalog. If not,
 * and we have not fired drift for this (source, event_type) in the last 24h,
 * emit a `catalog.drift_detected` platform event. Returns `true` when drift
 * was detected-and-emitted, `false` when no drift or the event was
 * suppressed.
 *
 * Never throws: a Redis error just falls through to "always fire".
 */
export async function detectCatalogDrift(
  redis: Redis,
  input: DriftDetectorInput,
  logger?: { warn: (...args: unknown[]) => void; error?: (...args: unknown[]) => void },
): Promise<boolean> {
  // Self-loop guard: the drift event itself is in the catalog, but we also
  // never want to re-enter the detector for it.
  if (
    input.source === 'platform' &&
    input.eventType === 'catalog.drift_detected'
  ) {
    return false;
  }

  const def = getEventDefinition(input.source, input.eventType);
  if (def) return false;

  const key = `${SUPPRESS_KEY_PREFIX}${input.source}:${input.eventType}`;

  try {
    // SET key 1 NX EX 86400 — atomic "fire once per 24h".
    const reply = await redis.set(key, '1', 'EX', SUPPRESS_TTL_SECONDS, 'NX');
    if (reply !== 'OK') {
      // Another ingest within 24h already fired drift for this pair.
      return false;
    }
  } catch (err) {
    logger?.warn?.(
      { err, source: input.source, event_type: input.eventType },
      'bolt drift suppression Redis check failed, firing anyway',
    );
    // Fall through to emit the event.
  }

  try {
    await publishBoltEvent(
      'catalog.drift_detected',
      'platform',
      {
        drift: {
          source: input.source,
          event_type: input.eventType,
          event_id: input.eventId,
          detected_at: new Date().toISOString(),
        },
      },
      input.orgId,
      input.actorId,
      'system',
    );
    return true;
  } catch (err) {
    logger?.error?.(
      { err, source: input.source, event_type: input.eventType },
      'bolt drift event publish failed',
    );
    return false;
  }
}
