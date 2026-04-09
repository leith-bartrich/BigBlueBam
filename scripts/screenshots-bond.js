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

  // ===== LOGIN via Bam (Bond shares the session cookie) =====
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

  // Set dark mode
  await safe('dark mode', async () => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
  });

  const ORG = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  await page.route('**/bond/api/**', async (route) => {
    const headers = { ...route.request().headers(), 'x-org-id': ORG };
    await route.continue({ headers });
  });

  // 1. Pipeline / deal board (Kanban view)
  await safe('bond pipeline', async () => {
    await page.goto('http://localhost/bond/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    // Re-apply dark mode after navigation
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await snap(page, 'bond-pipeline.png', 'Deal board / pipeline (dark)');
  });

  // 2. Contacts list
  await safe('bond contacts', async () => {
    await page.goto('http://localhost/bond/contacts', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await snap(page, 'bond-contacts.png', 'Contact list (dark)');
  });

  // 3. Deal detail — click first deal card or navigate to a deal
  await safe('bond deal detail', async () => {
    await page.goto('http://localhost/bond/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    // Try clicking the first deal card
    const dealCard = page.locator(
      'button.w-full.text-left:has(span), [data-deal-id], main a[href*="/bond/deals/"], [role="button"]:has(h3)',
    ).first();
    if (await dealCard.count() > 0) {
      await dealCard.click();
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(500);
      await snap(page, 'bond-deal-detail.png', 'Deal detail (dark)');
    } else {
      // Fallback: navigate to deals list and click first row
      await page.goto('http://localhost/bond/deals', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      const row = page.locator('table tbody tr, main a[href*="deals/"]').first();
      if (await row.count() > 0) {
        await row.click();
        await page.waitForTimeout(2500);
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
        });
        await page.waitForTimeout(500);
      }
      await snap(page, 'bond-deal-detail.png', 'Deal detail (dark)');
    }
  });

  // 4. Analytics / dashboard
  await safe('bond analytics', async () => {
    // Try sidebar nav first
    const analyticsLink = page.locator(
      'aside a:has-text("Analytics"), aside button:has-text("Analytics"), aside a:has-text("Dashboard"), nav a:has-text("Analytics")',
    ).first();
    if (await analyticsLink.count() > 0) {
      await analyticsLink.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto('http://localhost/bond/analytics', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2500);
    }
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await snap(page, 'bond-analytics.png', 'Analytics / dashboard (dark)');
  });

  // Mirror PNGs to site directory
  console.log('\nMirroring Bond PNGs...');
  for (const f of captured) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  console.log('\n=================== BOND SCREENSHOTS SUMMARY ===================');
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
