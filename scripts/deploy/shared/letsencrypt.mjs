// Let's Encrypt provisioning + renewal wiring for the docker-compose
// adapter. Separate module from tls.mjs because:
//   - LE issuance has to happen AFTER nginx is up (certbot needs to reach
//     the ACME challenge webroot served by nginx), whereas self-signed /
//     mkcert / BYO all happen before `docker compose up`.
//   - LE has its own state machine (rate-limit awareness, renewal hooks,
//     symlink dance from /etc/letsencrypt/live/<domain>/ to ./certs/local.*).
//
// The renewal model is intentionally NOT a long-running container loop:
//   - certbot's `renew` command is meant to run on a schedule (1-2x daily),
//     not as a daemon.
//   - Reloading nginx after a renewal needs to be initiated from the host
//     because the certbot sidecar shouldn't have docker socket access (a
//     widely-flagged supply-chain risk vector).
// So we write a host-side cron entry that runs `docker compose run --rm
// certbot certbot renew --quiet --deploy-hook "..."` daily, and the deploy
// hook invokes `docker compose exec frontend nginx -s reload` from the host.

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { dim, check, red, yellow } from './colors.mjs';

/**
 * Refuse LE when HTTP_PORT is anything other than 80. LE's HTTP-01
 * challenge always hits public port 80 on the registered hostname; if the
 * operator remapped HTTP_PORT (common on NAS hosts that already serve
 * something on 80), the validator can't reach the challenge token and
 * issuance silently fails — eating the operator's rate-limit budget
 * (5 failed validations / hour / hostname).
 *
 * @param {number} httpPort
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkLeCompatibility(httpPort) {
  if (httpPort === 80) return { ok: true };
  return {
    ok: false,
    reason:
      `HTTP_PORT is ${httpPort}, but Let's Encrypt's HTTP-01 challenge ` +
      `always hits public port 80. Set up router-side port forwarding ` +
      `(public:80 → host:${httpPort}) and re-run, or pick a different cert source.`,
  };
}

/**
 * Build a host-side cron entry that runs certbot renewal daily at 03:17
 * (offset chosen to avoid the top-of-hour herd). Takes the project's
 * absolute path so the cron entry can `cd` to the right place. The
 * `--deploy-hook` reloads nginx after a successful renewal.
 *
 * @param {object} args
 * @param {string} args.projectDir - Absolute path to the BigBlueBam repo root.
 * @param {string} args.composeBin - Either "docker compose" or "docker-compose".
 * @returns {string} The full crontab line (no trailing newline).
 */
export function buildRenewalCronEntry({ projectDir, composeBin = 'docker compose' }) {
  // Both legs run from the project directory so compose finds
  // docker-compose.yml. Using `run --rm` for renewal avoids leaving a
  // dangling certbot container behind. The deploy-hook fires inside
  // certbot, but it shells out via `docker compose exec` against the
  // frontend service running on the host's docker daemon.
  const renewCmd =
    `cd "${projectDir}" && ${composeBin} --profile letsencrypt run --rm certbot ` +
    `certbot renew --quiet --deploy-hook ` +
    `"${composeBin} exec -T frontend nginx -s reload"`;
  return `17 3 * * * ${renewCmd}`;
}

/**
 * Build the platform-appropriate renewal task. Returns:
 *   - { kind: 'cron', entry, instructions } on Linux/macOS — a crontab line
 *     plus instructions for installing it via `crontab -e`.
 *   - { kind: 'task-scheduler', xml, instructions } on Windows — placeholder
 *     for a Task Scheduler XML, with instructions to register via schtasks.
 *
 * On Windows we output instructions only (no auto-install) because Task
 * Scheduler registration requires Administrator and we don't want the
 * deploy script silently asking for elevation.
 */
export function buildRenewalTask({ projectDir, composeBin = 'docker compose' }) {
  if (process.platform === 'win32') {
    const cmd =
      `cd /d "${projectDir}" && ${composeBin} --profile letsencrypt run --rm certbot ` +
      `certbot renew --quiet --deploy-hook ` +
      `"${composeBin} exec -T frontend nginx -s reload"`;
    return {
      kind: 'task-scheduler',
      command: cmd,
      instructions: [
        'Register a daily Task Scheduler task to renew the cert. From an Administrator PowerShell:',
        '',
        `  schtasks /Create /SC DAILY /ST 03:17 /TN "BigBlueBam Cert Renewal" /TR ${JSON.stringify(cmd)}`,
        '',
        'Or use Task Scheduler GUI: trigger=daily 3:17 AM, action=run the command above.',
      ],
    };
  }
  const entry = buildRenewalCronEntry({ projectDir, composeBin });
  return {
    kind: 'cron',
    entry,
    instructions: [
      'Add this line to your crontab (run `crontab -e` to edit):',
      '',
      `  ${entry}`,
      '',
      'It runs daily at 03:17 and reloads nginx after a successful renewal.',
    ],
  };
}

/**
 * Run the initial issuance via certbot's webroot challenge. This is called
 * AFTER `docker compose up` has brought the frontend up, since certbot
 * needs to reach nginx at /.well-known/acme-challenge/.
 *
 * @param {object} args
 * @param {string} args.domain
 * @param {string} args.email
 * @param {string} args.composeBin
 * @returns {{ ok: true, certPath: string, keyPath: string } | { ok: false, reason: string }}
 */
export function runInitialIssuance({ domain, email, composeBin = 'docker compose' }) {
  // --webroot lets certbot drop tokens into the shared volume that nginx
  // already serves. --agree-tos and --email are required for non-interactive
  // issuance. --non-interactive ensures certbot fails fast on any prompt
  // rather than blocking the deploy script.
  const cmd =
    `${composeBin} --profile letsencrypt run --rm certbot ` +
    `certbot certonly --webroot --webroot-path=/var/www/certbot ` +
    `--non-interactive --agree-tos --email "${email}" ` +
    `-d "${domain}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    return { ok: false, reason: `certbot issuance failed: ${err.message ?? err}` };
  }

  // Symlink /etc/letsencrypt/live/<domain>/{fullchain.pem,privkey.pem}
  // into ./certs/local.{crt,key} so nginx (which only knows about
  // /etc/nginx/certs/local.{crt,key}) picks them up uniformly across all
  // four cert sources.
  const certsDir = path.resolve(process.cwd(), 'certs');
  const liveDir = path.join(certsDir, 'letsencrypt', 'live', domain);
  const certPath = path.join(certsDir, 'local.crt');
  const keyPath = path.join(certsDir, 'local.key');

  for (const link of [certPath, keyPath]) {
    try { fs.unlinkSync(link); } catch { /* may not exist */ }
  }

  // Use relative-path symlinks so the bind-mount inside the container
  // resolves correctly (nginx sees /etc/nginx/certs/local.crt → ../../etc/...
  // would not resolve from inside the container, so we keep targets relative
  // to certsDir and let docker mount the full ./certs/ tree).
  fs.symlinkSync(
    path.join('letsencrypt', 'live', domain, 'fullchain.pem'),
    certPath,
  );
  fs.symlinkSync(
    path.join('letsencrypt', 'live', domain, 'privkey.pem'),
    keyPath,
  );

  return { ok: true, certPath, keyPath };
}
