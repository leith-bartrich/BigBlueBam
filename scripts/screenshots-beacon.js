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

  // ===== LOGIN via Bam (Beacon shares the session cookie) =====
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

  // Switch to Mage Inc org
  await safe('switch to Mage Inc', async () => {
    const sw = page.locator('button[title="Switch organization"]').first();
    if (await sw.count() > 0) {
      await sw.click();
      await page.waitForTimeout(400);
      const mageItem = page
        .locator('[role=menuitem]:has-text("Mage Inc"), button:has-text("Mage Inc")')
        .first();
      if (await mageItem.count() > 0) {
        await mageItem.click();
        await page.waitForTimeout(2500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  // Intercept beacon-api requests to inject X-Org-Id header
  const MAGE_ORG_ID = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  await page.route('**/beacon/api/**', async (route) => {
    const headers = { ...route.request().headers(), 'x-org-id': MAGE_ORG_ID };
    await route.continue({ headers });
  });

  // ===== SELECT PROJECT =====
  await safe('select project', async () => {
    await page.goto('http://localhost/beacon/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    const projDropdown = page.locator('button:has-text("All Projects")').first();
    if (await projDropdown.count() > 0) {
      await projDropdown.click();
      await page.waitForTimeout(800);
      const projItem = page.locator('button:has-text("Mage")').first();
      if (await projItem.count() > 0) {
        await projItem.click();
        await page.waitForTimeout(2000);
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  // ===== 1. HOME =====
  await safe('beacon home', async () => {
    // Already on home after project select, just wait
    await page.waitForTimeout(1500);
    await snap(page, 'beacon-home.png', 'Knowledge Home');
  });

  // ===== 2. LIST =====
  await safe('beacon list', async () => {
    const btn = page.locator('aside button:has-text("Browse")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(3000);
    }
    await snap(page, 'beacon-list.png', 'Beacon list/browse');
  });

  // ===== 3. DETAIL (click first card from list) =====
  await safe('beacon detail', async () => {
    // We should be on the list page with cards rendered
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
        await snap(page, 'beacon-detail.png', 'Beacon detail');
        return;
      }
    }
    skipped.push({ filename: 'beacon-detail.png', reason: 'no beacon card found' });
    console.error('[SKIP] beacon-detail.png — no card found');
  });

  // ===== 4. GRAPH =====
  await safe('beacon graph', async () => {
    const btn = page.locator('aside button:has-text("Graph")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(3500);
    }
    await snap(page, 'beacon-graph.png', 'Knowledge Graph explorer');
  });

  // ===== 5. EDITOR =====
  await safe('beacon editor', async () => {
    // Go to Home first, then click Create a Beacon
    const homeBtn = page.locator('aside button:has-text("Home")').first();
    if (await homeBtn.count() > 0) {
      await homeBtn.click();
      await page.waitForTimeout(1500);
    }
    const createCard = page.locator('button:has-text("Create a Beacon")').first();
    if (await createCard.count() > 0) {
      await createCard.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'beacon-editor.png', 'Create/edit beacon');
  });

  // ===== 6. DASHBOARD =====
  await safe('beacon dashboard', async () => {
    const btn = page.locator('aside button:has-text("Dashboard")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2500);
    }
    await snap(page, 'beacon-dashboard.png', 'Governance dashboard');
  });

  // ===== 7. SEARCH (last — may crash the SPA) =====
  await safe('beacon search', async () => {
    const btn = page.locator('aside button:has-text("Search")').first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2000);
      // Type in search box
      const input = page.locator('input[placeholder*="earch"], input[placeholder*="query"]').first();
      if (await input.count() > 0) {
        await input.fill('deployment');
        await input.press('Enter');
        await page.waitForTimeout(3000);
      }
    }
    await snap(page, 'beacon-search.png', 'Beacon search results');
  });

  // ===== MIRROR =====
  console.log('\nMirroring Beacon PNGs to site/public/screenshots/ ...');
  for (const f of captured) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  // ===== SUMMARY =====
  console.log('\n=================== BEACON SCREENSHOTS SUMMARY ===================');
  console.log('Captured: ' + captured.length);
  captured.forEach((f) => console.log('  OK  ' + f));
  if (skipped.length > 0) {
    console.log('\nSkipped: ' + skipped.length);
    skipped.forEach((s) => console.log('  SKIP  ' + s.filename + ' — ' + s.reason));
  }
  console.log('==================================================================\n');

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
