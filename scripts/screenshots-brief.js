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

  // ===== LOGIN via Bam (Brief shares the session cookie) =====
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

  // Intercept brief-api requests to inject X-Org-Id header
  const MAGE_ORG_ID = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  await page.route('**/brief/api/**', async (route) => {
    const headers = { ...route.request().headers(), 'x-org-id': MAGE_ORG_ID };
    await route.continue({ headers });
  });

  // ===== 1. HOME =====
  await safe('brief home', async () => {
    await page.goto('http://localhost/brief/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    await snap(page, 'brief-home.png', 'Brief Home');
  });

  // ===== 2. DOCUMENT LIST =====
  await safe('brief documents', async () => {
    const btn = page.locator('aside button:has-text("Documents")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(3000);
    } else {
      await page.goto('http://localhost/brief/documents', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'brief-documents.png', 'Document list');
  });

  // ===== 3. DOCUMENT DETAIL (click first card) =====
  await safe('brief detail', async () => {
    for (const sel of [
      'button.w-full.text-left',
      'button:has(h3)',
      'main button[class*="rounded-xl"]',
    ]) {
      const card = page.locator(sel).first();
      if (await card.count() > 0) {
        console.log('[NAV] Clicking card via: ' + sel);
        await card.click();
        await page.waitForTimeout(3000);
        await snap(page, 'brief-detail.png', 'Document detail');
        return;
      }
    }
    skipped.push({ filename: 'brief-detail.png', reason: 'no document card found' });
    console.error('[SKIP] brief-detail.png — no card found');
  });

  // ===== 4. EDITOR (new document) =====
  await safe('brief editor', async () => {
    // Navigate to home first, then click create
    const homeBtn = page.locator('aside button:has-text("Home")').first();
    if (await homeBtn.count() > 0) {
      await homeBtn.click();
      await page.waitForTimeout(1500);
    }
    const createCard = page.locator('button:has-text("New Document")').first();
    if (await createCard.count() > 0) {
      await createCard.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto('http://localhost/brief/new', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'brief-editor.png', 'Document editor');
  });

  // ===== 5. TEMPLATES =====
  await safe('brief templates', async () => {
    const btn = page.locator('aside button:has-text("Templates")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto('http://localhost/brief/templates', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'brief-templates.png', 'Template browser');
  });

  // ===== 6. SEARCH =====
  await safe('brief search', async () => {
    const btn = page.locator('aside button:has-text("Search")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2000);
      const input = page.locator('input[placeholder*="earch"], input[placeholder*="query"]').first();
      if (await input.count() > 0) {
        await input.fill('deployment');
        await input.press('Enter');
        await page.waitForTimeout(3000);
      }
    }
    await snap(page, 'brief-search.png', 'Search results');
  });

  // ===== 7. STARRED =====
  await safe('brief starred', async () => {
    const btn = page.locator('aside button:has-text("Starred")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto('http://localhost/brief/starred', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }
    await snap(page, 'brief-starred.png', 'Starred documents');
  });

  // ===== MIRROR =====
  console.log('\nMirroring Brief PNGs to site/public/screenshots/ ...');
  for (const f of captured) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  // ===== SUMMARY =====
  console.log('\n=================== BRIEF SCREENSHOTS SUMMARY ===================');
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
  console.error(e.stack);
  process.exit(1);
});
