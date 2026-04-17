#!/usr/bin/env node

/**
 * Documentation screenshot capture runner.
 *
 * Usage:
 *   node scripts/docs/capture.mjs                     # all 14 apps
 *   node scripts/docs/capture.mjs --apps bond,bench   # specific apps only
 *
 * Requires a running stack at http://localhost (or DOCS_CAPTURE_BASE_URL).
 * Outputs PNGs to docs/apps/{app}/screenshots/{light,dark}/ and writes
 * per-app meta.json files.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let requestedApps = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--apps' && args[i + 1]) {
    requestedApps = args[i + 1].split(',').map((s) => s.trim().toLowerCase());
    i++;
  }
}

// ---------------------------------------------------------------------------
// Dynamic import of scene registry
//
// The scene files are TypeScript. Rather than requiring a build step, we
// import the compiled output when available. If the package has not been
// built yet, we fall back to a hard-coded registry that maps app names to
// their scene module paths and uses tsx/ts-node if available, or prints a
// helpful error.
//
// For simplicity in the initial version, we hard-code the scene arrays
// inline. This avoids a build dependency. A future iteration will import
// from the compiled @bigbluebam/docs-capture package.
// ---------------------------------------------------------------------------

// We duplicate the scene definitions here as plain JS objects so the CLI
// runner works without a prior `pnpm build` of docs-capture. The canonical
// source of truth remains the .scenes.ts files.

/** @typedef {{ id: string, label: string, route: string, waitFor?: string, setup?: (page: import('playwright').Page) => Promise<void>, screenshot_after?: boolean }} Scene */

/** @type {Record<string, Scene[]>} */
const APP_SCENES = await loadScenes();

async function loadScenes() {
  // Try importing from the built package first
  try {
    const mod = await import('../../packages/docs-capture/dist/apps/index.js');
    if (mod.APP_SCENES && Object.keys(mod.APP_SCENES).length > 0) {
      console.log('[init] Loaded scenes from compiled @bigbluebam/docs-capture');
      return mod.APP_SCENES;
    }
  } catch {
    // Not built yet; fall through to inline definitions
  }

  console.log('[init] Using inline scene definitions (docs-capture package not built)');
  return {
    bam: [
      { id: '01-board', label: 'Kanban board', route: '/b3/', waitFor: 'main' },
      { id: '02-sprint-board', label: 'Sprint board', route: '/b3/', waitFor: 'main' },
      { id: '03-task-detail', label: 'Task detail', route: '/b3/', waitFor: 'main' },
      { id: '04-people', label: 'People management', route: '/b3/people', waitFor: 'main' },
      { id: '05-settings', label: 'Project settings', route: '/b3/settings', waitFor: 'main' },
    ],
    banter: [
      { id: '01-channels', label: 'Channel list', route: '/banter/', waitFor: 'main' },
      { id: '02-channel-view', label: 'Channel conversation', route: '/banter/', waitFor: 'main' },
      { id: '03-threads', label: 'Thread view', route: '/banter/', waitFor: 'main' },
      { id: '04-dms', label: 'Direct messages', route: '/banter/dms', waitFor: 'main' },
    ],
    beacon: [
      { id: '01-home', label: 'Knowledge Home', route: '/beacon/', waitFor: 'main' },
      { id: '02-browse', label: 'Article list', route: '/beacon/', waitFor: 'main' },
      { id: '03-detail', label: 'Article detail', route: '/beacon/', waitFor: 'main' },
      { id: '04-graph', label: 'Knowledge graph explorer', route: '/beacon/', waitFor: 'main' },
      { id: '05-dashboard', label: 'Governance dashboard', route: '/beacon/', waitFor: 'main' },
      { id: '06-search', label: 'Search results', route: '/beacon/', waitFor: 'main' },
    ],
    bearing: [
      { id: '01-dashboard', label: 'Goal dashboard', route: '/bearing/', waitFor: 'main' },
      { id: '02-goal-detail', label: 'Goal detail', route: '/bearing/', waitFor: 'main' },
      { id: '03-timeline', label: 'Timeline view', route: '/bearing/timeline', waitFor: 'main' },
      { id: '04-reports', label: 'Progress reports', route: '/bearing/reports', waitFor: 'main' },
    ],
    bench: [
      { id: '01-dashboard-list', label: 'Dashboard list', route: '/bench/', waitFor: 'main' },
      { id: '02-dashboard-view', label: 'Dashboard view', route: '/bench/', waitFor: 'main' },
      { id: '03-explorer', label: 'Ad-hoc explorer', route: '/bench/explorer', waitFor: 'main' },
      { id: '04-reports', label: 'Scheduled reports', route: '/bench/reports', waitFor: 'main' },
      { id: '05-settings', label: 'Settings', route: '/bench/settings', waitFor: 'main' },
      { id: '06-widget-wizard', label: 'Widget wizard', route: '/bench/widgets/new', waitFor: 'main' },
    ],
    bill: [
      { id: '01-invoice-list', label: 'Invoice list', route: '/bill/', waitFor: 'main' },
      { id: '02-invoice-new', label: 'New invoice', route: '/bill/invoices/new', waitFor: 'main' },
      { id: '03-clients', label: 'Clients list', route: '/bill/clients', waitFor: 'main' },
      { id: '04-expenses', label: 'Expenses list', route: '/bill/expenses', waitFor: 'main' },
      { id: '05-rates', label: 'Billing rates', route: '/bill/rates', waitFor: 'main' },
      { id: '06-reports', label: 'Financial reports', route: '/bill/reports', waitFor: 'main' },
      { id: '07-settings', label: 'Billing settings', route: '/bill/settings', waitFor: 'main' },
    ],
    blank: [
      { id: '01-form-list', label: 'Form list', route: '/blank/', waitFor: 'main' },
      { id: '02-form-builder', label: 'Form builder', route: '/blank/', waitFor: 'main' },
      { id: '03-form-preview', label: 'Form preview', route: '/blank/', waitFor: 'main' },
      { id: '04-settings', label: 'Settings', route: '/blank/settings', waitFor: 'main' },
    ],
    blast: [
      { id: '01-campaigns', label: 'Campaign list', route: '/blast/', waitFor: 'main' },
      { id: '02-campaign-new', label: 'New campaign form', route: '/blast/campaigns/new', waitFor: 'main' },
      { id: '03-templates', label: 'Template gallery', route: '/blast/templates', waitFor: 'main' },
      { id: '04-template-editor', label: 'Template editor', route: '/blast/templates/new', waitFor: 'main' },
      { id: '05-segments', label: 'Segment list', route: '/blast/segments', waitFor: 'main' },
      { id: '06-segment-builder', label: 'Segment builder', route: '/blast/segments/new', waitFor: 'main' },
      { id: '07-analytics', label: 'Analytics dashboard', route: '/blast/analytics', waitFor: 'main' },
    ],
    board: [
      { id: '01-list', label: 'Board grid view', route: '/board/', waitFor: 'main' },
      { id: '02-canvas', label: 'Board canvas', route: '/board/', waitFor: 'main' },
      { id: '03-templates', label: 'Board templates', route: '/board/', waitFor: 'main' },
    ],
    bolt: [
      { id: '01-automations', label: 'Automation list', route: '/bolt/', waitFor: 'main' },
      { id: '02-editor', label: 'Automation builder', route: '/bolt/new', waitFor: 'main' },
      { id: '03-detail', label: 'Automation detail', route: '/bolt/', waitFor: 'main' },
      { id: '04-executions', label: 'Execution log', route: '/bolt/executions', waitFor: 'main' },
      { id: '05-templates', label: 'Automation templates', route: '/bolt/templates', waitFor: 'main' },
    ],
    bond: [
      { id: '01-pipeline', label: 'Pipeline board', route: '/bond/', waitFor: 'main' },
      { id: '02-contacts', label: 'Contacts list', route: '/bond/contacts', waitFor: 'main' },
      { id: '03-deal-detail', label: 'Deal detail', route: '/bond/', waitFor: 'main' },
      { id: '04-analytics', label: 'Analytics dashboard', route: '/bond/analytics', waitFor: 'main' },
      { id: '05-companies', label: 'Companies list', route: '/bond/companies', waitFor: 'main' },
    ],
    book: [
      { id: '01-week-view', label: 'Calendar week view', route: '/book/', waitFor: 'main' },
      { id: '02-month-view', label: 'Calendar month view', route: '/book/month', waitFor: 'main' },
      { id: '03-day-view', label: 'Calendar day view', route: '/book/day', waitFor: 'main' },
      { id: '04-timeline', label: 'Aggregated timeline', route: '/book/timeline', waitFor: 'main' },
      { id: '05-booking-pages', label: 'Booking page management', route: '/book/booking-pages', waitFor: 'main' },
      { id: '06-working-hours', label: 'Working hours settings', route: '/book/settings/working-hours', waitFor: 'main' },
    ],
    brief: [
      { id: '01-home', label: 'Brief home', route: '/brief/', waitFor: 'main' },
      { id: '02-documents', label: 'Document list', route: '/brief/', waitFor: 'main' },
      { id: '03-detail', label: 'Document detail', route: '/brief/', waitFor: 'main' },
      { id: '04-editor', label: 'Document editor', route: '/brief/new', waitFor: 'main' },
      { id: '05-templates', label: 'Template browser', route: '/brief/templates', waitFor: 'main' },
      { id: '06-starred', label: 'Starred documents', route: '/brief/starred', waitFor: 'main' },
    ],
    helpdesk: [
      { id: '01-portal', label: 'Support portal', route: '/helpdesk/', waitFor: 'main' },
      { id: '02-ticket-list', label: 'Ticket list', route: '/helpdesk/tickets', waitFor: 'main' },
      { id: '03-new-ticket', label: 'New ticket form', route: '/helpdesk/tickets/new', waitFor: 'main' },
      { id: '04-ticket-detail', label: 'Ticket detail', route: '/helpdesk/tickets', waitFor: 'main' },
      { id: '05-knowledge-base', label: 'Knowledge base', route: '/helpdesk/kb', waitFor: 'main' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Validate requested apps
// ---------------------------------------------------------------------------

const allApps = Object.keys(APP_SCENES).sort();
const targetApps = requestedApps
  ? requestedApps.filter((a) => {
      if (!APP_SCENES[a]) {
        console.error(`[warn] Unknown app "${a}", skipping. Valid: ${allApps.join(', ')}`);
        return false;
      }
      return true;
    })
  : allApps;

if (targetApps.length === 0) {
  console.error('[error] No valid apps to capture.');
  process.exit(1);
}

console.log(`\n=== Documentation Screenshot Capture ===`);
console.log(`Apps: ${targetApps.join(', ')} (${targetApps.length} of ${allApps.length})`);
console.log();

// ---------------------------------------------------------------------------
// Helpers (simplified version of the package helpers for standalone use)
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import fs from 'node:fs';

const BASE_URL = process.env.DOCS_CAPTURE_BASE_URL || 'http://localhost';
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_DELAY = 1500;
const OUTPUT_ROOT = path.resolve(ROOT, 'docs', 'apps');

async function login(page) {
  const email = process.env.DOCS_CAPTURE_USER || 'admin@example.com';
  const password = process.env.DOCS_CAPTURE_PASSWORD || 'BigBlueBam-2026-dev-pw';

  await page.goto(`${BASE_URL}/b3/login`, { waitUntil: 'networkidle', timeout: 20_000 });

  // Check if already logged in (redirected away from login)
  if (!page.url().includes('/login')) return;

  const emailInput = page.locator('input[name=email]');
  if ((await emailInput.count()) === 0) return;

  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);

  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/b3/api/auth/login') && r.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.click('button[type=submit]');
  await loginResponse;
  await page.waitForFunction(() => !window.location.pathname.endsWith('/login'), undefined, {
    timeout: 10_000,
  });
  await page.waitForTimeout(SETTLE_DELAY);
}

async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('bbam-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(SETTLE_DELAY);
  // Re-apply after reload
  await page.evaluate((t) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);
}

async function captureScene(page, scene, theme, app) {
  const outDir = path.join(OUTPUT_ROOT, app, 'screenshots', theme);
  const outFile = path.join(outDir, `${scene.id}.png`);
  fs.mkdirSync(outDir, { recursive: true });

  // Navigate
  await page.goto(`${BASE_URL}${scene.route}`, {
    waitUntil: 'networkidle',
    timeout: 20_000,
  });
  await page.waitForTimeout(SETTLE_DELAY);

  // Re-apply theme class after navigation
  await page.evaluate((t) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);

  // Run custom setup
  if (scene.setup) {
    await scene.setup(page);
  }

  // Wait for selector
  if (scene.waitFor) {
    await page
      .locator(scene.waitFor)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});
  }

  await page.waitForTimeout(500);

  // Capture
  const shouldCapture = scene.screenshot_after !== false;
  if (!shouldCapture) return null;

  const buffer = await page.screenshot({ path: outFile, type: 'png' });
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return {
    id: scene.id,
    label: scene.label,
    theme,
    file: path.relative(ROOT, outFile),
    sha256,
    width,
    height,
    captured_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const themes = ['light', 'dark'];
const summary = { apps: 0, succeeded: 0, failed: 0, pngs: 0 };
let hasFailure = false;

const browser = await chromium.launch({ headless: true });

try {
  for (const app of targetApps) {
    const scenes = APP_SCENES[app];
    if (!scenes || scenes.length === 0) continue;

    console.log(`--- ${app} (${scenes.length} scenes) ---`);
    summary.apps++;
    const allMeta = [];
    let appFailed = false;

    for (const theme of themes) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);

      try {
        await login(page);
        await applyTheme(page, theme);

        for (const scene of scenes) {
          try {
            const meta = await captureScene(page, scene, theme, app);
            if (meta) {
              allMeta.push(meta);
              summary.pngs++;
              summary.succeeded++;
              console.log(`  [OK]   ${theme}/${scene.id}.png  ${scene.label}`);
            } else {
              summary.succeeded++;
              console.log(`  [OK]   ${theme}/${scene.id}  (no capture)`);
            }
          } catch (err) {
            summary.failed++;
            appFailed = true;
            console.error(`  [FAIL] ${theme}/${scene.id}  ${err.message}`);
          }
        }
      } finally {
        await context.close();
      }
    }

    // Write meta.json
    const metaPath = path.join(OUTPUT_ROOT, app, 'meta.json');
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(allMeta, null, 2) + '\n');

    if (appFailed) hasFailure = true;
  }
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Capture Summary ===');
console.log(`Apps captured:    ${summary.apps}`);
console.log(`Scenes succeeded: ${summary.succeeded}`);
console.log(`Scenes failed:    ${summary.failed}`);
console.log(`Total PNGs:       ${summary.pngs}`);
console.log();

if (hasFailure) {
  console.error('Some scenes failed. Exit code 1.');
  process.exit(1);
}

console.log('All scenes captured successfully.');
