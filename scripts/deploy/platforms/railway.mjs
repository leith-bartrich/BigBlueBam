// Railway platform adapter — managed container deployment.
//
// PREVIEW: This adapter sets up the Railway project, provisions the managed
// Postgres + Redis plugins, and walks the user through the manual dashboard
// steps required to bring all 19 BigBlueBam services online with the
// config-as-code manifests under `railway/` and the env-var reference under
// `railway/env-vars.md`. A fully automated one-click "deploy from GitHub"
// experience is on the roadmap — for now this adapter prints a clear
// checklist instead of pretending it can do `railway up` across the whole
// stack.
//
// Zero dependencies (node:child_process, node:fs only).

import { execSync, spawn } from 'node:child_process';
import { bold, check, cross, dim, green, yellow, cyan, red, warn } from '../shared/colors.mjs';
import { ask, confirm } from '../shared/prompt.mjs';
import {
  APP_SERVICES,
  INFRA_SERVICES,
  JOB_SERVICES,
  getManagedInfra,
  getSelfHostedInfra,
} from '../shared/services.mjs';

const name = 'Railway (Preview)';
const description = 'Managed containers on Railway.app — config-as-code ready, one-click deploy coming soon';

/**
 * Escape a string for safe interpolation into a shell command.
 */
function shellEscape(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

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
 * Check if Railway CLI is installed and authenticated.
 */
async function checkPrerequisites() {
  console.log(bold('Checking Railway setup...\n'));

  // Railway CLI
  let cliInstalled = false;
  try {
    const ver = execSync('railway version', { stdio: 'pipe', encoding: 'utf8' }).trim();
    console.log(`  ${check} Railway CLI installed  (${ver})`);
    cliInstalled = true;
  } catch {
    console.log(`  ${cross} Railway CLI not found`);
    console.log('');
    console.log('  Install the Railway CLI:');
    console.log(cyan('    npm install -g @railway/cli'));
    console.log('');
    console.log('  Or see: https://docs.railway.app/guides/cli');

    if (await confirm('\nWould you like to install it now?', true)) {
      try {
        await runShell('npm install -g @railway/cli');
        console.log(`  ${check} Railway CLI installed`);
        cliInstalled = true;
      } catch {
        console.log(`  ${cross} Installation failed. Please install manually.`);
        throw new Error('Railway CLI is required.');
      }
    } else {
      throw new Error('Railway CLI is required. Install it with: npm install -g @railway/cli');
    }
  }

  // Authenticated
  try {
    execSync('railway whoami', { stdio: 'pipe' });
    console.log(`  ${check} Authenticated with Railway`);
  } catch {
    console.log(`  ${warn} Not logged in to Railway`);
    console.log('');
    console.log('  Logging in...');
    await runShell('railway login');
    try {
      const who = execSync('railway whoami', { stdio: 'pipe', encoding: 'utf8' }).trim();
      console.log(`  ${check} Logged in as ${who}`);
    } catch {
      throw new Error('Railway login failed. Please run: railway login');
    }
  }

  console.log('');
  return true;
}

/**
 * Print the preview banner explaining the current state of Railway support.
 */
function printPreviewBanner() {
  console.log('');
  console.log(yellow(bold('  ▲ Railway deployment is in PREVIEW')));
  console.log(dim('  ─────────────────────────────────────────────────────────────'));
  console.log(dim('  Config-as-code is ready: every service has its own railway/'));
  console.log(dim('  *.json manifest and the frontend image bakes in a Railway-'));
  console.log(dim('  flavored nginx config that uses *.railway.internal upstreams.'));
  console.log('');
  console.log(dim('  Full automation (one-click "deploy from GitHub") is coming.'));
  console.log(dim('  For now, this script handles the project + plugin setup,'));
  console.log(dim('  then walks you through the dashboard steps for each service.'));
  console.log('');
  console.log(dim('  See:'));
  console.log(dim('    railway/README.md     — config-as-code overview'));
  console.log(dim('    railway/env-vars.md   — full env-var reference'));
  console.log(dim('  ─────────────────────────────────────────────────────────────'));
  console.log('');
}

/**
 * Set up the Railway project, provision managed plugins, and walk through
 * the manual dashboard steps for each app service. Returns false (deploy
 * not "complete") so the orchestrator marks the phase as needing user
 * action — re-running picks up from this point.
 */
async function deploy(envConfig) {
  printPreviewBanner();

  // Step 1: project
  console.log(bold('Step 1: Railway project\n'));
  const projectName = await ask('Railway project name:', 'bigbluebam');
  console.log(`\nCreating project ${cyan(projectName)}...`);
  try {
    await runShell(`railway init --name ${shellEscape(projectName)}`);
    console.log(`${check} Project created`);
  } catch {
    console.log(yellow('  Project may already exist, trying to link...'));
    try {
      await runShell(`railway link --project ${shellEscape(projectName)}`);
      console.log(`${check} Linked to existing project`);
    } catch {
      console.log(yellow('  Could not link automatically. Run `railway link` in another shell, then re-run this script.'));
      return false;
    }
  }

  // Step 2: managed plugins (Postgres, Redis)
  console.log(`\n${bold('Step 2: Managed infrastructure (Postgres + Redis)')}\n`);
  for (const svc of getManagedInfra()) {
    process.stdout.write(`  Adding ${svc.description}... `);
    try {
      await runShell(`railway add --database ${svc.name}`, { silent: true });
      console.log(check);
    } catch {
      console.log(yellow('already exists'));
    }
  }

  // Step 3: print the manual dashboard checklist
  console.log(`\n${bold('Step 3: Create services in the Railway dashboard')}\n`);
  console.log('Open your Railway project and create the following services. For');
  console.log('each one, set:');
  console.log('');
  console.log(`  ${cyan('Source')}        GitHub → this repository (or current branch)`);
  console.log(`  ${cyan('Root Dir')}      ${dim('. (repo root — leave default)')}`);
  console.log(`  ${cyan('Config Path')}   railway/<service>.json`);
  console.log('');
  console.log('Then set the env vars listed in railway/env-vars.md for each.');
  console.log('');

  const selfHosted = getSelfHostedInfra();
  const sections = [
    { title: 'Application services', list: APP_SERVICES.filter((s) => s.required) },
    { title: 'Optional services', list: APP_SERVICES.filter((s) => !s.required) },
    { title: 'Self-hosted infrastructure', list: selfHosted },
    { title: 'One-shot jobs', list: JOB_SERVICES },
  ];

  for (const sec of sections) {
    if (sec.list.length === 0) continue;
    console.log(`  ${bold(sec.title)}`);
    for (const svc of sec.list) {
      const tag = svc.is_public_ingress ? cyan(' [public ingress]') : '';
      console.log(`    ${dim('•')} ${svc.name}${tag}`);
      console.log(`      ${dim(`config: railway/${svc.name}.json`)}`);
    }
    console.log('');
  }

  console.log(dim('  Tip: open the dashboard with:'));
  console.log(cyan('    railway open'));
  console.log('');

  if (envConfig) {
    console.log(`${dim('Your generated secrets are saved in .env locally — copy them into')}`);
    console.log(`${dim('Railway as service-level variables (or shared variables at the project')}`);
    console.log(`${dim('level so plugin references like ${{Postgres.DATABASE_URL}} resolve).')}`);
    console.log('');
  }

  console.log(yellow('  Manual setup required to continue. After every service is created'));
  console.log(yellow('  and reports healthy in the Railway dashboard, re-run this script'));
  console.log(yellow('  with --reconfigure to advance to the admin-account step.'));
  console.log('');

  // Return false so the orchestrator does NOT mark the deploy phase as
  // complete — the user has manual work to do, and re-running the script
  // should bring them back here until they confirm services are live.
  return false;
}

/**
 * Run a one-off command in a Railway service. Used by createSuperUser.
 */
async function runCommand(service, cmd) {
  return runShell(`railway run --service ${service} -- ${cmd}`, { silent: true });
}

/**
 * Verify login. For Railway this is best-effort because the public URL
 * isn't immediately available after a manual dashboard setup.
 */
async function verifyLogin(_email, _password) {
  throw new Error('Login verification deferred until the public domain is configured in the Railway dashboard.');
}

/**
 * Tear down the linked Railway project (CAUTION: removes all services).
 */
async function stop() {
  await runShell('railway down');
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
