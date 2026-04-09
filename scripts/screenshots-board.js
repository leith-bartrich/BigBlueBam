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

  // Set dark mode
  await safe('dark mode', async () => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
  });

  const ORG = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  await page.route('**/board/api/**', async (route) => {
    const headers = { ...route.request().headers(), 'x-org-id': ORG };
    await route.continue({ headers });
  });

  // 1. Board list (grid view)
  await safe('board list', async () => {
    await page.goto('http://localhost/board/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    await snap(page, 'board-list.png', 'Board grid view');
  });

  // 2. Board canvas (open first board)
  await safe('board canvas', async () => {
    await page.goto('http://localhost/board/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const card = page.locator('a[href*="/board/"], button:has(h3), [data-testid="board-card"]').first();
    if (await card.count() > 0) {
      await card.click();
      await page.waitForTimeout(3000);
      await snap(page, 'board-canvas.png', 'Board canvas (full-screen)');
    } else {
      // Fallback: try navigating directly
      await page.goto('http://localhost/board/', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      await snap(page, 'board-canvas.png', 'Board canvas fallback');
    }
  });

  // 3. Board templates
  await safe('board templates', async () => {
    // Try the new board button or templates route
    const newBtn = page.locator('button:has-text("New Board"), button:has-text("New"), a:has-text("New Board")').first();
    if (await newBtn.count() > 0) {
      await page.goto('http://localhost/board/', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      await newBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, 'board-templates.png', 'Board templates dialog');
    } else {
      await page.goto('http://localhost/board/new', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2500);
      await snap(page, 'board-templates.png', 'Board templates page');
    }
  });

  // Mirror PNGs to site directory
  console.log('\nMirroring Board PNGs...');
  for (const f of captured) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  console.log('\n=================== BOARD SCREENSHOTS SUMMARY ===================');
  console.log('Captured: ' + captured.length);
  captured.forEach((f) => console.log('  OK  ' + f));
  if (skipped.length > 0) {
    console.log('\nSkipped: ' + skipped.length);
    skipped.forEach((s) => console.log('  SKIP  ' + s.filename + ' — ' + s.reason));
  }
  console.log('=================================================================\n');

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
