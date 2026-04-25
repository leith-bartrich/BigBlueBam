// Host-port conflict detection. Used by the advanced-port-mapping flow to
// tell the operator which BigBlueBam-default host ports are already taken
// before they pick a remap.
//
// Why we go to the trouble: NAS distributions have notorious overlap with
// the BigBlueBam default ports (Synology DSM on 80/443, QNAP QTS UI on 8080,
// Plex on 32400, etc.). If the deploy flow just plows ahead with the
// defaults and `docker compose up` fails halfway through with a "port is
// already allocated" error, the operator has to dig through compose error
// output to figure out which port it was — and we already know! So probe
// up front and surface it as part of the prompt.
//
// We do this by trying to bind a TCP listener on 0.0.0.0:<port>. Any error
// is treated as "already in use" — EADDRINUSE is the common case but
// EACCES (Linux ports < 1024 without privilege) and ENETDOWN are also
// reported as conflicts so we don't suggest a port the operator can't bind.
//
// Caveats acknowledged up front:
//   - This probes the HOST kernel, not the docker network. If the operator
//     plans to deploy this stack on a *different* machine than the one the
//     deploy script is running on, the probe is meaningless — but in
//     practice the docker-compose adapter only deploys to the local host.
//   - We can't tell *which* process is using a port without root. The
//     known-conflict catalog below lets us guess the most likely culprit
//     and word the suggestion accordingly.

import { createServer } from 'node:net';

/**
 * Catalog of "if THIS port is in use on a NAS, the conflict is most likely
 * THIS service" — used to enrich the suggestion text. Keep this list short
 * and high-signal; it's a hint, not a database.
 */
const KNOWN_CONFLICTS = {
  80: 'Synology DSM, QNAP QTS, or another web server',
  443: 'Synology DSM, QNAP QTS, or another HTTPS service',
  3000: 'Grafana, Sonarr, or a Node.js dev server',
  5000: 'Synology DSM Photo Station, UPnP services, or Flask defaults',
  5001: 'Synology DSM (HTTPS), or .NET Core defaults',
  7878: 'Radarr',
  8080: 'QNAP QTS, Tomcat, Jenkins, or another secondary web UI',
  8081: 'Sonarr (legacy), Photoprism, or Adminer',
  8096: 'Jellyfin / Emby',
  8200: 'Synology DLNA Media Server',
  8443: 'Synology / Unifi controller HTTPS UI',
  9000: 'Portainer or MinIO console',
  9090: 'Prometheus or Cockpit',
  9091: 'Transmission',
  32400: 'Plex Media Server',
};

/**
 * Try to bind a TCP listener on the given port on 0.0.0.0. Resolves to true
 * if the bind succeeds (port is available), false otherwise. Closes the
 * listener immediately on success. Times out after 1 second to avoid hangs
 * in pathological network environments.
 *
 * @param {number} port
 * @param {{ host?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port, opts = {}) {
  const host = opts.host ?? '0.0.0.0';
  const timeoutMs = opts.timeoutMs ?? 1_000;

  return new Promise((resolve) => {
    const server = createServer();
    let resolved = false;
    const finish = (available) => {
      if (resolved) return;
      resolved = true;
      try { server.close(); } catch { /* swallow */ }
      resolve(available);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    server.once('error', () => {
      clearTimeout(timer);
      finish(false);
    });
    server.once('listening', () => {
      clearTimeout(timer);
      finish(true);
    });

    try {
      server.listen(port, host);
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

/**
 * Probe an array of ports concurrently. Returns a Map<port, available>.
 *
 * @param {number[]} ports
 * @param {{ host?: string }} [opts] - Forwarded to isPortAvailable.
 */
export async function probePorts(ports, opts = {}) {
  const unique = Array.from(new Set(ports.filter((p) => Number.isInteger(p))));
  const entries = await Promise.all(
    unique.map(async (p) => [p, await isPortAvailable(p, opts)]),
  );
  return new Map(entries);
}

/**
 * Suggest a remap port. We look for the next free port at +N steps from a
 * "common alternate" base (8080 → 8090 → 8100 …) so the suggestions look
 * sensible to a human (not 53281 or whatever random thing was free first).
 * Skips ports the operator already chose for OTHER bindings to avoid
 * collisions inside the new mapping.
 *
 * @param {object} opts
 * @param {number} opts.preferredBase - First candidate (e.g. 8080 for HTTP).
 * @param {number} [opts.step=10] - Step between candidates.
 * @param {number} [opts.maxAttempts=20]
 * @param {Set<number>} [opts.exclude] - Ports already chosen by the operator.
 * @returns {Promise<number | null>}
 */
export async function suggestFreePort({ preferredBase, step = 10, maxAttempts = 20, exclude = new Set() }) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = preferredBase + i * step;
    if (candidate > 65535) break;
    if (exclude.has(candidate)) continue;
    if (await isPortAvailable(candidate)) return candidate;
  }
  // Fall back to a less pretty but available port.
  for (let candidate = 49152; candidate <= 65535; candidate += 1) {
    if (exclude.has(candidate)) continue;
    if (await isPortAvailable(candidate)) return candidate;
  }
  return null;
}

/**
 * Human-readable hint for a known port conflict. Returns null if we have
 * nothing useful to say (caller should fall back to a generic message).
 *
 * @param {number} port
 */
export function knownConflictHint(port) {
  return KNOWN_CONFLICTS[port] ?? null;
}
