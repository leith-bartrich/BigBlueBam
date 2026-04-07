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

  // Login
  await page.goto('http://localhost/b3/', { waitUntil: 'networkidle', timeout: 20000 });
  if (await page.locator('input[name=email]').count() > 0) {
    console.log('[AUTH] Logging in...');
    await page.fill('input[name=email]', 'eddie@bigblueceiling.com');
    await page.fill('input[name=password]', 'BigBlue2026!');
    await page.click('button[type=submit]');
    await page.waitForTimeout(2500);
  }

  const ORG = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  await page.route('**/bolt/api/**', async (route) => {
    const headers = { ...route.request().headers(), 'x-org-id': ORG };
    await route.continue({ headers });
  });

  // 1. Automation list (home)
  await safe('bolt home', async () => {
    await page.goto('http://localhost/bolt/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    await snap(page, 'bolt-automations.png', 'Automation list');
  });

  // 2. Automation editor (new)
  await safe('bolt editor', async () => {
    await page.goto('http://localhost/bolt/new', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await snap(page, 'bolt-editor.png', 'Automation builder');
  });

  // 3. Click first automation to view detail
  await safe('bolt detail', async () => {
    await page.goto('http://localhost/bolt/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const card = page.locator('button.w-full.text-left, button:has(h3), main a[href*="automations"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(2500);
      await snap(page, 'bolt-detail.png', 'Automation detail');
    }
  });

  // 4. Execution log
  await safe('bolt executions', async () => {
    const btn = page.locator('aside button:has-text("Executions"), aside a:has-text("Executions")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto('http://localhost/bolt/executions', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'bolt-executions.png', 'Execution log');
  });

  // 5. Templates
  await safe('bolt templates', async () => {
    const btn = page.locator('aside button:has-text("Templates"), aside a:has-text("Templates")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto('http://localhost/bolt/templates', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'bolt-templates.png', 'Automation templates');
  });

  // Mirror
  console.log('\nMirroring Bolt PNGs...');
  for (const f of captured) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  console.log('\n=================== BOLT SCREENSHOTS SUMMARY ===================');
  console.log('Captured: ' + captured.length);
  captured.forEach((f) => console.log('  OK  ' + f));
  if (skipped.length > 0) {
    console.log('\nSkipped: ' + skipped.length);
    skipped.forEach((s) => console.log('  SKIP  ' + s.filename + ' — ' + s.reason));
  }
  console.log('================================================================\n');

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
