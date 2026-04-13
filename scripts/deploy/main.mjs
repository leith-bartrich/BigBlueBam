#!/usr/bin/env node

// BigBlueBam Deployment Orchestrator
// Zero npm dependencies — Node 22 built-ins only.

import { banner, select, confirm, ask } from './shared/prompt.mjs';
import { loadState, saveState, isPhaseComplete, markPhaseComplete, resetState } from './shared/state.mjs';
import { checkSharedPrerequisites } from './shared/prerequisites.mjs';
import { chooseDeployBranch } from './shared/branch-select.mjs';
import {
  generateSecrets,
  promptStorageChoice,
  promptVectorDbChoice,
  promptLiveKitChoice,
  promptOptionalIntegrations,
  promptRootRedirect,
  buildEnvConfig,
} from './shared/secrets.mjs';
import { createSuperUser } from './shared/admin-setup.mjs';
import { printSummary } from './shared/summary.mjs';
import { bold, dim, green, red, yellow, cyan, check, cross } from './shared/colors.mjs';

// Platform modules
import railway from './platforms/railway.mjs';
import dockerCompose from './platforms/docker-compose.mjs';

const PLATFORMS = [dockerCompose, railway];

async function main() {
  banner('BigBlueBam Deployment Setup');

  console.log("Welcome to BigBlueBam! Let's get you set up.\n");
  console.log('This will take about 10 minutes. Here is what we will do:\n');
  console.log('  1. Choose your hosting platform');
  console.log('  2. Check prerequisites');
  console.log('  3. Configure services and integrations');
  console.log('  4. Generate secrets and write .env');
  console.log('  5. Build and launch everything');
  console.log('  6. Create your admin account');
  console.log('');

  const state = loadState();

  // --- Handle --reset flag ---
  if (process.argv.includes('--reset')) {
    if (await confirm('This will reset all deployment state. Continue?', false)) {
      resetState();
      console.log(`${check} State reset. Starting fresh.\n`);
      return main(); // restart
    }
    return;
  }

  // --- Phase 1: Platform selection ---
  let platform;
  if (state.platform && !process.argv.includes('--reconfigure')) {
    const prev = PLATFORMS.find((p) => p.name === state.platform);
    if (prev && await confirm(`Continue with ${bold(prev.name)}?`, true)) {
      platform = prev;
    }
  }
  if (!platform) {
    const choice = await select('Where are you deploying?', PLATFORMS.map((p) => ({
      label: p.name,
      value: p.name,
      description: p.description,
    })));
    platform = PLATFORMS.find((p) => p.name === choice);
    state.platform = choice;
    saveState(state);
  }

  // --- Phase 1b: Branch selection ---
  //
  // BigBlueBam uses a two-branch model: `stable` for production deploys
  // (validated on main first) and `main` for bleeding-edge. Ask once here
  // and save the choice to state; subsequent runs offer to reuse it.
  let branch;
  if (state.branch && !process.argv.includes('--reconfigure')) {
    if (await confirm(`Continue deploying ${bold(state.branch)}?`, true)) {
      branch = state.branch;
    }
  }
  if (!branch) {
    console.log('');
    branch = await chooseDeployBranch({ previous: state.branch });
    state.branch = branch;
    saveState(state);
  }

  // --- Phase 2: Prerequisites ---
  if (!isPhaseComplete(state, 'prerequisites')) {
    console.log('');
    checkSharedPrerequisites();
    await platform.checkPrerequisites();
    markPhaseComplete(state, 'prerequisites');
    saveState(state);
  } else {
    if (await confirm('Prerequisites were already checked. Re-check?', false)) {
      checkSharedPrerequisites();
      await platform.checkPrerequisites();
    } else {
      console.log(dim('  Skipping prerequisite checks.\n'));
    }
  }

  // --- Phase 3: Configuration ---
  let envConfig;
  if (isPhaseComplete(state, 'configuration') && state.envConfig && !process.argv.includes('--reconfigure')) {
    if (await confirm('Configuration from a previous run was found. Keep it?', true)) {
      envConfig = state.envConfig;
      console.log(`${check} Using saved configuration.\n`);
    } else {
      envConfig = null;
    }
  }

  if (!envConfig) {
    console.log(`\n${bold('Step 3: Configure your deployment')}\n`);

    // Domain
    const domain = await ask(
      'Domain name (or "localhost" for local development):',
      'localhost',
    );

    // Generate secrets
    process.stdout.write('\nGenerating cryptographic secrets... ');
    const secrets = generateSecrets();
    console.log(check);

    // Storage
    const storage = await promptStorageChoice();

    // Vector DB
    const vectorDb = await promptVectorDbChoice();

    // LiveKit
    const livekit = await promptLiveKitChoice();

    // Optional integrations
    const integrations = await promptOptionalIntegrations();

    // Root redirect choice
    const rootRedirect = await promptRootRedirect();

    // Build complete config
    envConfig = buildEnvConfig({
      secrets,
      storage,
      vectorDb,
      livekit,
      integrations,
      domain,
    });

    // Save to state for resume
    state.envConfig = envConfig;
    state.rootRedirect = rootRedirect;
    state.choices = {
      domain,
      storage: storage.storageProvider,
      vectorDb: vectorDb.vectorProvider,
      livekit: livekit.livekitProvider,
      rootRedirect,
    };
    markPhaseComplete(state, 'configuration');
    saveState(state);

    console.log(`\n${check} Configuration complete.\n`);
  }

  // --- Phase 4: Deploy ---
  if (!isPhaseComplete(state, 'deploy')) {
    console.log(`${bold('Step 5: Build and launch')}\n`);

    if (await confirm('Ready to build and start all services?', true)) {
      const healthy = await platform.deploy(envConfig, { branch });
      if (healthy) {
        markPhaseComplete(state, 'deploy');
        saveState(state);
      } else {
        console.log(yellow('\nDeploy started but health checks did not pass. Re-run to retry.\n'));
        saveState(state);
      }
    } else {
      console.log(yellow('\nDeployment paused. Re-run this script to continue.\n'));
      return;
    }
  } else {
    console.log(`${check} Services were already deployed.`);
    if (await confirm('Redeploy?', false)) {
      await platform.deploy(envConfig, { branch });
    } else {
      console.log(dim('  Skipping deployment.\n'));
    }
  }

  // --- Phase 5: Admin account ---
  if (!isPhaseComplete(state, 'admin')) {
    console.log(`\n${bold('Step 6: Create admin account')}\n`);

    const result = await createSuperUser(platform);
    if (result.success) {
      state.adminEmail = result.email;
      markPhaseComplete(state, 'admin');
      saveState(state);
    }
  } else {
    console.log(`${check} Admin account already created (${dim(state.adminEmail || 'unknown')}).`);
    if (await confirm('Create another admin account?', false)) {
      await createSuperUser(platform);
    }
  }

  // --- Set root redirect if configured ---
  if (state.rootRedirect && state.rootRedirect !== 'site') {
    try {
      process.stdout.write(`Setting root redirect to /${state.rootRedirect}/... `);
      await platform.runCommand('api',
        `node -e "const p=require('postgres');const s=p(process.env.DATABASE_URL);s\\\`UPDATE system_settings SET value='\"${state.rootRedirect}\"' WHERE key='root_redirect'\\\`.then(()=>s.end())"`
      );
      console.log(check);
    } catch {
      console.log(dim('[skipped — you can set this in SuperUser settings]'));
    }
  }

  // --- Phase 6: Summary ---
  const choices = state.choices || {};
  printSummary({
    domain: choices.domain || envConfig.DOMAIN || 'localhost',
    adminEmail: state.adminEmail,
    storage: choices.storage || 'skip',
    vectorDb: choices.vectorDb || 'skip',
    livekit: choices.livekit || 'skip',
    platform: state.platform === 'Docker Compose' ? 'docker-compose' : state.platform,
  });

  // Mark everything done
  markPhaseComplete(state, 'complete');
  saveState(state);
}

// Top-level runner.
//
// Node's libuv will assert with `UV_HANDLE_CLOSING` (src\win\async.c:76) if
// the process exits while a readline interface still has pending callbacks.
// That happens when an error is thrown mid-prompt and propagates through
// `main().catch()` directly to `process.exit()`. The fix is to let the
// event loop drain naturally:
//
//   1. Catch any error thrown from main() cleanly.
//   2. Print the message in a friendly red banner, including the `.cause`
//      chain so targeted errors (like the PAT-vs-Project-Token one from
//      railway.mjs::nonPatTokenError) still show their full context.
//   3. Pause stdin so readline's async handle can be collected.
//   4. Set process.exitCode instead of calling process.exit() — Node drains
//      the event loop normally and exits with the right status.
async function runMain() {
  try {
    await main();
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('');
    console.error(red(bold('Deployment interrupted:')));
    console.error(`  ${msg.split('\n').join('\n  ')}`);
    if (err?.cause && err.cause.message && err.cause.message !== msg) {
      console.error(dim(`\n  caused by: ${err.cause.message}`));
    }
    if (process.env.DEBUG && err?.stack) {
      console.error(dim('\n' + err.stack));
    }
    console.error('');
    // Release any readline-held stdin handle so libuv can close cleanly.
    try { process.stdin.pause(); } catch {}
    process.exitCode = 1;
  }
}

runMain();
