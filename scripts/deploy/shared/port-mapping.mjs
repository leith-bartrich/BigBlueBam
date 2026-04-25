// Advanced port mapping prompt. Optional branch off the main deploy flow
// triggered by a "yes" to "Do any of the BigBlueBam default ports conflict
// with something already running?". Walks the operator through:
//
//   1. Background — what BigBlueBam binds to the host and why a NAS user
//      almost certainly hits a conflict on at least one of these.
//   2. Auto-probe — try to bind each default port and report which are free,
//      which are taken, with a hint about the likely culprit when known.
//   3. Per-port remap with a smart suggested replacement that avoids common
//      NAS conflicts (Plex on 32400, Jellyfin on 8096, etc.).
//   4. Optional override of the http/https scheme — a NAS at nas.local with
//      no certificate is plain http on a non-standard port; the laptop
//      default of "https for any non-localhost domain" is wrong there.
//
// Returns a `portConfig` object that main.mjs threads into buildEnvConfig
// (so URL formation knows about the chosen ports) and writeEnvFile (so the
// remap is persisted in .env for compose to read).

import { ask, confirm } from './prompt.mjs';
import { bold, dim, check, cyan, yellow, red, green } from './colors.mjs';
import {
  probePorts,
  isPortAvailable,
  suggestFreePort,
  knownConflictHint,
} from './port-probe.mjs';
import { parsePort } from './public-url.mjs';

/**
 * Default ports BigBlueBam wants to bind on the host when the docker-compose
 * adapter brings the stack up. Each entry has:
 *   - envKey: the .env variable that overrides it (read by docker-compose.yml)
 *   - default: the upstream-default host port
 *   - label: short human-readable name for the prompt
 *   - description: one sentence explaining what it's for
 *   - alternateBase: the port we start suggesting from on a remap (chosen to
 *     stay readable and to avoid the most common NAS conflicts)
 *   - required: whether this binding is mandatory for the stack to function
 *     (LiveKit and the dev-mode service ports are not).
 */
export const PORT_BINDINGS = [
  {
    envKey: 'HTTP_PORT',
    default: 80,
    label: 'HTTP (nginx, all apps)',
    description: 'The main entry point. Every app and API is reached through this port.',
    alternateBase: 8080,
    required: true,
  },
  {
    envKey: 'HTTPS_PORT',
    default: 443,
    label: 'HTTPS (nginx, TLS)',
    description: 'TLS variant of the main entry point. Used when you have a certificate configured.',
    alternateBase: 8443,
    required: true,
  },
  {
    envKey: 'LIVEKIT_RTC_PORT',
    default: 7880,
    label: 'LiveKit RTC (voice/video signaling)',
    description: 'Used by Board whiteboards, Banter huddles, and the voice agent. Skip if you opted out of LiveKit.',
    alternateBase: 17880,
    required: false,
  },
  {
    envKey: 'LIVEKIT_TCP_PORT',
    default: 7881,
    label: 'LiveKit TCP fallback',
    description: 'TCP transport for clients behind restrictive firewalls. Only matters with LiveKit.',
    alternateBase: 17881,
    required: false,
  },
];

/**
 * Print the "should you do advanced port mapping?" briefing. Returns true
 * if the operator wants to walk through the advanced flow.
 *
 * Probes the default ports up front so we can give a real answer to "do
 * I need this?" without making the operator guess.
 *
 * @param {{ skipLiveKit?: boolean }} opts
 */
export async function promptShouldRemap(opts = {}) {
  const bindings = opts.skipLiveKit
    ? PORT_BINDINGS.filter((b) => !b.envKey.startsWith('LIVEKIT_'))
    : PORT_BINDINGS;

  console.log('');
  console.log(bold('Port mapping check'));
  console.log('');
  console.log(dim('  BigBlueBam binds these ports on the machine running Docker:'));
  console.log('');
  for (const b of bindings) {
    const required = b.required ? '' : dim(' (optional)');
    console.log(`    ${dim('•')} ${String(b.default).padStart(5)} — ${b.label}${required}`);
  }
  console.log('');
  console.log(dim('  Most laptops have these free. NAS systems (Synology, QNAP, TrueNAS,'));
  console.log(dim('  Unraid) almost always have something on 80/443 already (the device admin'));
  console.log(dim('  UI), and may have 7880/7881 taken by other media services. If any of these'));
  console.log(dim('  ports are in use, the deploy will fail with a "port is already allocated"'));
  console.log(dim('  error and you will have to come back here anyway. Better to deal with it'));
  console.log(dim('  now.'));
  console.log('');

  process.stdout.write(dim('  Probing your machine for conflicts... '));
  const probeMap = await probePorts(bindings.map((b) => b.default));
  const conflicts = bindings.filter((b) => probeMap.get(b.default) === false);
  console.log(check);
  console.log('');

  if (conflicts.length === 0) {
    console.log(`  ${green('All default ports are free on this machine.')}`);
    console.log(dim('  You can safely accept the defaults. If you still want to remap (e.g. you'));
    console.log(dim('  are deploying to a different machine, or your router NATs to non-default'));
    console.log(dim('  external ports), say yes below.'));
    console.log('');
    return await confirm('Customize port mappings anyway?', false);
  }

  console.log(`  ${yellow(`${conflicts.length} port(s) are already in use:`)}`);
  for (const b of conflicts) {
    const hint = knownConflictHint(b.default);
    const hintText = hint ? ` ${dim('— probably')} ${hint}` : '';
    console.log(`    ${red('×')} ${b.default} (${b.label})${hintText}`);
  }
  console.log('');
  console.log(dim('  You will need to remap these to free ports. The next prompts will walk'));
  console.log(dim('  you through it and suggest replacements that avoid common conflicts.'));
  console.log('');
  return await confirm('Continue to advanced port mapping?', true);
}

/**
 * Walk the operator through choosing a host port for each binding. For
 * each port: probe whether the default is free, suggest a replacement if
 * not, accept the operator's free-text override.
 *
 * @param {{ skipLiveKit?: boolean }} opts
 * @returns {Promise<{
 *   ports: Record<string, number>,
 *   useTls: boolean | undefined,
 * }>}
 */
export async function promptAdvancedPortMapping(opts = {}) {
  const bindings = opts.skipLiveKit
    ? PORT_BINDINGS.filter((b) => !b.envKey.startsWith('LIVEKIT_'))
    : PORT_BINDINGS;

  const chosen = new Set();
  /** @type {Record<string, number>} */
  const ports = {};

  console.log('');
  console.log(bold('Per-port remap'));
  console.log('');

  for (const binding of bindings) {
    console.log(`  ${cyan(binding.label)}`);
    console.log(dim(`    ${binding.description}`));
    const defaultFree = await isPortAvailable(binding.default);
    let suggested = binding.default;

    if (!defaultFree) {
      const hint = knownConflictHint(binding.default);
      const hintText = hint ? ` (${hint})` : '';
      console.log(`    ${red('×')} ${binding.default} is in use${hintText}.`);
      const free = await suggestFreePort({
        preferredBase: binding.alternateBase,
        exclude: chosen,
      });
      suggested = free ?? binding.alternateBase;
      console.log(`    ${dim('Suggested replacement:')} ${cyan(String(suggested))}`);
    } else {
      console.log(`    ${green('✓')} ${binding.default} is free — accept the default unless you want to remap.`);
    }

    let port = null;
    while (port === null) {
      const raw = await ask(
        `    Host port for ${binding.label}:`,
        String(suggested),
      );
      const parsed = parsePort(raw);
      if (parsed === null) {
        console.log(`    ${red('Not a valid port. Enter a number between 1 and 65535.')}`);
        continue;
      }
      if (chosen.has(parsed)) {
        console.log(`    ${red(`Port ${parsed} is already assigned to another binding above.`)}`);
        continue;
      }
      // If the operator typed a port we know is taken, give them a chance
      // to back out — but don't insist, since they may know better than us
      // (e.g. they're going to free that port before running the deploy).
      if (parsed !== binding.default) {
        const stillFree = await isPortAvailable(parsed);
        if (!stillFree) {
          const hint = knownConflictHint(parsed);
          const hintText = hint ? ` (${hint})` : '';
          console.log(`    ${yellow(`Heads up: ${parsed} also looks busy${hintText}.`)}`);
          if (!(await confirm('    Use it anyway?', false))) continue;
        }
      } else if (!defaultFree) {
        // Operator chose to keep the default port even though we said it
        // was busy. Same warn-and-ask pattern.
        if (!(await confirm('    Are you sure? The default is currently in use.', false))) continue;
      }
      port = parsed;
    }

    chosen.add(port);
    ports[binding.envKey] = port;
    console.log('');
  }

  // Scheme override — defaults to https for any non-localhost domain, but
  // a NAS deploy at nas.local without a cert is plain http. Only ask if
  // the operator picked a non-standard HTTP_PORT (i.e. they're already in
  // "I know what I'm doing" territory).
  let useTls;
  if (ports.HTTP_PORT !== 80 || ports.HTTPS_PORT !== 443) {
    console.log(bold('  TLS / scheme'));
    console.log(dim('    The deploy script picks https:// for any non-localhost domain by'));
    console.log(dim('    default. If you are running on a LAN address (e.g. nas.local) without'));
    console.log(dim('    a certificate, you want plain http instead. Otherwise leave this on.'));
    const wantsTls = await confirm('    Use https:// in user-facing URLs?', false);
    useTls = wantsTls;
    console.log('');
  }

  return { ports, useTls };
}

/**
 * Top-level entry point. Asks "do you need this?", and if yes, walks the
 * operator through the per-port flow. Returns null to mean "use defaults"
 * so callers can keep the laptop fast path simple.
 *
 * @param {{ skipLiveKit?: boolean }} [opts]
 * @returns {Promise<{ ports: Record<string, number>, useTls: boolean | undefined } | null>}
 */
export async function maybeAdvancedPortMapping(opts = {}) {
  const wants = await promptShouldRemap(opts);
  if (!wants) return null;
  return promptAdvancedPortMapping(opts);
}
