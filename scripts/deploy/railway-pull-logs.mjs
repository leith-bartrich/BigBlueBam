#!/usr/bin/env node
//
// Post-mortem log puller for Railway deployments.
//
// Usage:
//   node scripts/deploy/railway-pull-logs.mjs
//
// What it does: reads `.deploy-state-railway.json` (written by the
// deploy script on every run), finds the Railway PAT from env var or
// `.env`, then downloads build + runtime logs for every service listed
// in the bundle into `.deploy-state-railway-logs/`. Safe to re-run any
// time — each run overwrites the previous logs.
//
// Why this exists: Railway's build/deploy failures are async — they
// happen on Railway's side after the orchestrator has already finished
// creating and configuring services, so the deploy script itself can't
// see them. This utility lets operators (or coding agents like Claude)
// pull the current state of every service's logs in one shot, without
// having to run `railway logs --service <name>` for every service
// individually via the Railway CLI.
//
// The companion during-deploy version runs automatically inside
// railway.mjs::deploy() on failure — this standalone entry point is
// for post-facto investigation (e.g. the deploy completed but a
// service is crash-looping at runtime, or you ran the deploy 10
// minutes ago and want to check whether the builds have settled).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { RailwayClient } from './shared/railway-api.mjs';
import { pullRailwayLogs, printLogPullerSummary } from './shared/railway-logs.mjs';
import { bold, cyan, dim, red, check, cross } from './shared/colors.mjs';

const DEBUG_BUNDLE_FILE = '.deploy-state-railway.json';
const ENV_FILE = '.env';

// ─── Token resolution ──────────────────────────────────────────────────────

/**
 * Look up the Railway PAT the same way the deploy script does: env var
 * first, then .env file. We intentionally don't prompt here — this
 * utility is meant to be non-interactive for use in scripts and agent
 * flows. If no token is available, we error out with a clear message.
 */
function loadToken() {
  if (process.env.RAILWAY_TOKEN) return process.env.RAILWAY_TOKEN;
  try {
    const envPath = path.resolve(process.cwd(), ENV_FILE);
    if (!fs.existsSync(envPath)) return null;
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(/^RAILWAY_TOKEN=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // fall through
  }
  return null;
}

// ─── Debug bundle ──────────────────────────────────────────────────────────

function loadDebugBundle() {
  const bundlePath = path.resolve(process.cwd(), DEBUG_BUNDLE_FILE);
  if (!fs.existsSync(bundlePath)) {
    throw new Error(
      `${DEBUG_BUNDLE_FILE} not found in the current directory. ` +
        `Run the deploy script first (./scripts/deploy.sh) so the bundle ` +
        `gets written — even a failing deploy writes the bundle.`,
    );
  }
  const raw = fs.readFileSync(bundlePath, 'utf8');
  const bundle = JSON.parse(raw);
  if (!bundle?.project?.id) {
    throw new Error(
      `${DEBUG_BUNDLE_FILE} has no project.id — was the deploy script ` +
        `able to create the project? Check the bundle file manually.`,
    );
  }
  if (!bundle?.environment?.id) {
    throw new Error(
      `${DEBUG_BUNDLE_FILE} has no environment.id — see above.`,
    );
  }
  if (!Array.isArray(bundle?.services) || bundle.services.length === 0) {
    throw new Error(
      `${DEBUG_BUNDLE_FILE} has no services — was the deploy script ` +
        `able to create any services before failing? Check the bundle file.`,
    );
  }
  return bundle;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold('Railway Log Puller'));
  console.log(dim(`Reading ${DEBUG_BUNDLE_FILE} for project + service identifiers...`));
  console.log('');

  const bundle = loadDebugBundle();
  console.log(`  ${check} Project:      ${bundle.project.name} ${dim(`(${bundle.project.id})`)}`);
  console.log(`  ${check} Environment:  ${bundle.environment.name ?? '(unknown)'} ${dim(`(${bundle.environment.id})`)}`);
  console.log(`  ${check} Services:     ${bundle.services.length} to fetch logs for`);
  console.log('');

  const token = loadToken();
  if (!token) {
    console.log(red('No Railway PAT found.'));
    console.log(
      dim(
        '  Set RAILWAY_TOKEN in your shell env, or add RAILWAY_TOKEN=<your-pat> to .env.',
      ),
    );
    console.log(
      dim(
        '  Generate a PAT at https://railway.com/account/tokens — it must be an',
      ),
    );
    console.log(
      dim('  account-level Personal Access Token, not a Project or Workspace token.'),
    );
    process.exit(1);
  }
  console.log(`  ${check} Railway PAT loaded from ${process.env.RAILWAY_TOKEN ? 'env var' : '.env file'}`);
  console.log('');

  const client = new RailwayClient(token);
  // Cheap PAT validation — fail fast if the token is stale.
  try {
    const me = await client.whoami();
    console.log(`  ${check} Authenticated as ${me.email ?? me.name ?? 'unknown user'}`);
  } catch (err) {
    console.log(red(`  ${cross} Token rejected: ${err?.message ?? String(err)}`));
    console.log(
      dim(
        '  Regenerate the PAT at https://railway.com/account/tokens and try again.',
      ),
    );
    process.exit(1);
  }
  console.log('');

  console.log(dim(`Pulling build + runtime logs for ${bundle.services.length} services...`));
  const summary = await pullRailwayLogs({
    client,
    projectId: bundle.project.id,
    environmentId: bundle.environment.id,
    services: bundle.services,
    onProgress: (result) => {
      const label = result.deployment_status ?? (result.error ? 'error' : 'pending');
      console.log(`  ${dim('•')} ${result.service}: ${dim(label)}`);
    },
  });
  printLogPullerSummary(summary);

  console.log('');
  console.log(bold('  ─── Next steps ─────────────────────────────────────────────'));
  console.log(`  ${dim('# Tell Claude (or any coding agent) to read the logs:')}`);
  console.log(
    `  ${cyan(`"Read ${DEBUG_BUNDLE_FILE} and ${path.basename(summary.output_dir)}/_summary.json,`)}`,
  );
  console.log(`   ${cyan(`then help me debug the Railway deploy."`)}`);
  console.log('');
  console.log(`  ${dim('# Or grep directly for errors:')}`);
  console.log(`  ${cyan(`grep -rn "ERROR\\|FAILED\\|error" ${path.basename(summary.output_dir)}/`)}`);
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error(red(`Error: ${err?.message ?? String(err)}`));
  if (process.env.DEBUG && err?.stack) console.error(dim(err.stack));
  process.exitCode = 1;
});
