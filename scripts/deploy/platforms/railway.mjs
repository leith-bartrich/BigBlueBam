// Railway platform adapter — managed container deployment.
// Zero dependencies (node:child_process, node:fs only).

import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bold, check, cross, dim, green, yellow, cyan, red, warn } from '../shared/colors.mjs';
import { ask, confirm } from '../shared/prompt.mjs';
import { SERVICES, INFRASTRUCTURE } from '../shared/services.mjs';

const name = 'Railway';
const description = 'Managed containers on Railway.app (easiest for cloud)';

/**
 * Run a shell command and return stdout on success.
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

  // 1. Railway CLI
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

  // 2. Authenticated
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
 * Deploy to Railway.
 */
async function deploy(envConfig) {
  console.log(bold('\nSetting up Railway project...\n'));

  // Create or link project
  const projectName = await ask('Railway project name:', 'bigbluebam');
  console.log(`\nCreating project ${cyan(projectName)}...`);
  try {
    await runShell(`railway init --name ${projectName}`);
    console.log(`${check} Project created`);
  } catch {
    console.log(yellow('  Project may already exist, trying to link...'));
    try {
      await runShell(`railway link --project ${projectName}`);
      console.log(`${check} Linked to existing project`);
    } catch {
      console.log(yellow('  Could not link. Continuing...'));
    }
  }

  // Set environment variables
  console.log('\nConfiguring environment variables...');
  let setCount = 0;
  for (const [key, val] of Object.entries(envConfig)) {
    if (val != null && val !== '') {
      try {
        await runShell(`railway variables set ${key}="${val}"`, { silent: true });
        setCount++;
      } catch {
        console.log(yellow(`  ${warn} could not set ${key}`));
      }
    }
  }
  console.log(`${check} ${setCount} environment variables configured`);

  // Add managed services (Postgres, Redis)
  console.log('\nProvisioning infrastructure...');
  const managedServices = INFRASTRUCTURE.filter((i) => i.required && i.managed);
  for (const svc of managedServices) {
    process.stdout.write(`  Adding ${svc.description}... `);
    try {
      await runShell(`railway add --plugin ${svc.name}`, { silent: true });
      console.log(check);
    } catch {
      console.log(yellow('already exists'));
    }
  }

  // Deploy
  console.log(`\n${bold('Deploying services...')}\n`);
  console.log(dim('This will build and deploy all services. This may take 10-15 minutes.\n'));

  await runShell('railway up --detach');

  console.log(`\n${check} Deployment started`);
  console.log(dim('\nRailway will build and deploy your services in the background.'));
  console.log(dim('Check status at: https://railway.app/dashboard\n'));

  return true;
}

/**
 * Run a command in a Railway service.
 */
async function runCommand(service, cmd) {
  return runShell(`railway run --service ${service} -- ${cmd}`, { silent: true });
}

/**
 * Verify login (Railway -- best-effort, URL may not be known yet).
 */
async function verifyLogin(_email, _password) {
  // For Railway, verification is best-effort since the public URL
  // is not immediately available after deploy --detach.
  throw new Error('Login verification deferred until deployment completes.');
}

/**
 * Tear down Railway project.
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
