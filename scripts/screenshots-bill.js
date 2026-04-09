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

  // ===== LOGIN via Bam (Bill shares the session cookie) =====
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

  // ===== BILL: Invoice list =====
  await safe('bill invoice list', async () => {
    await page.goto('http://localhost/bill/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'bill-invoice-list.png', 'Bill invoice list');
  });

  // ===== BILL: New invoice =====
  await safe('bill new invoice', async () => {
    await page.goto('http://localhost/bill/invoices/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bill-invoice-new.png', 'Bill new invoice');
  });

  // ===== BILL: Clients =====
  await safe('bill clients', async () => {
    await page.goto('http://localhost/bill/clients', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bill-clients.png', 'Bill clients list');
  });

  // ===== BILL: Expenses =====
  await safe('bill expenses', async () => {
    await page.goto('http://localhost/bill/expenses', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bill-expenses.png', 'Bill expenses list');
  });

  // ===== BILL: Rates =====
  await safe('bill rates', async () => {
    await page.goto('http://localhost/bill/rates', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bill-rates.png', 'Bill billing rates');
  });

  // ===== BILL: Reports =====
  await safe('bill reports', async () => {
    await page.goto('http://localhost/bill/reports', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'bill-reports.png', 'Bill financial reports');
  });

  // ===== BILL: Settings =====
  await safe('bill settings', async () => {
    await page.goto('http://localhost/bill/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await snap(page, 'bill-settings.png', 'Bill billing settings');
  });

  // ===== Done =====
  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log(`Captured: ${captured.length}`);
  captured.forEach((f) => console.log('  ' + f));
  if (skipped.length) {
    console.log(`Skipped: ${skipped.length}`);
    skipped.forEach((s) => console.log('  ' + s.filename + ' — ' + s.reason));
  }

  // Copy to site dir
  for (const f of captured) {
    const src = path.join(IMAGES_DIR, f);
    const dst = path.join(SITE_DIR, f);
    fs.copyFileSync(src, dst);
  }
})();
