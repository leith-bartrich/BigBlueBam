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

  // ===== LOGIN via Bam (Blast shares the session cookie) =====
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

  // ===== 1. Campaign List =====
  await safe('campaigns', async () => {
    await page.goto('http://localhost/blast/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(page, 'blast-campaigns.png', 'Campaign list');
  });

  // ===== 2. New Campaign =====
  await safe('new campaign', async () => {
    await page.goto('http://localhost/blast/campaigns/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-campaign-new.png', 'New campaign form');
  });

  // ===== 3. Templates Gallery =====
  await safe('templates', async () => {
    await page.goto('http://localhost/blast/templates', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-templates.png', 'Template gallery');
  });

  // ===== 4. Template Editor =====
  await safe('template editor', async () => {
    await page.goto('http://localhost/blast/templates/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-template-editor.png', 'Template editor');
  });

  // ===== 5. Segments =====
  await safe('segments', async () => {
    await page.goto('http://localhost/blast/segments', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-segments.png', 'Segment list');
  });

  // ===== 6. Segment Builder =====
  await safe('segment builder', async () => {
    await page.goto('http://localhost/blast/segments/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-segment-builder.png', 'Segment builder');
  });

  // ===== 7. Analytics Dashboard =====
  await safe('analytics', async () => {
    await page.goto('http://localhost/blast/analytics', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-analytics.png', 'Analytics dashboard');
  });

  // ===== 8. Domain Settings =====
  await safe('domains', async () => {
    await page.goto('http://localhost/blast/settings/domains', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-domains.png', 'Sender domains');
  });

  // ===== 9. SMTP Settings =====
  await safe('smtp', async () => {
    await page.goto('http://localhost/blast/settings/smtp', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'blast-smtp.png', 'SMTP settings');
  });

  // ===== Copy to site/public/screenshots =====
  for (const file of captured) {
    const src = path.join(IMAGES_DIR, file);
    const dst = path.join(SITE_DIR, file);
    fs.copyFileSync(src, dst);
  }

  console.log('\n=== Blast Screenshot Summary ===');
  console.log('Captured:', captured.length);
  console.log('Skipped:', skipped.length);
  for (const s of skipped) console.log('  -', s.filename, ':', s.reason);

  await browser.close();
})();
