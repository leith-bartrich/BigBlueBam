const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.resolve(__dirname, '..', 'images');
const SITE_DIR = path.resolve(__dirname, '..', 'site', 'public', 'screenshots');

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(SITE_DIR, { recursive: true });

const captured = [];
const skipped = [];
const reverts = [];

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
  page.setDefaultTimeout(8000);

  // ===== LOGIN =====
  await page.goto('http://localhost/b3/', { waitUntil: 'networkidle', timeout: 20000 });
  // If we landed on login, capture it; else skip (session may persist)
  if (page.url().includes('/login') || await page.locator('input[name=email]').count() > 0) {
    await snap(page, '01-login.png', 'Login');
    await page.fill('input[name=email]', 'eddie@bigblueceiling.com');
    await page.fill('input[name=password]', 'BigBlue2026!');
    await page.click('button[type=submit]');
    await page.waitForTimeout(2500);
  }

  // ===== DARK MODE =====
  await safe('enable dark mode', async () => {
    await page.locator('aside button:has-text("Settings")').click();
    await page.waitForTimeout(800);
    const appearanceBtn = page.locator('button:has-text("Appearance")').first();
    if (await appearanceBtn.count() > 0) {
      await appearanceBtn.click();
      await page.waitForTimeout(300);
    }
    const darkBtn = page.locator('button:has-text("Dark")').first();
    if (await darkBtn.count() > 0) {
      await darkBtn.click();
      await page.waitForTimeout(500);
    }
  });

  // ===== EXISTING SCREENS (regenerated) =====

  // Dashboard
  await safe('dashboard', async () => {
    await page.locator('aside button:has-text("Dashboard")').click();
    await page.waitForTimeout(1500);
    await snap(page, '02-dashboard.png', 'Dashboard (dark)');
  });

  // Board - switch to Mage Inc org first (BigBlueBam project has no tasks),
  // then open the Mage project.
  await safe('board', async () => {
    // Use org switcher to pick Mage Inc
    const sw = page.locator('button[title="Switch organization"]').first();
    if (await sw.count() > 0) {
      await sw.click();
      await page.waitForTimeout(400);
      const mageItem = page.locator('[role=menuitem]:has-text("Mage Inc"), button:has-text("Mage Inc")').first();
      if (await mageItem.count() > 0) {
        await mageItem.click();
        await page.waitForTimeout(2500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    // Now click the Mage project in the sidebar
    const asideButtons = page.locator('aside button');
    const count = await asideButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = asideButtons.nth(i);
      const txt = (await btn.textContent()) || '';
      if (/^[A-Z]?\s*Mage/.test(txt) && !/Mage Inc/.test(txt)) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(3500);
    await snap(page, '03-board.png', 'Board (dark)');
  });

  // Task detail
  await safe('task detail', async () => {
    const card = page.locator('.cursor-grab').first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    await card.click();
    await page.waitForTimeout(1500);
    await snap(page, '04-task-detail.png', 'Task detail (dark)');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  // Swimlanes
  await safe('swimlanes', async () => {
    const combos = await page.locator('button[role=combobox]').all();
    for (const s of combos) {
      const t = await s.textContent();
      if (t && (t.includes('Swim') || t.includes('No Swim'))) {
        await s.click();
        await page.waitForTimeout(300);
        await page.locator('[role=option]:has-text("Assignee")').click();
        await page.waitForTimeout(1500);
        break;
      }
    }
    await snap(page, '05-swimlanes.png', 'Swimlanes (dark)');
    // Reset
    for (const s of await page.locator('button[role=combobox]').all()) {
      const t = await s.textContent();
      if (t && t.includes('Assignee')) {
        await s.click();
        await page.waitForTimeout(200);
        await page.locator('[role=option]').first().click();
        await page.waitForTimeout(500);
        break;
      }
    }
  });

  // List view
  await safe('list view', async () => {
    await page.locator('button[aria-label="List view"]').click();
    await page.waitForTimeout(1200);
    await snap(page, '06-list-view.png', 'List view (dark)');
  });

  // Timeline
  await safe('timeline', async () => {
    await page.locator('button[aria-label="Timeline view"]').click();
    await page.waitForTimeout(1200);
    await snap(page, '07-timeline.png', 'Timeline (dark)');
  });

  // Calendar
  await safe('calendar', async () => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(1200);
    await snap(page, '08-calendar.png', 'Calendar (dark)');
  });

  // Project Dashboard
  await safe('project dashboard', async () => {
    const projectId = page.url().match(/projects\/([^/]+)/)?.[1];
    if (projectId) {
      await page.goto('http://localhost/b3/projects/' + projectId + '/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await snap(page, '09-project-dashboard.png', 'Project dashboard (dark)');
    }
  });

  // My Work
  await safe('my work', async () => {
    await page.locator('aside button:has-text("My Work")').click();
    await page.waitForTimeout(1500);
    await snap(page, '10-my-work.png', 'My Work (dark)');
  });

  // Members — now lives at /b3/people (not Settings > Members anymore).
  // Settings > Members is just a "moved" redirect card — don't capture that.
  await safe('people list (members)', async () => {
    await page.goto('http://localhost/b3/people', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    await snap(page, '11-members.png', 'Members / People list (dark)');
  });

  // Settings Integrations
  await safe('settings integrations', async () => {
    const intBtn = page.locator('button:has-text("Integrations")').first();
    if (await intBtn.count() > 0) {
      await intBtn.click();
      await page.waitForTimeout(1000);
      await snap(page, '12-integrations.png', 'Integrations (dark)');
    }
  });

  // ===== NEW: ORG SWITCHER (A) =====
  await safe('org switcher', async () => {
    await page.goto('http://localhost/b3/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // The header OrgSwitcher button has title="Switch organization"
    const sw = page.locator('button[title="Switch organization"]').first();
    if (await sw.count() > 0) {
      await sw.click();
      await page.waitForTimeout(500);
      await snap(page, 'org-switcher.png', 'Org switcher dropdown');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      skipped.push({ filename: 'org-switcher.png', reason: 'switch-org button not present (single-org user?)' });
      console.error('[SKIP] org-switcher.png — button not found');
    }
  });

  // ===== NEW: PEOPLE LIST (B) =====
  await safe('people list', async () => {
    await page.goto('http://localhost/b3/people', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await snap(page, 'people-list.png', 'People list (dark)');
  });

  // ===== NEW: PEOPLE DETAIL TABS (C-F) =====
  let personUserId = null;
  await safe('enter person detail', async () => {
    // Click the user's name cell (td) directly — the <tr> has onClick that routes,
    // but playwright's tr.click() lands on whichever cell is first (the checkbox).
    // Clicking on a non-checkbox cell inside the row bubbles to the tr handler.
    let row = page.locator('tbody tr').filter({ hasText: 'eoffermann@gmail.com' }).first();
    if (await row.count() === 0) {
      row = page.locator('tbody tr').first();
    }
    // Click on the name/email cell (2nd td, index 1) — the first td is the checkbox.
    const nameCell = row.locator('td').nth(1);
    await nameCell.click();
    await page.waitForTimeout(1500);
    personUserId = page.url().match(/\/people\/([^/?#]+)/)?.[1] || null;
    console.log('[debug] after row click, URL:', page.url());
    await snap(page, 'people-detail-overview.png', 'People detail - Overview');
  });

  // Tabs sit in the detail pane's top border row. Use nth-occurrence with a role=tab fallback.
  // Actual markup: <div class="flex items-center gap-1 border-b ...">  button ... </div>
  const peopleTab = (name) =>
    page.locator(`[class*="border-b"] button:has-text("${name}")`).first();

  await safe('people detail - projects', async () => {
    const tab = peopleTab('Projects');
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1200);
      await snap(page, 'people-detail-projects.png', 'People detail - Projects');
    }
  });

  await safe('people detail - access', async () => {
    const tab = peopleTab('Access');
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1200);
      await snap(page, 'people-detail-access.png', 'People detail - Access');
    }
  });

  await safe('people detail - activity', async () => {
    const tab = peopleTab('Activity');
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1200);
      await snap(page, 'people-detail-activity.png', 'People detail - Activity');
    }
  });

  // ===== NEW: CREATE API KEY DIALOG (G) =====
  await safe('create api key dialog', async () => {
    // Go back to Access tab
    const tab = peopleTab('Access');
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(800);
    }
    const createBtn = page.locator('button:has-text("Create API key")').first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(700);
      await snap(page, 'people-create-api-key-dialog.png', 'Create API key dialog');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  });

  // ===== NEW: RESET PASSWORD DIALOG (H) =====
  await safe('reset password dialog', async () => {
    const resetBtn = page.locator('button:has-text("Reset password")').first();
    if (await resetBtn.count() > 0) {
      await resetBtn.click();
      await page.waitForTimeout(700);
      await snap(page, 'people-reset-password-dialog.png', 'Reset password dialog');
      // Cancel out - look for Cancel button or Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  });

  // ===== NEW: BULK ACTIONS TOOLBAR (I) =====
  await safe('bulk toolbar', async () => {
    await page.goto('http://localhost/b3/people', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Find checkboxes inside tbody, click 2+
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(0).click();
      await page.waitForTimeout(200);
      await checkboxes.nth(1).click();
      await page.waitForTimeout(300);
      if (count >= 3) {
        await checkboxes.nth(2).click();
        await page.waitForTimeout(300);
      }
      await snap(page, 'people-bulk-toolbar.png', 'Bulk actions toolbar');
      // Deselect
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      if (count >= 3) await checkboxes.nth(2).click();
      await page.waitForTimeout(300);
    } else {
      skipped.push({ filename: 'people-bulk-toolbar.png', reason: 'not enough member checkboxes' });
    }
  });

  // ===== NEW: SUPERUSER CONSOLE (J) =====
  await safe('superuser overview', async () => {
    await page.goto('http://localhost/b3/superuser', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await snap(page, 'superuser-overview.png', 'SuperUser console overview');
  });

  // ===== NEW: SUPERUSER PEOPLE LIST (K) =====
  await safe('superuser people list', async () => {
    await page.goto('http://localhost/b3/superuser/people', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await snap(page, 'superuser-people-list.png', 'SuperUser cross-org people list');
  });

  // ===== NEW: SUPERUSER PEOPLE DETAIL TABS (L, M, N) =====
  // We want a user with multiple org memberships — eoffermann@gmail.com is in both orgs
  await safe('superuser people detail - memberships', async () => {
    // Click a row for eoffermann@gmail.com (multi-org user)
    const row = page.locator('tbody tr').filter({ hasText: 'eoffermann@gmail.com' }).first();
    if (await row.count() > 0) {
      await row.click();
    } else {
      // fall back to first row
      await page.locator('tbody tr').first().click();
    }
    await page.waitForTimeout(1500);
    const memTab = page.locator('button:has-text("Memberships")').first();
    if (await memTab.count() > 0) {
      await memTab.click();
      await page.waitForTimeout(1000);
      await snap(page, 'superuser-people-memberships.png', 'SU people detail - Memberships');
    }
  });

  await safe('superuser people detail - sessions', async () => {
    const tab = page.locator('button:has-text("Sessions")').first();
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1000);
      await snap(page, 'superuser-people-sessions.png', 'SU people detail - Sessions');
    }
  });

  await safe('superuser people detail - activity', async () => {
    const tab = page.locator('button:has-text("Activity")').first();
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(1200);
      await snap(page, 'superuser-people-activity.png', 'SU people detail - Activity/Audit');
    }
  });

  // ===== NEW: NO-OWNER BANNER (O) =====
  // To trigger: demote Mage Inc owner (eddie) to admin via DB, login as SU viewing Mage Inc,
  // capture, then revert. We'll use the SuperUser console context switch to enter Mage Inc.
  // Easier: temporarily demote eddie's Mage Inc owner role via docker exec (our script running
  // in node can't shell out safely on Windows). Instead, do it before the screenshot call using
  // child_process.execSync.
  const { execSync } = require('child_process');
  const MAGE_ORG_ID = '57158e52-227d-4903-b0d8-d9f3c4910f61';
  const EDDIE_USER_ID = '65429e63-65c7-4f74-a19e-977217128edc';
  let mutated = false;
  await safe('trigger no-owner + SU-viewing for Mage Inc', async () => {
    try {
      // Delete eddie's Mage Inc membership — this removes the only owner AND
      // makes eddie a non-native member so SU context-switch engages
      // is_superuser_viewing mode.
      execSync(
        `docker compose --project-directory D:/Documents/GitHub/BigBlueBam exec -T postgres psql -U bigbluebam -d bigbluebam -c "DELETE FROM organization_memberships WHERE org_id='${MAGE_ORG_ID}' AND user_id='${EDDIE_USER_ID}';"`,
        { stdio: 'pipe' },
      );
      mutated = true;
      reverts.push('removed eddie from Mage Inc (was owner)');
      console.log('[DB] Removed eddie from Mage Inc');
    } catch (e) {
      console.error('[DB FAIL] remove:', e.message);
    }
  });

  // SuperUser context-switch into Mage Inc, capture no-owner banner + SU banner
  await safe('no-owner banner + SU context banner', async () => {
    await page.goto('http://localhost/b3/superuser', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Click the Organizations sub-tab on the SU console
    const orgTab = page.locator('button:has-text("Organizations")').first();
    if (await orgTab.count() > 0) {
      await orgTab.click();
      await page.waitForTimeout(1500);
    }
    // Find the "Enter" button in the row for Mage Inc
    const mageRow = page.locator('tr').filter({ hasText: 'Mage Inc' }).first();
    const rowCount = await mageRow.count();
    console.log('[debug] Mage row count:', rowCount);
    if (rowCount === 0) {
      skipped.push({ filename: 'superuser-context-banner.png', reason: 'Mage Inc row not found on SU page' });
      skipped.push({ filename: 'no-owner-banner.png', reason: 'Mage Inc row not found on SU page' });
      return;
    }
    const enterBtn = mageRow.locator('button:has-text("Enter")').first();
    const btnCount = await enterBtn.count();
    console.log('[debug] Enter btn count:', btnCount);
    if (btnCount === 0) {
      skipped.push({ filename: 'superuser-context-banner.png', reason: 'Enter button not found' });
      skipped.push({ filename: 'no-owner-banner.png', reason: 'Enter button not found' });
      return;
    }
    await enterBtn.click();
    await page.waitForTimeout(3500);
    console.log('[debug] after enter, URL:', page.url());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await snap(page, 'no-owner-banner.png', 'No-owner banner (O)');
    await snap(page, 'superuser-context-banner.png', 'SU context banner (P)');
  });

  // Revert DB change
  if (mutated) {
    await safe('restore eddie as Mage Inc owner', async () => {
      try {
        execSync(
          `docker compose --project-directory D:/Documents/GitHub/BigBlueBam exec -T postgres psql -U bigbluebam -d bigbluebam -c "INSERT INTO organization_memberships (user_id, org_id, role, is_default) VALUES ('${EDDIE_USER_ID}', '${MAGE_ORG_ID}', 'owner', false) ON CONFLICT (user_id, org_id) DO UPDATE SET role='owner';"`,
          { stdio: 'pipe' },
        );
        console.log('[DB] Re-added eddie as Mage Inc owner');
        reverts.push('restored Mage Inc owner: eddie@bigblueceiling.com');
      } catch (e) {
        console.error('[DB FAIL] restore:', e.message);
      }
    });
  }

  // Also exit SuperUser context so subsequent operations are in eddie's native org
  await safe('exit SU context', async () => {
    // Dismiss context banner or reload session — simplest: hit /auth/me fresh after switching back
    // The SU viewing mode has a dedicated "Exit" control on the banner.
    const exitBtn = page.locator('button:has-text("Exit")').first();
    if (await exitBtn.count() > 0) {
      await exitBtn.click();
      await page.waitForTimeout(1500);
    }
  });

  // ===== NEW: PASSWORD-CHANGE PAGE (Q) =====
  await safe('password change page', async () => {
    // Navigate directly as logged-in user — page is gated on force_password_change.
    // Try navigating anyway; if it redirects we'll still capture whatever is shown.
    await page.goto('http://localhost/b3/password-change', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // Check URL
    if (page.url().includes('password-change')) {
      await snap(page, 'password-change.png', 'Password change page');
    } else {
      skipped.push({ filename: 'password-change.png', reason: 'route redirected (force_password_change not set)' });
      console.error('[SKIP] password-change.png — route redirected');
    }
  });

  // ===== COMMAND PALETTE (existing) =====
  await safe('command palette', async () => {
    await page.goto('http://localhost/b3/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    await snap(page, '14-command-palette.png', 'Command palette');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // ===== LIGHT-MODE VARIANTS =====
  await safe('switch to light mode', async () => {
    await page.locator('aside button:has-text("Settings")').click();
    await page.waitForTimeout(800);
    const appearanceBtn = page.locator('button:has-text("Appearance")').first();
    if (await appearanceBtn.count() > 0) {
      await appearanceBtn.click();
      await page.waitForTimeout(300);
    }
    const lightBtn = page.locator('button:has-text("Light")').first();
    if (await lightBtn.count() > 0) {
      await lightBtn.click();
      await page.waitForTimeout(500);
    }
  });

  // Board (light)
  await safe('board light', async () => {
    const asideButtons = page.locator('aside button');
    const count = await asideButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = asideButtons.nth(i);
      const txt = (await btn.textContent()) || '';
      if (/^[A-Z]?\s*Mage/.test(txt) && !/Mage Inc/.test(txt)) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(2500);
    await snap(page, '13-board-light.png', 'Board (light)');
    await snap(page, 'board-light.png', 'Board (light canonical)');
  });

  // People list (light) (R)
  await safe('people list light', async () => {
    await page.goto('http://localhost/b3/people', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await snap(page, 'people-list-light.png', 'People list (light)');
  });

  // ===== HELPDESK =====
  // Served via nginx at /helpdesk/ on port 80 (not :8080). The old test user
  // jane.doe@example.com was never seeded; we use lisa.taylor@proton.me
  // whose password is reset before this script runs.
  await safe('helpdesk', async () => {
    const hdPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await hdPage.goto('http://localhost/helpdesk/', { waitUntil: 'networkidle', timeout: 15000 });
    await hdPage.waitForTimeout(800);
    await snap(hdPage, '15-helpdesk-login.png', 'Helpdesk login');
    await hdPage.fill('#email', 'lisa.taylor@proton.me');
    await hdPage.fill('#password', 'customerpass123');
    await hdPage.click('button[type=submit]');
    await hdPage.waitForTimeout(2500);
    await snap(hdPage, '16-helpdesk-tickets.png', 'Helpdesk tickets (status badges)');
    // Open the first ticket row — any that renders
    const firstRow = hdPage.locator('tr, [role="row"], li, article').filter({
      hasText: /open|resolved|closed|waiting/i,
    }).first();
    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await hdPage.waitForTimeout(2000);
      await snap(hdPage, '17-helpdesk-conversation.png', 'Helpdesk conversation');
    }
    await hdPage.close();
  });

  // ===== BANTER =====
  // Banter shares the BBB session, so the logged-in cookie carries over.
  await safe('banter', async () => {
    const bnPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await bnPage.goto('http://localhost/banter/', { waitUntil: 'networkidle', timeout: 15000 });
    await bnPage.waitForTimeout(2000);
    await snap(bnPage, 'banter-channels.png', 'Banter channels');
    // Try search
    const searchBtn = bnPage.locator('button[aria-label*="earch"], button:has-text("Search")').first();
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click();
      await bnPage.waitForTimeout(800);
      await snap(bnPage, 'banter-search.png', 'Banter search');
      await bnPage.keyboard.press('Escape');
      await bnPage.waitForTimeout(300);
    }
    // Browse channels
    const browseBtn = bnPage.locator('button:has-text("Browse"), a:has-text("Browse")').first();
    if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseBtn.click();
      await bnPage.waitForTimeout(1000);
      await snap(bnPage, 'banter-browse.png', 'Banter browse channels');
      await bnPage.goBack();
      await bnPage.waitForTimeout(800);
    }
    // Admin panel
    const adminBtn = bnPage.locator('button:has-text("Admin"), a:has-text("Admin")').first();
    if (await adminBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await adminBtn.click();
      await bnPage.waitForTimeout(1000);
      await snap(bnPage, 'banter-admin.png', 'Banter admin');
    }
    await bnPage.close();
  });

  // ===== MIRROR TO site/public/screenshots =====
  console.log('\nMirroring PNGs to site/public/screenshots/ ...');
  for (const f of fs.readdirSync(IMAGES_DIR)) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(IMAGES_DIR, f), path.join(SITE_DIR, f));
    }
  }

  // ===== SUMMARY =====
  console.log('\n=================== SUMMARY ===================');
  console.log('Captured: ' + captured.length);
  captured.forEach((f) => console.log('  OK  ' + f));
  if (skipped.length > 0) {
    console.log('\nSkipped: ' + skipped.length);
    skipped.forEach((s) => console.log('  SKIP  ' + s.filename + ' — ' + s.reason));
  }
  if (reverts.length > 0) {
    console.log('\nReverts performed:');
    reverts.forEach((r) => console.log('  - ' + r));
  }
  console.log('================================================\n');

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
