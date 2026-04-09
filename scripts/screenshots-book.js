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

  // ===== LOGIN via Bam (Book shares the session cookie) =====
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

  // Navigate to Book and set org header
  await page.goto('http://localhost/book/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Dark mode again for Book SPA
  await safe('dark mode book', async () => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bbam-theme', 'dark');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  });

  // 1. Week View
  await safe('week view', async () => {
    await snap(page, 'book-week-view.png', 'Calendar Week View');
  });

  // 2. Month View
  await safe('month view', async () => {
    await page.goto('http://localhost/book/month', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-month-view.png', 'Calendar Month View');
  });

  // 3. Day View
  await safe('day view', async () => {
    await page.goto('http://localhost/book/day', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-day-view.png', 'Calendar Day View');
  });

  // 4. Timeline
  await safe('timeline', async () => {
    await page.goto('http://localhost/book/timeline', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-timeline.png', 'Aggregated Timeline');
  });

  // 5. Booking Pages
  await safe('booking pages', async () => {
    await page.goto('http://localhost/book/booking-pages', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-booking-pages.png', 'Booking Page Management');
  });

  // 6. Working Hours
  await safe('working hours', async () => {
    await page.goto('http://localhost/book/settings/working-hours', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-working-hours.png', 'Working Hours Settings');
  });

  // 7. Connections
  await safe('connections', async () => {
    await page.goto('http://localhost/book/settings/connections', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'book-connections.png', 'External Calendar Connections');
  });

  // 8. Launchpad
  await safe('launchpad', async () => {
    await page.goto('http://localhost/book/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    const launchpadBtn = page.locator('button:has-text("Launchpad")').first();
    if (await launchpadBtn.isVisible()) {
      await launchpadBtn.click();
      await page.waitForTimeout(800);
      await snap(page, 'book-launchpad.png', 'Launchpad with Book');
    }
  });

  // ===== Summary =====
  console.log('\n=== Book Screenshot Summary ===');
  console.log(`Captured: ${captured.length}`);
  captured.forEach((f) => console.log('  ' + f));
  if (skipped.length) {
    console.log(`Skipped: ${skipped.length}`);
    skipped.forEach((s) => console.log('  ' + s.filename + ': ' + s.reason));
  }

  // Copy to site directory
  for (const file of captured) {
    const src = path.join(IMAGES_DIR, file);
    const dest = path.join(SITE_DIR, file);
    fs.copyFileSync(src, dest);
  }

  await browser.close();
})();
