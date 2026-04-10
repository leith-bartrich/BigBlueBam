#!/usr/bin/env node
/**
 * gen-railway-configs.mjs
 *
 * Generates `railway/<service>.json` files from the authoritative service
 * catalog in scripts/deploy/shared/services.mjs. Each file is a standalone
 * Railway config-as-code manifest that the user points a Railway service at
 * via the dashboard's "Config Path" setting.
 *
 * Usage:
 *   node scripts/gen-railway-configs.mjs
 *
 * Re-run whenever services.mjs changes. Output is checked in.
 *
 * Why this layout (config-as-code under railway/ at the repo root):
 *
 *   Our Dockerfiles expect the MONOREPO ROOT as the build context — they do
 *   `COPY apps/api/package.json`, `COPY packages/shared/src`, etc. Railway's
 *   per-service "Root Directory" setting doubles as the build context, so if
 *   we set Root Directory to `apps/api` the build breaks. Instead we leave
 *   Root Directory at the repo root for every service and point each
 *   service's "Config Path" at its own file under `railway/`. The dockerfile
 *   path inside each railway.json is then relative to the repo root
 *   (`apps/api/Dockerfile`), which matches docker-compose.yml exactly.
 *
 * Watch patterns per service mean Railway only rebuilds when files that
 * actually affect that service change — essential for a 22-service monorepo.
 */
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_SERVICES,
  INFRA_SERVICES,
  JOB_SERVICES,
} from './deploy/shared/services.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'railway');

// ─── Watch patterns ───────────────────────────────────────────────────
//
// A service is rebuilt when any matched file changes. We include the
// service's own source tree, its Dockerfile, the shared schema package
// (everything depends on it), the root lockfile, and the root package.json.

function watchPatternsFor(service) {
  if (!service.dockerfile) return undefined;
  const appDir = service.dockerfile.replace(/\/Dockerfile$/, '');
  return [
    `${appDir}/**`,
    'packages/shared/**',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'package.json',
    'tsconfig.base.json',
    service.dockerfile,
  ];
}

// ─── Config builders ──────────────────────────────────────────────────

function buildAppConfig(service) {
  const config = {
    $schema: 'https://railway.com/railway.schema.json',
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: service.dockerfile,
    },
    deploy: {
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
    },
  };

  const watch = watchPatternsFor(service);
  if (watch) config.build.watchPatterns = watch;

  if (service.start_command) {
    config.deploy.startCommand = service.start_command;
  }
  if (service.healthcheck) {
    config.deploy.healthcheckPath = service.healthcheck;
    config.deploy.healthcheckTimeout = 100;
  }
  return config;
}

function buildInfraConfig(service) {
  // Self-hosted infra services use a tiny passthrough Dockerfile under
  // infra/railway/<name>/Dockerfile so we can keep the same config-as-code
  // pattern for everything (single uniform path on Railway).
  return {
    $schema: 'https://railway.com/railway.schema.json',
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: service.dockerfile,
      watchPatterns: [service.dockerfile],
    },
    deploy: {
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
    },
  };
}

function buildJobConfig(service) {
  // One-shot jobs (migrate) — no healthcheck, no restart. The migrate job
  // bakes infra/postgres/migrations/ into the api image, so a new SQL file
  // there must trigger a rebuild even though apps/api/** didn't change.
  const watch = watchPatternsFor(service) ?? [];
  if (service.name === 'migrate') {
    watch.push('infra/postgres/migrations/**');
  }
  return {
    $schema: 'https://railway.com/railway.schema.json',
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: service.dockerfile,
      watchPatterns: watch,
    },
    deploy: {
      startCommand: service.start_command,
      restartPolicyType: 'NEVER',
    },
  };
}

// ─── Write ────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

// Wipe existing files in OUT_DIR (not subdirs) so renames/removals are
// reflected. We do NOT recurse, so a `.gitkeep` or README stays put.
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) unlinkSync(join(OUT_DIR, f));
}

let written = 0;
const manifests = [];

for (const svc of APP_SERVICES) {
  const path = join(OUT_DIR, `${svc.name}.json`);
  writeFileSync(path, JSON.stringify(buildAppConfig(svc), null, 2) + '\n');
  manifests.push({ name: svc.name, kind: 'app', file: `railway/${svc.name}.json` });
  written++;
}

for (const svc of INFRA_SERVICES) {
  // Skip managed services (postgres, redis) — those are Railway plugins,
  // not container builds. The user adds them via `railway add --database`
  // or from the dashboard.
  if (svc.managed_on_railway) {
    manifests.push({ name: svc.name, kind: 'managed', file: '(Railway plugin)' });
    continue;
  }
  const path = join(OUT_DIR, `${svc.name}.json`);
  writeFileSync(path, JSON.stringify(buildInfraConfig(svc), null, 2) + '\n');
  manifests.push({ name: svc.name, kind: 'infra', file: `railway/${svc.name}.json` });
  written++;
}

for (const svc of JOB_SERVICES) {
  const path = join(OUT_DIR, `${svc.name}.json`);
  writeFileSync(path, JSON.stringify(buildJobConfig(svc), null, 2) + '\n');
  manifests.push({ name: svc.name, kind: 'job', file: `railway/${svc.name}.json` });
  written++;
}

// Write a manifest index for humans.
const readmeLines = [
  '# Railway service configs',
  '',
  'Auto-generated by `scripts/gen-railway-configs.mjs`. Do not edit by hand;',
  'update `scripts/deploy/shared/services.mjs` and re-run the generator:',
  '',
  '```',
  'node scripts/gen-railway-configs.mjs',
  '```',
  '',
  '## How to use these',
  '',
  'Railway reads one config file per service. In the Railway dashboard, for',
  'every service you create in your project:',
  '',
  '1. **Root Directory**: leave as `.` (repo root) — our Dockerfiles build',
  '   from the monorepo root, not from `apps/<name>/`.',
  '2. **Config Path**: set to `railway/<service>.json` (e.g.',
  '   `railway/api.json` for the Bam API service).',
  '3. Railway will read the Dockerfile path, start command, healthcheck and',
  '   watch patterns from that file.',
  '',
  'Environment variables still live in the Railway dashboard (or pushed via',
  '`railway variables set`); they are **not** in these JSON files. See each',
  "service's entry in `scripts/deploy/shared/services.mjs` for the required",
  'and optional env-var list.',
  '',
  '## Services in this project',
  '',
  '| Service | Kind | Config |',
  '|---------|------|--------|',
];
for (const m of manifests) {
  readmeLines.push(`| \`${m.name}\` | ${m.kind} | ${m.file} |`);
}
readmeLines.push('');
writeFileSync(join(OUT_DIR, 'README.md'), readmeLines.join('\n'));

process.stdout.write(`Wrote ${written} Railway configs to ${OUT_DIR}\n`);
for (const m of manifests) {
  process.stdout.write(`  - ${m.name.padEnd(14)} ${m.kind.padEnd(8)} ${m.file}\n`);
}
