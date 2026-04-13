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
import { ask, confirm } from '../shared/prompt.mjs';
import { RailwayClient, RailwayApiError } from '../shared/railway-api.mjs';
import { RailwayOrchestrator } from '../shared/railway-orchestrator.mjs';

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
  try {
    execSync('railway version', { stdio: 'pipe' });
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
  console.log(dim('    3. Prompt to add Postgres + Redis plugins (one click each)'));
  console.log(dim('    4. Create + configure every service (source, Dockerfile,'));
  console.log(dim('       healthcheck, env vars)'));
  console.log(dim('    5. Trigger initial deploys'));
  console.log('');
  console.log(dim('  Reference: railway/env-vars.md'));
  console.log(dim('  ─────────────────────────────────────────────────────────────'));
  console.log('');
}

/**
 * Extract the generated-secrets bundle the orchestrator expects from the
 * envConfig produced by buildEnvConfig(). Missing keys fall through as empty
 * strings so the orchestrator's `secret` branch can SKIP cleanly.
 */
function extractSecretsFromEnvConfig(envConfig = {}) {
  return {
    SESSION_SECRET: envConfig.SESSION_SECRET ?? '',
    INTERNAL_HELPDESK_SECRET: envConfig.INTERNAL_HELPDESK_SECRET ?? '',
    INTERNAL_SERVICE_SECRET: envConfig.INTERNAL_SERVICE_SECRET ?? envConfig.INTERNAL_HELPDESK_SECRET ?? '',
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

  // 5. Build the orchestrator. The plugin-prompt callback needs the
  //    projectId so it can print a working dashboard link — capture it from
  //    the onProgress 'project' phase events as the orchestrator emits them.
  let capturedProjectId = null;

  const awaitPluginConfirmation = async () => {
    console.log('');
    console.log(bold('  The only manual step: add Postgres + Redis plugins.'));
    console.log('');
    const projectUrl = capturedProjectId
      ? `https://railway.com/project/${capturedProjectId}`
      : 'https://railway.com/dashboard';
    console.log(`    1. Open ${cyan(projectUrl)}`);
    console.log(`    2. Click '${bold('New')}' → '${bold('Database')}' → '${bold('Add PostgreSQL')}'`);
    console.log(`    3. Click '${bold('New')}' → '${bold('Database')}' → '${bold('Add Redis')}'`);
    console.log('');
    await confirm("I've added both plugins. Continue?", true);
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
    } else {
      // "starting" event — print a dim line so the user sees progress.
      console.log(`${counter} ${dim('…')} ${prefix}${body}`);
    }

    if (identity?.email) {
      // Purely informational; the orchestrator emits one of these during
      // the validate phase.
    }
  };

  const orchestrator = new RailwayOrchestrator(client, {
    projectName,
    workspaceId: null,
    githubRepo,
    branch,
    generatedSecrets: extractSecretsFromEnvConfig(envConfig),
    publicUrl: null,
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
    return true;
  } catch (err) {
    console.log('');
    console.log(red(`✗ Deploy failed: ${err.message}`));
    if (err.kind === 'graphql' && err.errors) {
      for (const e of err.errors) console.log(red(`    ${e.message}`));
    }
    console.log('');
    console.log(dim('Re-run this script to retry — Railway operations are idempotent.'));
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
