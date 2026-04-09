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

  // ===== LOGIN via Bam (Blank shares the session cookie) =====
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

  // ===== BLANK: Form list =====
  await safe('blank form list', async () => {
    await page.goto('http://localhost/blank/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'blank-form-list.png', 'Blank form list');
  });

  // ===== BLANK: Form builder =====
  await safe('blank form builder', async () => {
    const card = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(2000);
      await snap(page, 'blank-form-builder.png', 'Blank form builder');
    }
  });

  // ===== BLANK: Form preview =====
  await safe('blank form preview', async () => {
    const previewBtn = page.locator('button:has-text("Preview")').first();
    if (await previewBtn.count()) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
      await snap(page, 'blank-form-preview.png', 'Blank form preview');
    }
  });

  // ===== BLANK: Responses =====
  await safe('blank responses', async () => {
    await page.goBack();
    await page.waitForTimeout(1000);
    // Navigate via URL pattern
    const url = page.url();
    const formIdMatch = url.match(/forms\/([^/]+)/);
    if (formIdMatch) {
      await page.goto(`http://localhost/blank/forms/${formIdMatch[1]}/responses`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      await snap(page, 'blank-form-responses.png', 'Blank form responses');
    }
  });

  // ===== BLANK: Analytics =====
  await safe('blank analytics', async () => {
    const url = page.url();
    const formIdMatch = url.match(/forms\/([^/]+)/);
    if (formIdMatch) {
      await page.goto(`http://localhost/blank/forms/${formIdMatch[1]}/analytics`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      await snap(page, 'blank-form-analytics.png', 'Blank form analytics');
    }
  });

  // ===== BLANK: Settings =====
  await safe('blank settings', async () => {
    await page.goto('http://localhost/blank/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'blank-settings.png', 'Blank settings');
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
