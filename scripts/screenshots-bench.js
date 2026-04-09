const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.resolve(__dirname, '..', 'images');
const SITE_DIR = path.resolve(__dirname, '..', 'site', 'public', 'screenshots');

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(SITE_DIR, { recursive: true });

const captured = [];
const skipped = [];

async function snap(page, filename, label) {
  try {
    const full = path.join(IMAGES_DIR, filename);
    await page.screenshot({ path: full });
    captured.push(filename);
    console.log('[OK]  ' + filename + '  ' + (label || ''));
  } catch (e) {
    skipped.push({ filename, reason: e.message });
    console.error('[SKIP] ' + filename + ' — ' + e.message);
  }
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.error('[WARN] step failed: ' + label + ' — ' + e.message);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);

  // ===== LOGIN via Bam (Bench shares the session cookie) =====
  await page.goto('http://localhost/b3/', { waitUntil: 'networkidle', timeout: 20000 });
  if (page.url().includes('/login') || (await page.locator('input[name=email]').count()) > 0) {
    console.log('[AUTH] Logging in via Bam...');
    await page.fill('input[name=email]', 'eddie@bigblueceiling.com');
    await page.fill('input[name=password]', 'BigBlue2026!');
    await page.click('button[type=submit]');
    await page.waitForTimeout(2500);
    console.log('[AUTH] Logged in, URL:', page.url());
  } else {
    console.log('[AUTH] Already logged in');
  }

  // ===== BENCH: Dashboard list =====
  await safe('bench dashboard list', async () => {
    await page.goto('http://localhost/bench/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'bench-dashboard-list.png', 'Bench dashboard list');
  });

  // ===== BENCH: Engineering Overview dashboard =====
  await safe('bench engineering dashboard', async () => {
    // Click on the first dashboard card
    const card = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(2000);
      await snap(page, 'bench-dashboard-view.png', 'Bench dashboard view');
    }
  });

  // ===== BENCH: Edit mode =====
  await safe('bench edit mode', async () => {
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.count()) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, 'bench-dashboard-edit.png', 'Bench dashboard edit');
    }
  });

  // ===== BENCH: Explorer =====
  await safe('bench explorer', async () => {
    await page.goto('http://localhost/bench/explorer', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bench-explorer.png', 'Bench ad-hoc explorer');
  });

  // ===== BENCH: Reports =====
  await safe('bench reports', async () => {
    await page.goto('http://localhost/bench/reports', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bench-reports.png', 'Bench scheduled reports');
  });

  // ===== BENCH: Settings =====
  await safe('bench settings', async () => {
    await page.goto('http://localhost/bench/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bench-settings.png', 'Bench settings');
  });

  // ===== BENCH: Widget wizard =====
  await safe('bench widget wizard', async () => {
    await page.goto('http://localhost/bench/widgets/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bench-widget-wizard.png', 'Bench widget wizard');
  });

  await browser.close();

  // Copy to site dir
  for (const f of captured) {
    fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Captured: ${captured.length}`);
  console.log(`Skipped:  ${skipped.length}`);
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  [SKIP] ${s.filename}: ${s.reason}`);
  }
})();
