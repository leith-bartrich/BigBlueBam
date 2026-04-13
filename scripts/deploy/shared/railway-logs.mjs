// Railway log puller.
//
// Downloads build + runtime logs for every service in a Railway project
// into a local directory so coding agents (or humans) can read them
// without having to manually run `railway logs --service <name>` for
// every service one at a time.
//
// Layout of the output directory:
//
//   .deploy-state-railway-logs/
//   ├── _summary.json          ← per-service deployment status + file paths
//   ├── api/
//   │   ├── deployment.json    ← full metadata for the latest deployment
//   │   ├── build.log          ← plain text, one line per log entry
//   │   └── deploy.log
//   ├── helpdesk-api/
//   │   ├── deployment.json
//   │   ├── build.log
//   │   └── deploy.log
//   └── ...
//
// An agent can then do `grep -rn ERROR .deploy-state-railway-logs/` or
// ask for specific files by service name. The _summary.json lists every
// service with its deployment status (SUCCESS, FAILED, BUILDING, etc.)
// so the agent can quickly spot which services need investigation.
//
// This module is called automatically by railway.mjs::deploy on a
// failing deploy, and can also be invoked standalone via the
// `scripts/deploy/railway-pull-logs.mjs` entry point for post-mortem
// investigation after the deploy script has exited.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { check, cross, dim, warn, yellow, cyan } from './colors.mjs';

const DEFAULT_OUTPUT_DIR = '.deploy-state-railway-logs';

/**
 * Pull build + runtime logs for every service in a Railway project and
 * write them to local files. Safe to call on success or failure — the
 * puller catches per-service errors and continues, so one broken service
 * doesn't prevent log collection for the others.
 *
 * @param {object} args
 * @param {RailwayClient} args.client - authenticated Railway client
 * @param {string} args.projectId - Railway project ID
 * @param {string} args.environmentId - environment ID (usually default)
 * @param {Array<{name: string, id: string}>} args.services - services
 *   to fetch logs for. Typically the full list created by the
 *   orchestrator, passed in as-is from the debug bundle.
 * @param {string} [args.outputDir='.deploy-state-railway-logs'] - where
 *   to write the logs, relative to process.cwd().
 * @param {function} [args.onProgress] - optional callback invoked as
 *   `({service, status, error?})` for each service processed. The
 *   deploy script uses this to print a progress line per service.
 * @returns {Promise<object>} summary: `{ outputDir, services: [...], successCount, failureCount }`
 */
export async function pullRailwayLogs({
  client,
  projectId,
  environmentId,
  services,
  outputDir = DEFAULT_OUTPUT_DIR,
  onProgress,
} = {}) {
  if (!client || !projectId || !environmentId || !Array.isArray(services)) {
    throw new Error(
      'pullRailwayLogs requires { client, projectId, environmentId, services[] }',
    );
  }

  const absOutputDir = path.resolve(process.cwd(), outputDir);
  fs.mkdirSync(absOutputDir, { recursive: true });

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const svc of services) {
    const result = {
      service: svc.name,
      service_id: svc.id,
      deployment_id: null,
      deployment_status: null,
      deployment_created_at: null,
      build_log_path: null,
      deploy_log_path: null,
      build_line_count: 0,
      deploy_line_count: 0,
      error: null,
    };

    try {
      // 1. Get the latest deployment for this service.
      const deployments = await client.listServiceDeployments({
        projectId,
        environmentId,
        serviceId: svc.id,
        limit: 1,
      });
      if (deployments.length === 0) {
        result.error = 'No deployments found for this service.';
        results.push(result);
        failureCount++;
        if (onProgress) onProgress(result);
        continue;
      }
      const latest = deployments[0];
      result.deployment_id = latest.id;
      result.deployment_status = latest.status;
      result.deployment_created_at = latest.createdAt;

      // 2. Prepare the per-service output directory.
      const svcDir = path.join(absOutputDir, svc.name);
      fs.mkdirSync(svcDir, { recursive: true });

      // 3. Write the deployment metadata.
      fs.writeFileSync(
        path.join(svcDir, 'deployment.json'),
        JSON.stringify(latest, null, 2) + '\n',
        'utf8',
      );

      // 4. Fetch + write build logs.
      try {
        const buildLogs = await client.fetchBuildLogs(latest.id);
        const buildLogPath = path.join(svcDir, 'build.log');
        fs.writeFileSync(
          buildLogPath,
          buildLogs
            .map((l) => formatLogLine(l))
            .join('\n') + (buildLogs.length > 0 ? '\n' : ''),
          'utf8',
        );
        result.build_log_path = buildLogPath;
        result.build_line_count = buildLogs.length;
      } catch (buildErr) {
        // Don't kill the whole run for a build-logs API failure — record
        // it and continue to the deploy logs.
        result.error = `build logs: ${buildErr?.message ?? String(buildErr)}`;
      }

      // 5. Fetch + write runtime/deploy logs.
      try {
        const deployLogs = await client.fetchDeploymentLogs(latest.id);
        const deployLogPath = path.join(svcDir, 'deploy.log');
        fs.writeFileSync(
          deployLogPath,
          deployLogs
            .map((l) => formatLogLine(l))
            .join('\n') + (deployLogs.length > 0 ? '\n' : ''),
          'utf8',
        );
        result.deploy_log_path = deployLogPath;
        result.deploy_line_count = deployLogs.length;
      } catch (deployErr) {
        const prev = result.error ? result.error + '; ' : '';
        result.error = `${prev}deploy logs: ${deployErr?.message ?? String(deployErr)}`;
      }

      if (!result.error) successCount++;
      else failureCount++;
    } catch (err) {
      result.error = err?.message ?? String(err);
      failureCount++;
    }

    results.push(result);
    if (onProgress) onProgress(result);
  }

  // Write the summary index for agent consumption.
  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project_id: projectId,
    environment_id: environmentId,
    output_dir: absOutputDir,
    success_count: successCount,
    failure_count: failureCount,
    total_services: services.length,
    services: results,
    hints: [
      'To find services with failing builds or deploys, grep the summary for status: FAILED or CRASHED.',
      'Per-service logs live under <service>/build.log and <service>/deploy.log.',
      'Each log line is formatted as "[severity] timestamp message".',
      'If a service has no deployment yet, deployment_id will be null and no log files will exist for it.',
    ],
  };
  fs.writeFileSync(
    path.join(absOutputDir, '_summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8',
  );

  return summary;
}

/** Format a single log line for plain-text output. */
function formatLogLine(entry) {
  const ts = entry.timestamp ?? '';
  const sev = entry.severity ? `[${entry.severity}]` : '';
  const msg = entry.message ?? '';
  return `${sev}${ts ? ' ' + ts : ''}${(sev || ts) ? ' ' : ''}${msg}`.trimEnd();
}

/**
 * Pretty-print a short summary of a pullRailwayLogs run. Called by the
 * deploy script after a failure so the operator can see at-a-glance
 * where the logs landed and which services had problems.
 */
export function printLogPullerSummary(summary) {
  if (!summary) return;
  console.log('');
  console.log(`  ${check} Logs downloaded to ${cyan(summary.output_dir)}`);
  console.log(
    `  ${dim(`  ${summary.success_count} service(s) fetched cleanly, ${summary.failure_count} had log-fetch errors`)}`,
  );

  // Group services by deployment_status for a quick overview.
  const byStatus = new Map();
  for (const svc of summary.services ?? []) {
    const key = svc.deployment_status ?? 'UNKNOWN';
    if (!byStatus.has(key)) byStatus.set(key, []);
    byStatus.get(key).push(svc.service);
  }
  if (byStatus.size > 0) {
    console.log('');
    for (const [status, names] of byStatus.entries()) {
      const color = status === 'SUCCESS' ? check : status === 'FAILED' || status === 'CRASHED' ? cross : warn;
      console.log(`  ${color} ${status}: ${names.join(', ')}`);
    }
  }

  // Log-fetch errors (separate from Railway deployment status — these
  // mean we couldn't GET the logs, not that the deploy failed).
  const fetchFailed = (summary.services ?? []).filter((s) => s.error);
  if (fetchFailed.length > 0) {
    console.log('');
    console.log(`  ${dim('Log-fetch errors (the script could not download these):')}`);
    for (const s of fetchFailed.slice(0, 5)) {
      console.log(`    ${dim('•')} ${s.service}: ${yellow(s.error)}`);
    }
    if (fetchFailed.length > 5) {
      console.log(`    ${dim(`... and ${fetchFailed.length - 5} more (see _summary.json)`)}`);
    }
  }
}
