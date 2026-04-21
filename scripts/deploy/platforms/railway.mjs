// Railway platform adapter — managed container deployment.
//
// This adapter sets up the Railway project and drives Railway's public
// GraphQL API to create and configure every BigBlueBam service end to end:
// source repo, Dockerfile, healthcheck, env vars, and initial deploy. The
// only manual step is adding the managed Postgres and Redis plugins from the
// Railway dashboard, because Railway's public API doesn't expose plugin
// creation.
//
// Zero dependencies (node:child_process, node:fs only).

import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bold, check, cross, dim, green, yellow, cyan, red, warn } from '../shared/colors.mjs';
import { ask, confirm, select } from '../shared/prompt.mjs';
import { RailwayClient, RailwayApiError } from '../shared/railway-api.mjs';
import { RailwayOrchestrator } from '../shared/railway-orchestrator.mjs';
import { pullRailwayLogs, printLogPullerSummary } from '../shared/railway-logs.mjs';

const name = 'Railway';
const description = 'Managed cloud containers on Railway.app — fully automated';

// Module-level state so checkPrerequisites() can hand a validated client
// off to deploy() without re-prompting the user for the PAT.
let cachedClient = null;
let cachedToken = null;

const ENV_FILE = path.resolve(process.cwd(), '.env');

/**
 * Run a shell command, optionally capturing stdout.
 */
function runShell(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      shell: true,
      stdio: opts.silent ? 'pipe' : 'inherit',
      cwd: opts.cwd || process.cwd(),
    });
    let stdout = '';
    let stderr = '';
    if (opts.silent) {
      if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
      if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString(); });
    }
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Command failed (exit ${code}): ${cmd}\n${stderr}`));
    });
    child.on('error', reject);
  });
}

/**
 * Read RAILWAY_TOKEN from the .env file at repo root. Returns null if the
 * file doesn't exist or the key isn't set. We deliberately avoid pulling in
 * a dotenv dependency — a simple line-based regex is enough.
 */
function readTokenFromEnvFile() {
  try {
    if (!fs.existsSync(ENV_FILE)) return null;
    const text = fs.readFileSync(ENV_FILE, 'utf8');
    const m = text.match(/^RAILWAY_TOKEN=(.*)$/m);
    if (!m) return null;
    // Strip surrounding quotes if present.
    return m[1].trim().replace(/^['"]|['"]$/g, '') || null;
  } catch {
    return null;
  }
}

/**
 * Persist RAILWAY_TOKEN in the .env file so future runs pick it up
 * automatically. Replaces an existing RAILWAY_TOKEN= line if present,
 * otherwise appends. Creates .env if it doesn't exist.
 */
function writeTokenToEnvFile(token) {
  try {
    const line = `RAILWAY_TOKEN=${token}`;
    let text = '';
    if (fs.existsSync(ENV_FILE)) {
      text = fs.readFileSync(ENV_FILE, 'utf8');
      if (/^RAILWAY_TOKEN=.*$/m.test(text)) {
        text = text.replace(/^RAILWAY_TOKEN=.*$/m, line);
      } else {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
        text += line + '\n';
      }
    } else {
      text = line + '\n';
    }
    fs.writeFileSync(ENV_FILE, text, 'utf8');
    return true;
  } catch (err) {
    console.log(`  ${warn} Could not write RAILWAY_TOKEN to .env: ${err.message}`);
    return false;
  }
}

/**
 * Detect the "wrong token type" failure mode: Project Tokens and Workspace/
 * Team Tokens authenticate successfully at the HTTP layer (so we don't get a
 * 401/403 + kind='auth') but Railway's GraphQL resolver returns a
 * `Not Authorized` error on the `me { email name }` query because those
 * tokens aren't tied to a user account. PATs generated at the account-level
 * tokens page are the only token type that can call `me`.
 *
 * Returns true if the error looks like a non-PAT token type.
 */
function looksLikeNonPatTokenError(err) {
  if (!(err instanceof RailwayApiError)) return false;
  if (err.kind !== 'graphql') return false;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('not authorized') || msg.includes('not authorised');
}

/**
 * Build the targeted error message shown when a non-PAT token is detected.
 * Keeps the original error as .cause so debugging tools can surface it.
 */
function nonPatTokenError(originalErr) {
  const e = new Error(
    'Railway accepted the token but rejected the `me` query — this looks like a Project Token or Workspace/Team Token, not a Personal Access Token.\n' +
    '\n' +
    '    Go to https://railway.com/account/tokens (the ACCOUNT-level tokens page,\n' +
    '    not a project\'s Settings → Tokens page) and generate a Personal Access\n' +
    '    Token there. Only account-level PATs have the scope to create projects\n' +
    '    and services.',
  );
  e.cause = originalErr;
  return e;
}

/**
 * Prompt the user to paste a PAT, validate it, and return a RailwayClient.
 * On success, persists the token to .env and caches the client at module
 * scope. Throws on repeated failure.
 */
async function promptForToken() {
  console.log('');
  console.log('  Generate a Personal Access Token:');
  console.log(cyan('    https://railway.com/account/tokens'));
  console.log(dim('    (Must be an account-level PAT — Project Tokens and Workspace'));
  console.log(dim('     Tokens authenticate but lack the scope to create projects.)'));
  console.log('');
  const token = await ask('Paste your Railway PAT:');
  if (!token) throw new Error('Railway PAT is required.');
  const client = new RailwayClient(token);
  try {
    const me = await client.whoami();
    console.log(`  ${check} Authenticated as ${me.email ?? me.name ?? 'unknown user'}`);
    writeTokenToEnvFile(token);
    cachedClient = client;
    cachedToken = token;
    return client;
  } catch (err) {
    if (err instanceof RailwayApiError && err.kind === 'auth') {
      throw new Error('Railway rejected the token. Generate a new one at https://railway.com/account/tokens and try again.');
    }
    if (looksLikeNonPatTokenError(err)) {
      throw nonPatTokenError(err);
    }
    throw new Error(`Railway token validation failed: ${err.message}`);
  }
}

/**
 * Validate a Railway Personal Access Token and (optionally) check for the
 * Railway CLI. The CLI isn't required for the deploy path — it's only used
 * later by runCommand() for the admin-user bootstrap step.
 */
async function checkPrerequisites() {
  console.log(bold('Checking Railway setup...\n'));

  // 1. Look for a PAT: env var first, then .env file.
  let token = process.env.RAILWAY_TOKEN || readTokenFromEnvFile();

  if (token) {
    const client = new RailwayClient(token);
    try {
      const me = await client.whoami();
      console.log(`  ${check} Authenticated as ${me.email ?? me.name ?? 'unknown user'}`);
      cachedClient = client;
      cachedToken = token;
    } catch (err) {
      if (err instanceof RailwayApiError && err.kind === 'auth') {
        console.log(`  ${cross} Token rejected — generate a new one`);
        await promptForToken();
      } else if (looksLikeNonPatTokenError(err)) {
        // The env/.env-loaded token is the wrong type (Project Token or
        // Workspace Token). Don't silently re-prompt — tell the operator
        // exactly what's wrong so they don't waste another round.
        console.log(`  ${cross} Token is not a Personal Access Token (likely a Project Token or Workspace Token)`);
        console.log(`  ${dim('    PATs are the only token type that can call the `me` query + create projects.')}`);
        console.log('');
        await promptForToken();
      } else {
        // Network/unknown — don't burn the token, but still let the user retry.
        console.log(`  ${warn} Could not verify token: ${err.message}`);
        await promptForToken();
      }
    }
  } else {
    console.log(`  ${warn} No RAILWAY_TOKEN found in environment or .env`);
    await promptForToken();
  }

  // 2. Best-effort CLI detection — only needed later for createSuperUser.
  // Railway's CLI uses `railway --version` (flag), not `railway version`
  // (subcommand) — the latter exits non-zero with "unknown command".
  try {
    execSync('railway --version', { stdio: 'pipe' });
  } catch {
    console.log(`  ${warn} Railway CLI not detected — admin auto-creation will print manual instructions instead`);
  }

  console.log('');
  return true;
}

/**
 * Print the welcome banner explaining what the Railway adapter will do.
 */
function printWelcomeBanner() {
  console.log('');
  console.log(cyan(bold('  ▲ Railway deployment')));
  console.log(dim('  ─────────────────────────────────────────────────────────────'));
  console.log(dim('  This will create a Railway project and provision all 19'));
  console.log(dim("  BigBlueBam services via Railway's public GraphQL API:"));
  console.log('');
  console.log(dim('    1. Validate your Railway PAT'));
  console.log(dim('    2. Create the project'));
  console.log(dim('    3. Pause so you can add PostgreSQL + Redis in the Railway dashboard'));
  console.log(dim('    4. Create + configure every service (source, Dockerfile,'));
  console.log(dim('       healthcheck, env vars)'));
  console.log(dim('    5. Trigger initial deploys'));
  console.log('');
  console.log(dim('  Reference: railway/env-vars.md'));
  console.log(dim('  ─────────────────────────────────────────────────────────────'));
  console.log('');
  console.log(`  ${bold('★ Support BigBlueBam:')} sign up with our Railway referral link:`);
  console.log(`     ${cyan('https://railway.com?referralCode=xCAYHN')}`);
  console.log(dim('     (Costs you nothing extra — just gives BigBlueBam a small credit.)'));
  console.log('');
}

/**
 * Extract the generated-secrets bundle the orchestrator expects from the
 * envConfig produced by buildEnvConfig(). Missing keys fall through as empty
 * strings so the orchestrator's `secret` branch can SKIP cleanly.
 *
 * Defense-in-depth: SESSION_SECRET and INTERNAL_HELPDESK_SECRET must be
 * ≥ 32 chars or every Bam app crash-loops on Zod env validation. If
 * something upstream (e.g. a stale `.deploy-state.json` carrying the
 * literal '[REDACTED]' marker) snuck a too-short value through, throw a
 * loud preflight error rather than letting the deploy "succeed" and
 * stranding 17 services in a healthcheck-timeout loop on Railway.
 */
function extractSecretsFromEnvConfig(envConfig = {}) {
  const sessionSecret = envConfig.SESSION_SECRET ?? '';
  const helpdeskSecret = envConfig.INTERNAL_HELPDESK_SECRET ?? '';
  const serviceSecret = envConfig.INTERNAL_SERVICE_SECRET ?? '';
  const tooShort = [];
  if (sessionSecret.length < 32) tooShort.push(`SESSION_SECRET (${sessionSecret.length} chars)`);
  if (helpdeskSecret.length < 32) tooShort.push(`INTERNAL_HELPDESK_SECRET (${helpdeskSecret.length} chars)`);
  if (serviceSecret.length < 32) tooShort.push(`INTERNAL_SERVICE_SECRET (${serviceSecret.length} chars)`);
  if (tooShort.length > 0) {
    throw new Error(
      `Required secret(s) too short for Bam env validation: ${tooShort.join(', ')}. ` +
        `All must be ≥ 32 characters. This usually means '.deploy-state.json' was ` +
        `loaded with redacted placeholder values; delete it and re-run, or pass --reconfigure.`,
    );
  }
  return {
    SESSION_SECRET: sessionSecret,
    INTERNAL_HELPDESK_SECRET: helpdeskSecret,
    INTERNAL_SERVICE_SECRET: serviceSecret,
    MINIO_ROOT_USER: envConfig.MINIO_ROOT_USER ?? '',
    MINIO_ROOT_PASSWORD: envConfig.MINIO_ROOT_PASSWORD ?? '',
    LIVEKIT_API_KEY: envConfig.LIVEKIT_API_KEY ?? '',
    LIVEKIT_API_SECRET: envConfig.LIVEKIT_API_SECRET ?? '',
  };
}

/**
 * Extract the user-integrations bundle the orchestrator expects from the
 * envConfig. Empty strings are fine — the orchestrator silently skips
 * optional user integrations that aren't set.
 */
function extractUserIntegrationsFromEnvConfig(envConfig = {}) {
  const keys = [
    'OAUTH_GITHUB_CLIENT_ID',
    'OAUTH_GITHUB_CLIENT_SECRET',
    'OAUTH_GOOGLE_CLIENT_ID',
    'OAUTH_GOOGLE_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'SMTP_FROM_EMAIL',
    'SMTP_FROM_NAME',
    'EMAIL_FROM',
  ];
  const out = {};
  for (const k of keys) {
    out[k] = envConfig[k] ?? '';
  }
  return out;
}

/**
 * Detect the "owner/repo" slug from the local git remote named `origin`.
 * Supports both HTTPS (https://github.com/owner/repo.git) and SSH
 * (git@github.com:owner/repo.git) URLs. Returns null if detection fails.
 */
function detectGithubRepo() {
  try {
    const url = execSync('git remote get-url origin', { stdio: 'pipe', encoding: 'utf8' }).trim();
    let m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
    if (m) return m[1];
  } catch {
    // fall through
  }
  return null;
}

// ─── Debug bundle (written on every run) ────────────────────────────────────
//
// The deploy script writes a machine-readable dump of the current Railway
// project state to `.deploy-state-railway.json` at the end of every run —
// success or failure. On failure we also print a short human-readable
// summary pointing the operator at the file and telling them exactly what
// to paste into Claude (or forward to a support channel) to get help
// debugging.
//
// The bundle is intentionally verbose — it includes project + environment
// IDs, service IDs, dashboard URLs, the last failing progress event, and
// copy-paste commands for fetching logs via the Railway CLI. Tokens and
// secrets are NEVER written to the bundle; all identifiers are safe to
// share in bug reports.
//
// Why a JSON file: Claude and other agents can read it directly with
// Read / Bash tools without needing the operator to paste the whole
// thing in chat. Humans can open it in any editor.

const DEBUG_BUNDLE_FILE = '.deploy-state-railway.json';

/**
 * Build + serialize the debug bundle and write it to disk. Returns the
 * in-memory bundle so the caller can also print a summary. Never throws —
 * a write failure is logged as a warning and the bundle is still returned.
 */
function writeRailwayDebugBundle({
  success,
  orchestrator,
  summary,
  githubRepo,
  branch,
  publicUrl,
  lastFailedEvent,
  lastStartingEvent,
  error,
}) {
  const projectId = orchestrator?.projectId ?? summary?.projectId ?? null;
  const environmentId =
    orchestrator?.defaultEnvironmentId ?? summary?.environmentId ?? null;

  // orchestrator.serviceIds is a Map<name, id>. Flatten to a sorted
  // array-of-objects for the bundle so JSON.stringify preserves order.
  const services = [];
  if (orchestrator?.serviceIds instanceof Map) {
    for (const [name, id] of orchestrator.serviceIds.entries()) {
      services.push({
        name,
        id,
        dashboard_url: projectId
          ? `https://railway.com/project/${projectId}/service/${id}`
          : null,
      });
    }
    services.sort((a, b) => a.name.localeCompare(b.name));
  }

  const bundle = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    success: Boolean(success),
    project: {
      id: projectId,
      name: orchestrator?.projectName ?? null,
      dashboard_url: projectId ? `https://railway.com/project/${projectId}` : null,
    },
    environment: {
      id: environmentId,
      name: orchestrator?.defaultEnvironmentName ?? null,
    },
    source: {
      github_repo: githubRepo ?? null,
      branch: branch ?? null,
      public_url: publicUrl ?? null,
    },
    services,
    last_failed_event: lastFailedEvent,
    last_starting_event: lastStartingEvent,
    error: error
      ? {
          message: error.message ?? String(error),
          kind: error.kind ?? null,
          graphql_errors: Array.isArray(error.errors)
            ? error.errors.map((e) => e?.message ?? String(e))
            : null,
        }
      : null,
    summary: summary
      ? {
          services_created: summary.servicesCreated,
          services_configured: summary.servicesConfigured,
          services_deployed: summary.servicesDeployed,
        }
      : null,
    // Copy-paste commands for fetching logs. These assume the operator
    // has the Railway CLI installed and logged in (`railway login` +
    // `railway link`). Agents reading this bundle can suggest running
    // them verbatim.
    log_commands: (() => {
      const cmds = [];
      if (lastFailedEvent?.service) {
        cmds.push({
          description: `Build logs for the failing service "${lastFailedEvent.service}"`,
          command: `railway logs --service ${lastFailedEvent.service} --deployment build`,
        });
        cmds.push({
          description: `Runtime (deploy) logs for "${lastFailedEvent.service}"`,
          command: `railway logs --service ${lastFailedEvent.service} --deployment deploy`,
        });
      }
      // Always include a generic all-services logs command.
      cmds.push({
        description: 'Tail all services in the project',
        command: 'railway logs',
      });
      if (projectId) {
        cmds.push({
          description: 'Open the failing service in the Railway dashboard',
          command: `start ${
            lastFailedEvent?.service && services.find((s) => s.name === lastFailedEvent.service)
              ? services.find((s) => s.name === lastFailedEvent.service).dashboard_url
              : `https://railway.com/project/${projectId}`
          }`,
        });
      }
      return cmds;
    })(),
  };

  try {
    const filePath = path.resolve(process.cwd(), DEBUG_BUNDLE_FILE);
    fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
    bundle._written_to = filePath;
  } catch (writeErr) {
    console.log(
      `  ${warn} Could not write ${DEBUG_BUNDLE_FILE}: ${writeErr?.message ?? writeErr}`,
    );
    bundle._written_to = null;
  }

  return bundle;
}

/**
 * Print a human-readable summary of a failure debug bundle, including
 * the exact instructions a user should give to Claude (or any log-
 * capable agent). When logs have already been pulled to a local
 * directory (the common case — we auto-pull on failure), the printed
 * instructions point Claude directly at that directory so it can read
 * the actual build/deploy logs without any further steps.
 */
function printRailwayDebugBundleSummary(bundle, logSummary = null) {
  if (!bundle) return;
  const file = bundle._written_to ?? DEBUG_BUNDLE_FILE;
  const projectId = bundle.project?.id ?? 'unknown';
  const envName = bundle.environment?.name ?? 'unknown';
  const failedService = bundle.last_failed_event?.service ?? null;
  const failedStep = bundle.last_failed_event?.step ?? null;
  const failedTotal = bundle.last_failed_event?.total ?? null;
  const failedMessage =
    bundle.last_failed_event?.message ?? bundle.error?.message ?? 'unknown';
  const logsDir = logSummary?.output_dir ?? null;

  console.log(bold('  ═══ Debug bundle ══════════════════════════════════════════'));
  console.log(`  Identifiers:  ${cyan(file)}`);
  if (logsDir) {
    console.log(`  Logs:         ${cyan(logsDir + path.sep)}`);
  }
  console.log('');
  console.log(`  Project:      ${bundle.project?.name ?? '(none)'} ${dim(`(${projectId})`)}`);
  console.log(`  Environment:  ${envName}`);
  console.log(`  Branch:       ${bundle.source?.branch ?? '(unknown)'}`);
  if (failedStep != null) {
    console.log(
      `  Failed at:    step ${failedStep}/${failedTotal ?? '?'} — ${failedService ?? ''} ${dim(failedMessage)}`,
    );
  } else {
    console.log(`  Failed:       ${dim(failedMessage)}`);
  }
  if (Array.isArray(bundle.services) && bundle.services.length > 0) {
    console.log(`  Services:     ${bundle.services.length} created so far`);
  }
  console.log('');
  console.log(bold('  ─── To debug with Claude (or any coding agent) ─────────────'));
  console.log('  Paste one of these lines to Claude in your working-directory chat:');
  console.log('');
  if (logsDir) {
    // Logs were successfully pulled to a local directory. This is the
    // happy path — Claude can just read the files directly.
    console.log(
      `    ${cyan(`"Read ${DEBUG_BUNDLE_FILE} and ${path.basename(logsDir)}/_summary.json,`)}`,
    );
    console.log(`     ${cyan(`then help me debug the Railway deploy."`)}`);
    console.log('');
    console.log(dim('  Claude will read the summary to find failing services, then'));
    console.log(dim('  grep / read the individual build.log and deploy.log files'));
    console.log(dim(`  under ${path.basename(logsDir)}/<service>/ as needed. No extra back-and-forth.`));
  } else {
    // Log pull failed (or couldn't run) — Claude only has the debug
    // bundle to work from. Still useful, but less.
    console.log(
      `    ${cyan(`"Read ${DEBUG_BUNDLE_FILE} and help me debug the Railway deploy."`)}`,
    );
    console.log('');
    console.log(dim('  Automatic log pull failed — Claude will only see Railway identifiers'));
    console.log(dim('  and the last failing orchestrator step, not the actual build/deploy output.'));
    console.log(dim('  Run `node scripts/deploy/railway-pull-logs.mjs` to retry the log pull'));
    console.log(dim('  once the underlying issue (network, API schema drift, etc.) is resolved.'));
  }
  console.log('');
  console.log(dim('  The debug bundle and logs contain NO secrets — safe to forward'));
  console.log(dim('  to support or paste in a bug report.'));
  console.log('');
  console.log(bold('  ─── To debug in the Railway dashboard ─────────────────────'));
  if (failedService && projectId) {
    const svc = bundle.services.find((s) => s.name === failedService);
    if (svc?.dashboard_url) {
      console.log(`    1. Open ${cyan(svc.dashboard_url)}`);
    } else {
      console.log(
        `    1. Open ${cyan('https://railway.com/project/' + projectId)} and click "${failedService}"`,
      );
    }
    console.log('    2. Deployments tab → click the latest → Build logs / Deploy logs');
  } else if (projectId) {
    console.log(`    1. Open ${cyan('https://railway.com/project/' + projectId)}`);
    console.log('    2. Click the failing service → Deployments → latest → logs');
  }
  console.log(bold('  ════════════════════════════════════════════════════════════'));
  console.log('');
}

/**
 * Provision the full BigBlueBam stack on Railway: validate the PAT, create
 * (or reuse) the project, prompt once for the managed Postgres + Redis
 * plugins, then create and configure every service via Railway's public
 * GraphQL API and trigger the initial deploys.
 *
 * @param {object} envConfig - Resolved env config from main.mjs
 * @param {object} [options]
 * @param {string} [options.branch='stable'] - Git branch Railway should
 *   track for every service created by the orchestrator. Operator is
 *   prompted in main.mjs and the choice is saved in `.deploy-state.json`
 *   so subsequent runs offer to reuse it. Defaults to `stable` — the
 *   validated production branch. Choose `main` for bleeding-edge deploys.
 */
async function deploy(envConfig, { branch = 'stable' } = {}) {
  printWelcomeBanner();

  // 1. Get a validated RailwayClient — reuse the one checkPrerequisites
  //    cached, or re-run the PAT flow if we're being called directly.
  let client = cachedClient;
  if (!client) {
    await checkPrerequisites();
    client = cachedClient;
  }
  if (!client) {
    throw new Error('No validated Railway client available. Re-run and paste a PAT when prompted.');
  }

  // 2. Defensive schema compatibility check — Railway has renamed mutations
  //    before, and we'd rather fail here than halfway through provisioning.
  const compat = await client.assertSchemaCompatibility();
  if (!compat.ok) {
    console.log(red('  ✗ Railway schema check failed'));
    console.log('    Missing mutations: ' + compat.missing.join(', '));
    console.log('    See: https://docs.railway.com/reference/public-api');
    throw new Error('Railway API schema is incompatible with this client.');
  }
  console.log(`  ${check} Schema check passed`);

  // 3. Whoami confirmation. checkPrerequisites already called this, but
  //    re-running it is cheap and the deploy path may be called on its own.
  const me = await client.whoami();
  console.log(`  ${check} Logged in as ${me.email ?? me.name ?? 'unknown user'}`);

  // 4. Project name, GitHub repo, branch.
  console.log('');
  const projectName = await ask('Railway project name:', 'bigbluebam');

  let githubRepo = detectGithubRepo();
  if (!githubRepo) {
    githubRepo = await ask('GitHub repo (user/repo):', 'eoffermann/BigBlueBam');
  }
  console.log(`  ${check} GitHub repo: ${githubRepo}`);

  console.log(`  ${check} Branch: ${branch}`);
  console.log('');

  // 4b. Workspace resolution. Railway's ProjectCreateInput now requires a
  //     workspaceId — passing null returns "You must specify a workspaceId
  //     to create a project." Every Railway user has at least one workspace
  //     (the personal workspace, auto-created on signup); accounts on paid
  //     plans may have additional team workspaces.
  //
  //     Auto-pick when there's exactly one. Prompt when there are multiple.
  //     Throw a clear error when there are zero (shouldn't happen in
  //     practice, but the error message is useful if Railway's API shape
  //     changes again and the query starts returning empty).
  //
  //     The chosen workspaceId is NOT persisted to state because it's tied
  //     to the current PAT — if the operator switches tokens between runs,
  //     the old workspaceId would be wrong. Re-resolving on every run is
  //     cheap (one GraphQL query) and correct.
  let workspaceId;
  try {
    const workspaces = await client.listWorkspaces();
    if (workspaces.length === 0) {
      throw new Error(
        'Railway returned zero workspaces for this account. Every account should have at least a personal workspace — if you\'re seeing this, Railway\'s API may have changed shape. Try re-running with DEBUG=1 for the raw response.',
      );
    }
    if (workspaces.length === 1) {
      workspaceId = workspaces[0].id;
      console.log(`  ${check} Workspace: ${workspaces[0].name} ${dim(`(${workspaceId})`)}`);
    } else {
      console.log(dim(`  Found ${workspaces.length} workspaces on this account.`));
      const pick = await select(
        'Which workspace should this project be created in?',
        workspaces.map((w) => ({
          label: w.name,
          value: w.id,
          description: w.team ? `Team workspace (${w.id})` : `Personal workspace (${w.id})`,
        })),
      );
      workspaceId = pick;
      const chosen = workspaces.find((w) => w.id === pick);
      console.log(`  ${check} Workspace: ${chosen?.name ?? workspaceId}`);
    }
  } catch (err) {
    if (err instanceof RailwayApiError) {
      throw new Error(`Could not fetch Railway workspaces: ${err.message}`);
    }
    throw err;
  }
  console.log('');

  // 5. Build the orchestrator. The plugin-prompt callback needs the
  //    projectId so it can print a working dashboard link — capture it from
  //    the onProgress 'project' phase events as the orchestrator emits them.
  let capturedProjectId = null;
  // Track the most recent progress event that reported ok=false. On a
  // thrown error we include this in the debug bundle so Claude (or a
  // human) can tell at-a-glance which step was mid-execution when the
  // failure occurred, instead of having to reconstruct it from the
  // scrolling log output.
  let lastFailedEvent = null;
  // Track the most recent "starting" event (ok === undefined) so we
  // know exactly what the orchestrator was ATTEMPTING when the error
  // was thrown — useful when the throw happens inside a step before
  // an ok=false event is emitted.
  let lastStartingEvent = null;

  const awaitPluginConfirmation = async () => {
    console.log('');
    console.log(bold('  One manual step: add a PostgreSQL database and a Redis database'));
    console.log(bold('  to this project from the Railway dashboard.'));
    console.log('');
    console.log(dim('  Why: Railway\'s public API doesn\'t let us provision databases'));
    console.log(dim('  automatically, so you have to click through the dashboard once.'));
    console.log(dim('  (We tried. If you know a way, PRs welcome.)'));
    console.log('');
    const projectUrl = capturedProjectId
      ? `https://railway.com/project/${capturedProjectId}`
      : 'https://railway.com/dashboard';
    console.log(`  ${bold('1.')} Open this project in your browser:`);
    console.log(`     ${cyan(projectUrl)}`);
    console.log('');
    console.log(`  ${bold('2.')} Add a ${bold('PostgreSQL')} database. Railway has a couple of UI paths,`);
    console.log('     depending on when you signed up — any one of these works:');
    console.log(dim('       • Right-click on the project canvas → "Database" → "Add PostgreSQL"'));
    console.log(dim('       • Or click the "+ Create" / "+ New" button (usually top-right),'));
    console.log(dim('         then "Database" → "Add PostgreSQL"'));
    console.log(dim('       • Or click the blank canvas area, then "Database" from the menu'));
    console.log('');
    console.log(`  ${bold('3.')} Repeat for ${bold('Redis')}. Same menu, choose "Add Redis" instead.`);
    console.log('');
    console.log(dim('  After both tiles show up in the project canvas (they\'ll self-provision'));
    console.log(dim('  within ~30 seconds), come back here and answer Y below.'));
    console.log('');
    await confirm("PostgreSQL and Redis are both added and provisioned — continue?", true);
  };

  const handleProgress = (event) => {
    if (!event) return;
    const { phase, service, step, total, message, ok, error, identity, summary } = event;

    // Capture projectId from the orchestrator state as soon as the project
    // phase finishes. The orchestrator sets `this.projectId` during the
    // project phase, so by the time we see any post-project event we can
    // also read it off the orchestrator directly — but we keep this cheap
    // sniff in the progress callback too.
    if (summary?.projectId && !capturedProjectId) {
      capturedProjectId = summary.projectId;
    }

    const counter = dim(`[${step ?? '?'}/${total ?? '?'}]`);
    const prefix = service ? `${cyan(service)}: ` : '';
    const body = message ?? '';

    if (ok === true) {
      console.log(`${counter} ${green(check)} ${prefix}${body}`);
    } else if (ok === false) {
      const errMsg = error?.message ?? 'failed';
      console.log(`${counter} ${red(cross)} ${prefix}${body} — ${red(errMsg)}`);
      lastFailedEvent = { phase, service, step, total, message, error: errMsg };
    } else {
      // "starting" event — print a dim line so the user sees progress.
      console.log(`${counter} ${dim('…')} ${prefix}${body}`);
      lastStartingEvent = { phase, service, step, total, message };
    }

    if (identity?.email) {
      // Purely informational; the orchestrator emits one of these during
      // the validate phase.
    }
  };

  // Resolve the public URL from the domain the operator entered in Step 3.
  // env-hints.mjs uses this to compute TRACKING_BASE_URL, FRONTEND_URL,
  // CORS_ORIGIN, and any other public-kind env vars. If it's null, services
  // that REQUIRE a public-kind var (e.g. blast-api needs TRACKING_BASE_URL)
  // will fail with "Cannot resolve required variable" at the Setting-
  // variables step. Pre-pending https:// because operators are asked to
  // enter just the hostname (no protocol, no trailing slash).
  const publicUrl = envConfig.DOMAIN && envConfig.DOMAIN !== 'localhost'
    ? `https://${envConfig.DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
    : null;

  const orchestrator = new RailwayOrchestrator(client, {
    projectName,
    workspaceId,
    githubRepo,
    branch,
    generatedSecrets: extractSecretsFromEnvConfig(envConfig),
    publicUrl,
    userIntegrations: extractUserIntegrationsFromEnvConfig(envConfig),
    awaitPluginConfirmation: async () => {
      // By the time the plugin-prompt fires, the orchestrator has set its
      // own projectId — prefer that over whatever the progress sniff saw.
      if (orchestrator.projectId) capturedProjectId = orchestrator.projectId;
      await awaitPluginConfirmation();
    },
    onProgress: handleProgress,
  });

  // 6. Run it.
  try {
    const summary = await orchestrator.run();
    console.log('');
    console.log(`${green(check)} Deploy initiated successfully`);
    console.log(`  ${dim('•')} ${summary.servicesCreated} services created`);
    console.log(`  ${dim('•')} ${summary.servicesConfigured} services configured`);
    console.log(`  ${dim('•')} ${summary.servicesDeployed} deploys triggered`);
    console.log('');
    console.log(`Watch progress at: ${cyan('https://railway.com/project/' + summary.projectId)}`);
    console.log('');

    // Write a debug bundle on success too — operators hitting build/
    // deploy failures AFTER the script exits (e.g. a Railway build
    // breaking mid-compile) still need these identifiers to find logs,
    // and the script won't be re-invoked to regenerate them.
    writeRailwayDebugBundle({
      success: true,
      orchestrator,
      summary,
      githubRepo,
      branch,
      publicUrl,
      lastFailedEvent: null,
      lastStartingEvent: null,
      error: null,
    });

    return true;
  } catch (err) {
    console.log('');
    console.log(red(`✗ Deploy failed: ${err.message}`));
    if (err.kind === 'graphql' && err.errors) {
      for (const e of err.errors) console.log(red(`    ${e.message}`));
    }
    console.log('');
    console.log(dim('Re-run this script to retry — Railway operations are idempotent.'));
    console.log('');

    // Write the failure debug bundle — this captures every Railway
    // identifier (project ID, environment ID, service IDs) in a machine-
    // readable JSON file so an agent can later pull fresh logs without
    // having to re-ask the operator for anything.
    const bundle = writeRailwayDebugBundle({
      success: false,
      orchestrator,
      summary: null,
      githubRepo,
      branch,
      publicUrl,
      lastFailedEvent,
      lastStartingEvent,
      error: err,
    });

    // Automatically pull build + runtime logs for every service that
    // was created before the failure. This is the critical piece:
    // Railway's build failures happen asynchronously AFTER the orchestrator
    // reports success on variable-setting, so the operator (and Claude)
    // can't just look at the script's stdout to see what went wrong —
    // the actual build/deploy errors live on Railway's side and have to
    // be fetched via the API. Downloading them to local files means an
    // agent can just read the files without the operator having to run
    // `railway logs --service <name>` for every service manually.
    //
    // This block is best-effort: if the log API is unavailable or the
    // schema has changed, we log the error and still surface the debug
    // bundle so the operator can fall back to the Railway dashboard
    // manually.
    let logSummary = null;
    try {
      if (orchestrator?.projectId && orchestrator?.defaultEnvironmentId) {
        const services = [];
        if (orchestrator.serviceIds instanceof Map) {
          for (const [name, id] of orchestrator.serviceIds.entries()) {
            services.push({ name, id });
          }
        }
        if (services.length > 0) {
          console.log(dim(`Pulling build + runtime logs for ${services.length} services...`));
          logSummary = await pullRailwayLogs({
            client,
            projectId: orchestrator.projectId,
            environmentId: orchestrator.defaultEnvironmentId,
            services,
            onProgress: (result) => {
              const label = result.deployment_status ?? (result.error ? 'error' : 'pending');
              console.log(
                `  ${dim('•')} ${result.service}: ${dim(label)}`,
              );
            },
          });
          printLogPullerSummary(logSummary);
        }
      }
    } catch (logErr) {
      console.log('');
      console.log(
        `  ${warn} Could not pull Railway logs automatically: ${logErr?.message ?? String(logErr)}`,
      );
      console.log(
        dim(`  You can still inspect the project at https://railway.com/project/${orchestrator?.projectId ?? ''}`),
      );
    }

    printRailwayDebugBundleSummary(bundle, logSummary);

    return false;
  }
}

/**
 * Run a one-off command in a Railway service. Used by createSuperUser.
 *
 * The deploy path no longer needs the Railway CLI, but this admin-bootstrap
 * step does — Railway's public GraphQL API has no equivalent of
 * `railway run --service <name> -- <cmd>` for exec'ing inside a running
 * container. If the CLI isn't installed or the workspace isn't linked,
 * throw a clear error so main.mjs's createSuperUser flow can catch it and
 * fall back to manual instructions.
 */
async function runCommand(service, cmd) {
  try {
    return await runShell(`railway run --service ${service} -- ${cmd}`, { silent: true });
  } catch (err) {
    throw new Error(
      `Failed to exec command in Railway service '${service}': ${err.message}\n` +
      `Make sure the Railway CLI is installed and you're linked to the project:\n` +
      `  npm install -g @railway/cli && railway link`
    );
  }
}

/**
 * Verify login. For Railway this is best-effort because the public URL
 * isn't immediately available until the first deploy finishes and the
 * public domain is configured.
 */
async function verifyLogin(_email, _password) {
  throw new Error('Login verification deferred until the public domain is configured in the Railway dashboard.');
}

/**
 * Tear down the Railway project. Not implemented via the public API —
 * project deletion is a destructive operation we'd rather the user confirm
 * by hand from the dashboard.
 */
async function stop() {
  throw new Error(
    'Project teardown via API is not implemented. Use the Railway dashboard:\n' +
    '  Settings → Delete Project'
  );
}

export default {
  name,
  description,
  checkPrerequisites,
  deploy,
  runCommand,
  verifyLogin,
  stop,
};
