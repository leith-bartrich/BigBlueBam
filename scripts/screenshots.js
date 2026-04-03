const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto('http://localhost', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'images/01-login.png' });
  console.log('01 Login');

  await page.fill('input[name=email]', 'eddie@bigblueceiling.com');
  await page.fill('input[name=password]', 'BigBlue2026!');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);

  // Enable dark mode
  await page.locator('aside button:has-text("Settings")').click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Appearance")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Dark")').click();
  await page.waitForTimeout(500);

  // Dashboard
  await page.locator('aside button:has-text("Dashboard")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'images/02-dashboard.png' });
  console.log('02 Dashboard (dark)');

  // Board
  await page.locator('button:has-text("Frndo")').first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'images/03-board.png' });
  console.log('03 Board (dark)');

  // Task detail
  await page.locator('.cursor-grab').nth(0).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'images/04-task-detail.png' });
  console.log('04 Task detail (dark)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Swimlanes
  const selects = await page.locator('button[role=combobox]').all();
  for (const s of selects) {
    const t = await s.textContent();
    if (t && (t.includes('Swim') || t.includes('No Swim'))) {
      await s.click(); await page.waitForTimeout(300);
      await page.locator('[role=option]:has-text("Assignee")').click();
      await page.waitForTimeout(1500);
      break;
    }
  }
  await page.screenshot({ path: 'images/05-swimlanes.png' });
  console.log('05 Swimlanes (dark)');
  for (const s of await page.locator('button[role=combobox]').all()) {
    const t = await s.textContent();
    if (t && t.includes('Assignee')) {
      await s.click(); await page.waitForTimeout(200);
      await page.locator('[role=option]').first().click();
      await page.waitForTimeout(500);
      break;
    }
  }

  // List view
  await page.locator('button[aria-label="List view"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'images/06-list-view.png' });
  console.log('06 List view (dark)');

  // Timeline
  await page.locator('button[aria-label="Timeline view"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'images/07-timeline.png' });
  console.log('07 Timeline (dark)');

  // Calendar
  await page.locator('button[aria-label="Calendar view"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'images/08-calendar.png' });
  console.log('08 Calendar (dark)');

  // Project Dashboard
  const projectId = page.url().match(/projects\/([^/]+)/)?.[1];
  if (projectId) {
    await page.goto('http://localhost/projects/' + projectId + '/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'images/09-project-dashboard.png' });
    console.log('09 Project dashboard (dark)');
  }

  // My Work
  await page.locator('aside button:has-text("My Work")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'images/10-my-work.png' });
  console.log('10 My Work (dark)');

  // Settings Members
  await page.locator('aside button:has-text("Settings")').click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Members")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'images/11-members.png' });
  console.log('11 Members (dark)');

  // Settings Integrations
  await page.locator('button:has-text("Integrations")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'images/12-integrations.png' });
  console.log('12 Integrations (dark)');

  // Light mode board
  await page.locator('button:has-text("Appearance")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Light")').click();
  await page.waitForTimeout(500);
  await page.locator('aside button:has-text("Frndo")').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'images/13-board-light.png' });
  console.log('13 Board (light)');

  // Command palette
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'images/14-command-palette.png' });
  console.log('14 Command palette');
  await page.keyboard.press('Escape');

  // ===== HELPDESK =====
  const hdPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await hdPage.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 15000 });
  await hdPage.screenshot({ path: 'images/15-helpdesk-login.png' });
  console.log('15 Helpdesk login');

  await hdPage.fill('#email', 'jane.doe@example.com');
  await hdPage.fill('#password', 'customerpass123');
  await hdPage.click('button[type=submit]');
  await hdPage.waitForTimeout(2000);
  await hdPage.screenshot({ path: 'images/16-helpdesk-tickets.png' });
  console.log('16 Helpdesk tickets');

  // Ticket detail
  const row = hdPage.locator('tr').filter({ hasText: 'crashes' }).first();
  if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
    await row.click();
    await hdPage.waitForTimeout(2000);
    await hdPage.screenshot({ path: 'images/17-helpdesk-conversation.png' });
    console.log('17 Helpdesk conversation');
  }

  console.log('\nAll done!');
  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
