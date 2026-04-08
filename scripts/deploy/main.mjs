#!/usr/bin/env node

// BigBlueBam Deployment Orchestrator
// Zero npm dependencies — Node 22 built-ins only.

import { banner, select, confirm, ask } from './shared/prompt.mjs';
import { loadState, saveState, isPhaseComplete, markPhaseComplete, resetState } from './shared/state.mjs';
import { checkSharedPrerequisites } from './shared/prerequisites.mjs';
import {
  generateSecrets,
  promptStorageChoice,
  promptVectorDbChoice,
  promptLiveKitChoice,
  promptOptionalIntegrations,
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
    state.choices = {
      domain,
      storage: storage.storageProvider,
      vectorDb: vectorDb.vectorProvider,
      livekit: livekit.livekitProvider,
    };
    markPhaseComplete(state, 'configuration');
    saveState(state);

    console.log(`\n${check} Configuration complete.\n`);
  }

  // --- Phase 4: Deploy ---
  if (!isPhaseComplete(state, 'deploy')) {
    console.log(`${bold('Step 5: Build and launch')}\n`);

    if (await confirm('Ready to build and start all services?', true)) {
      const healthy = await platform.deploy(envConfig);
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
      await platform.deploy(envConfig);
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

main().catch((err) => {
  console.error(`\n${red('Error: ' + err.message)}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
