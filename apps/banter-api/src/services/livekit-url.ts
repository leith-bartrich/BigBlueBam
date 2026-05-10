import type { FastifyRequest } from 'fastify';
import { env } from '../env.js';

/**
 * Resolve the LiveKit WebSocket URL the browser should use to connect to
 * the SFU.
 *
 * Why this exists: the previous behavior was to return env.LIVEKIT_WS_URL
 * unconditionally. The default value `ws://localhost:7880` is reachable
 * only when the browser is on the docker host's localhost — every other
 * deployment shape (Railway, NAS LAN, second machine on the same Wi-Fi)
 * silently fails because the browser can't resolve the hostname or
 * reach the port. Symptoms ranged from "calling tries to connect and
 * never succeeds" to mic/camera permission errors with no visible
 * connection attempt.
 *
 * Resolution order:
 *   1. If LIVEKIT_WS_URL is set explicitly to a NON-default value, use
 *      it verbatim. Operators with a real public LiveKit endpoint
 *      (e.g. `wss://livekit.example.com`) need this escape hatch.
 *   2. Otherwise, derive from the request's Host header:
 *        scheme    = "wss" if request was https else "ws"
 *        hostname  = bare host from the Host header (port stripped)
 *        port      = LIVEKIT_RTC_PORT env var (default 7880)
 *      So a browser hitting https://bbb.example.com gets
 *      `wss://bbb.example.com:7880`, and a browser on
 *      `http://nas.local:8080` gets `ws://nas.local:7880`.
 *
 * The default port stays 7880 unless the operator remapped it via the
 * advanced-port-mapping deploy flow (LIVEKIT_RTC_PORT in .env). Browsers
 * can't reach the LiveKit container's internal port without the host
 * binding, so the public-facing port is what we return.
 */

const DEFAULT_LIVEKIT_WS_URL = 'ws://localhost:7880';

export function resolveLivekitWsUrl(request: FastifyRequest): string {
  const explicit = env.LIVEKIT_WS_URL;
  if (explicit && explicit !== DEFAULT_LIVEKIT_WS_URL) {
    return explicit;
  }

  // Derive from request. Fastify's `request.hostname` strips the port
  // automatically; `request.protocol` reflects X-Forwarded-Proto when
  // trustProxy is enabled (which it is via the existing nginx setup).
  const protocol = request.protocol === 'https' ? 'wss' : 'ws';
  const host = request.hostname || 'localhost';
  // LIVEKIT_RTC_PORT is read from the environment at request time so a
  // deploy script change to remap the port lands without a service
  // restart. Default 7880 matches LiveKit's upstream default.
  const rtcPort = process.env.LIVEKIT_RTC_PORT
    ? Number(process.env.LIVEKIT_RTC_PORT)
    : 7880;
  return `${protocol}://${host}:${rtcPort}`;
}
