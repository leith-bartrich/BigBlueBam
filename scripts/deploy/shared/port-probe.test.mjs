// Unit tests for port-probe.mjs. Uses real TCP listeners on 127.0.0.1 so
// we exercise the actual node:net behavior — no mocks. Each test grabs an
// ephemeral port (host:0), records its number, then checks that
// isPortAvailable correctly reports busy while the listener is up and free
// once it closes.

import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import {
  isPortAvailable,
  probePorts,
  suggestFreePort,
  knownConflictHint,
} from './port-probe.mjs';

/** Open a listener on a random ephemeral port and return [port, close]. */
function holdPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const addr = server.address();
      if (!addr || typeof addr !== 'object') {
        server.close();
        reject(new Error('no address'));
        return;
      }
      resolve([addr.port, () => new Promise((r) => server.close(r))]);
    });
    server.listen(0, '127.0.0.1');
  });
}

describe('isPortAvailable', () => {
  let cleanup = [];
  afterEach(async () => {
    await Promise.all(cleanup.map((c) => c()));
    cleanup = [];
  });

  it('returns false for a port currently held by another listener', async () => {
    const [port, close] = await holdPort();
    cleanup.push(close);
    expect(await isPortAvailable(port, { host: '127.0.0.1' })).toBe(false);
  });

  it('returns true after the holding listener closes', async () => {
    const [port, close] = await holdPort();
    await close();
    expect(await isPortAvailable(port, { host: '127.0.0.1' })).toBe(true);
  });
});

describe('probePorts', () => {
  let cleanup = [];
  afterEach(async () => {
    await Promise.all(cleanup.map((c) => c()));
    cleanup = [];
  });

  it('reports busy and free ports correctly in one call', async () => {
    const [busy, close] = await holdPort();
    cleanup.push(close);
    // Pick an ephemeral that we close immediately to get a "definitely
    // free" candidate. There's a tiny race here but for the duration of
    // one Promise.all it's effectively impossible to lose.
    const [free, closeFree] = await holdPort();
    await closeFree();

    // Use the same host as the listener so we don't trip on Windows'
    // permissive 0.0.0.0-vs-127.0.0.1 dual-stack behavior.
    const result = await probePorts([busy, free], { host: '127.0.0.1' });
    expect(result.get(busy)).toBe(false);
    expect(result.get(free)).toBe(true);
  });

  it('deduplicates input ports', async () => {
    const result = await probePorts([0, 0, 0]);
    // Port 0 is technically valid as "any free port" but not a normal
    // listening port — treated as available by the OS-level bind path.
    // The point of this test is that we don't end up with three entries.
    expect(result.size).toBe(1);
  });
});

describe('suggestFreePort', () => {
  let cleanup = [];
  afterEach(async () => {
    await Promise.all(cleanup.map((c) => c()));
    cleanup = [];
  });

  it('returns the preferredBase when it is free', async () => {
    // Pick a likely-free port on a typical dev machine. We can't guarantee
    // anything is free at a fixed number, so probe to find one and use that.
    const [free, closeFree] = await holdPort();
    await closeFree();
    const got = await suggestFreePort({ preferredBase: free, step: 1, maxAttempts: 1 });
    expect(got).toBe(free);
  });

  it('skips ports in the exclude set', async () => {
    const [a, closeA] = await holdPort();
    await closeA();
    const [b, closeB] = await holdPort();
    await closeB();
    const got = await suggestFreePort({
      preferredBase: a,
      step: b - a || 1,
      maxAttempts: 5,
      exclude: new Set([a]),
    });
    expect(got).not.toBe(a);
  });
});

describe('knownConflictHint', () => {
  it('returns a string for known NAS-conflict ports', () => {
    expect(knownConflictHint(80)).toMatch(/Synology|QNAP/);
    expect(knownConflictHint(32400)).toMatch(/Plex/);
    expect(knownConflictHint(8096)).toMatch(/Jellyfin|Emby/);
  });

  it('returns null for unknown ports', () => {
    expect(knownConflictHint(12345)).toBe(null);
    expect(knownConflictHint(54321)).toBe(null);
  });
});
