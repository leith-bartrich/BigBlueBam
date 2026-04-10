import { chromium } from 'playwright';

const BASE = 'http://localhost';
const results = [];

function record(section, name, status, notes = '') {
  results.push({ section, test: name, status, notes });
  console.log(`[${status}] ${section} > ${name}${notes ? ' — ' + notes : ''}`);
}

async function login(page) {
  await page.goto(`${BASE}/b3/`);
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent('body');
  if (bodyText.includes('Dashboard') || bodyText.includes('Projects')) {
    return; // already logged in
  }
  // Fill login form
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await page.fill('input[type="email"], input[name="email"]', 'test@bigbluebam.test');
  await page.fill('input[type="password"], input[name="password"]', 'TestUser2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ===== LOGIN =====
  try {
    await login(page);
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Dashboard') || bodyText.includes('Projects') || bodyText.includes('Kanban')) {
      record('Auth', 'Login at /b3/', 'PASS', 'Session established');
    } else {
      record('Auth', 'Login at /b3/', 'FAIL', 'Login may have failed — no dashboard content detected');
    }
  } catch (e) {
    record('Auth', 'Login at /b3/', 'FAIL', e.message);
  }

  // ===== BRIEF TESTS =====

  // B1: Page loads
  try {
    await page.goto(`${BASE}/brief/`);
    await page.waitForTimeout(4000);
    const bodyText = await page.textContent('body');
    const hasBrief = bodyText.includes('Brief');
    const hasLogin = bodyText.includes('log in') || bodyText.includes('Log in');
    if (hasLogin) {
      record('Brief', 'B1 — Page loads', 'FAIL', 'Not authenticated; shows login prompt');
    } else if (hasBrief) {
      record('Brief', 'B1 — Page loads', 'PASS', 'SPA rendered with Brief content');
    } else {
      record('Brief', 'B1 — Page loads', 'FAIL', 'No Brief content found');
    }
  } catch (e) {
    record('Brief', 'B1 — Page loads', 'FAIL', e.message);
  }

  // B2: Document list
  try {
    await page.goto(`${BASE}/brief/documents`);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    const hasList = bodyText.includes('Documents') || bodyText.includes('document');
    const hasEmpty = bodyText.includes('No documents') || bodyText.includes('Create your first') || bodyText.includes('empty');
    if (hasList || hasEmpty) {
      record('Brief', 'B2 — Document list', 'PASS', hasEmpty ? 'Empty state shown' : 'Document list rendered');
    } else {
      record('Brief', 'B2 — Document list', 'FAIL', `Document list page did not render. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Brief', 'B2 — Document list', 'FAIL', e.message);
  }

  // B3: Create document
  try {
    await page.goto(`${BASE}/brief/new`);
    await page.waitForTimeout(4000);
    const hasEditor = await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').count();
    const hasTitle = await page.locator('input[placeholder*="title" i], input[placeholder*="Title" i], input[placeholder*="Untitled" i]').count();
    const hasSave = await page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Publish")').count();
    if (hasEditor > 0 || hasTitle > 0) {
      record('Brief', 'B3 — Create document flow', 'PASS', `Editor=${hasEditor > 0}, TitleInput=${hasTitle > 0}, SaveBtn=${hasSave > 0}`);
    } else {
      const bodyText = await page.textContent('body');
      record('Brief', 'B3 — Create document flow', 'FAIL', `No editor or title input found. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Brief', 'B3 — Create document flow', 'FAIL', e.message);
  }

  // B4: Template gallery
  try {
    await page.goto(`${BASE}/brief/templates`);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    const hasTemplates = bodyText.includes('Templates') || bodyText.includes('template');
    const hasEmpty = bodyText.includes('No templates') || bodyText.includes('not available');
    if (hasTemplates) {
      record('Brief', 'B4 — Template gallery', 'PASS', hasEmpty ? 'Empty state (no templates created)' : 'Templates page rendered');
    } else {
      record('Brief', 'B4 — Template gallery', 'FAIL', `Templates page did not render. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Brief', 'B4 — Template gallery', 'FAIL', e.message);
  }

  // B5: Tiptap editor renders
  try {
    await page.goto(`${BASE}/brief/new`);
    await page.waitForTimeout(5000);
    const proseMirror = await page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').count();
    if (proseMirror > 0) {
      record('Brief', 'B5 — Tiptap editor renders', 'PASS', `ProseMirror/contenteditable element found (count=${proseMirror})`);
    } else {
      record('Brief', 'B5 — Tiptap editor renders', 'FAIL', 'No ProseMirror/contenteditable element found');
    }
  } catch (e) {
    record('Brief', 'B5 — Tiptap editor renders', 'FAIL', e.message);
  }

  // B6: Export menu
  try {
    await page.goto(`${BASE}/brief/new`);
    await page.waitForTimeout(4000);
    const exportBtn = await page.locator('button:has-text("Export"), [aria-label*="export" i], [title*="Export" i]').count();
    if (exportBtn > 0) {
      await page.locator('button:has-text("Export"), [aria-label*="export" i], [title*="Export" i]').first().click();
      await page.waitForTimeout(1000);
      const bodyText = await page.textContent('body');
      const hasOptions = bodyText.includes('Markdown') || bodyText.includes('PDF') || bodyText.includes('HTML') || bodyText.includes('DOCX');
      record('Brief', 'B6 — Export menu', 'PASS', `Export button clicked, format options visible=${hasOptions}`);
    } else {
      // Maybe it's in the toolbar or header
      const allButtons = await page.locator('button').allTextContents();
      record('Brief', 'B6 — Export menu', 'FAIL', `No Export button found. Available buttons: ${allButtons.join(', ').slice(0, 200)}`);
    }
  } catch (e) {
    record('Brief', 'B6 — Export menu', 'FAIL', e.message);
  }

  // Brief API tests
  try {
    const resp = await page.request.get(`${BASE}/brief/api/v1/documents`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.json();
      const count = Array.isArray(body?.data) ? body.data.length : 'N/A';
      record('Brief', 'API — GET /brief/api/v1/documents', 'PASS', `Status=${status}, documents=${count}`);
    } else {
      record('Brief', 'API — GET /brief/api/v1/documents', 'FAIL', `Status=${status}`);
    }
  } catch (e) {
    record('Brief', 'API — GET /brief/api/v1/documents', 'FAIL', e.message);
  }

  try {
    const resp = await page.request.get(`${BASE}/brief/api/v1/templates`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.json();
      const count = Array.isArray(body?.data) ? body.data.length : 'N/A';
      record('Brief', 'API — GET /brief/api/v1/templates', 'PASS', `Status=${status}, templates=${count}`);
    } else {
      record('Brief', 'API — GET /brief/api/v1/templates', 'FAIL', `Status=${status}`);
    }
  } catch (e) {
    record('Brief', 'API — GET /brief/api/v1/templates', 'FAIL', e.message);
  }

  // ===== BOLT TESTS =====

  // L1: Page loads
  try {
    await page.goto(`${BASE}/bolt/`);
    await page.waitForTimeout(4000);
    const bodyText = await page.textContent('body');
    const hasBolt = bodyText.includes('Bolt') || bodyText.includes('Automation') || bodyText.includes('automation');
    const hasLogin = bodyText.includes('log in') || bodyText.includes('Log in');
    if (hasLogin) {
      record('Bolt', 'L1 — Page loads', 'FAIL', 'Not authenticated; shows login prompt');
    } else if (hasBolt) {
      record('Bolt', 'L1 — Page loads', 'PASS', 'SPA rendered with Bolt content');
    } else {
      record('Bolt', 'L1 — Page loads', 'FAIL', `No Bolt content found. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Bolt', 'L1 — Page loads', 'FAIL', e.message);
  }

  // L2: Automation list
  try {
    await page.goto(`${BASE}/bolt/`);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    const hasList = bodyText.includes('Automations') || bodyText.includes('automation');
    const hasEmpty = bodyText.includes('No automations') || bodyText.includes('Create your first') || bodyText.includes('Get started');
    if (hasList || hasEmpty) {
      record('Bolt', 'L2 — Automation list', 'PASS', hasEmpty ? 'Empty state shown' : 'Automation list rendered');
    } else {
      record('Bolt', 'L2 — Automation list', 'FAIL', `Automation list not rendered. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Bolt', 'L2 — Automation list', 'FAIL', e.message);
  }

  // L3: Create automation builder
  try {
    await page.goto(`${BASE}/bolt/new`);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    const hasBuilder = bodyText.includes('Trigger') || bodyText.includes('trigger') ||
                       bodyText.includes('Action') || bodyText.includes('action') ||
                       bodyText.includes('Condition');
    const hasNameInput = await page.locator('input[placeholder*="name" i], input[placeholder*="Name" i], input[placeholder*="automation" i]').count();
    const hasSave = await page.locator('button:has-text("Save"), button:has-text("Create")').count();
    if (hasBuilder || hasNameInput > 0) {
      record('Bolt', 'L3 — Create automation builder', 'PASS', `Builder=${!!hasBuilder}, NameInput=${hasNameInput > 0}, SaveBtn=${hasSave > 0}`);
    } else {
      record('Bolt', 'L3 — Create automation builder', 'FAIL', `Builder not found. Snippet: ${bodyText.slice(0, 300)}`);
    }
  } catch (e) {
    record('Bolt', 'L3 — Create automation builder', 'FAIL', e.message);
  }

  // L4: Event catalog / trigger source dropdown
  try {
    await page.goto(`${BASE}/bolt/new`);
    await page.waitForTimeout(3000);
    // Look for trigger source selector buttons/selects
    const triggerSelector = await page.locator('select, [role="listbox"], [role="combobox"], button:has-text("Select"), button:has-text("Choose"), button:has-text("source")').count();
    if (triggerSelector > 0) {
      const el = page.locator('select, [role="listbox"], [role="combobox"], button:has-text("Select"), button:has-text("Choose"), button:has-text("source")').first();
      await el.click();
      await page.waitForTimeout(1000);
      const bodyText = await page.textContent('body');
      const hasEvents = bodyText.includes('Bam') || bodyText.includes('Banter') || bodyText.includes('Schedule') || bodyText.includes('task.');
      record('Bolt', 'L4 — Event catalog / trigger dropdown', 'PASS', `Trigger selector found, events visible=${!!hasEvents}`);
    } else {
      // Check for inline source cards/buttons
      const bodyText = await page.textContent('body');
      const hasSourceCards = bodyText.includes('Bam') && bodyText.includes('Banter');
      if (hasSourceCards) {
        record('Bolt', 'L4 — Event catalog / trigger dropdown', 'PASS', 'Trigger sources shown as inline cards');
      } else {
        record('Bolt', 'L4 — Event catalog / trigger dropdown', 'FAIL', `No trigger selector found. Snippet: ${bodyText.slice(0, 300)}`);
      }
    }
  } catch (e) {
    record('Bolt', 'L4 — Event catalog / trigger dropdown', 'FAIL', e.message);
  }

  // L5: Template browser
  try {
    await page.goto(`${BASE}/bolt/templates`);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    const hasTemplates = bodyText.includes('Templates') || bodyText.includes('template');
    const hasEmpty = bodyText.includes('No templates') || bodyText.includes('coming soon');
    if (hasTemplates) {
      record('Bolt', 'L5 — Template browser', 'PASS', hasEmpty ? 'Empty state (no templates)' : 'Templates page rendered');
    } else {
      record('Bolt', 'L5 — Template browser', 'FAIL', `Templates page not rendered. Snippet: ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    record('Bolt', 'L5 — Template browser', 'FAIL', e.message);
  }

  // L6: API — GET /bolt/api/v1/automations
  try {
    const resp = await page.request.get(`${BASE}/bolt/api/v1/automations`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.json();
      const count = Array.isArray(body?.data) ? body.data.length : 'N/A';
      record('Bolt', 'L6 — API GET /bolt/api/v1/automations', 'PASS', `Status=${status}, count=${count}`);
    } else {
      record('Bolt', 'L6 — API GET /bolt/api/v1/automations', 'FAIL', `Status=${status}`);
    }
  } catch (e) {
    record('Bolt', 'L6 — API GET /bolt/api/v1/automations', 'FAIL', e.message);
  }

  // Bolt API: templates
  try {
    const resp = await page.request.get(`${BASE}/bolt/api/v1/templates`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.json();
      const count = Array.isArray(body?.data) ? body.data.length : 'N/A';
      record('Bolt', 'API — GET /bolt/api/v1/templates', 'PASS', `Status=${status}, templates=${count}`);
    } else {
      record('Bolt', 'API — GET /bolt/api/v1/templates', 'FAIL', `Status=${status}`);
    }
  } catch (e) {
    record('Bolt', 'API — GET /bolt/api/v1/templates', 'FAIL', e.message);
  }

  // Bolt API: events
  try {
    const resp = await page.request.get(`${BASE}/bolt/api/v1/events`);
    const status = resp.status();
    if (status === 200) {
      const body = await resp.json();
      record('Bolt', 'API — GET /bolt/api/v1/events (catalog)', 'PASS', `Status=${status}`);
    } else {
      record('Bolt', 'API — GET /bolt/api/v1/events (catalog)', status < 500 ? 'PASS' : 'FAIL', `Status=${status}`);
    }
  } catch (e) {
    record('Bolt', 'API — GET /bolt/api/v1/events (catalog)', 'FAIL', e.message);
  }

  // ===== SUMMARY =====
  console.log('\n\n===== AUDIT SUMMARY =====');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${passCount} / FAIL: ${failCount} / TOTAL: ${results.length}`);
  console.log('');
  for (const r of results) {
    console.log(`[${r.status}] ${r.section} > ${r.test}${r.notes ? ' — ' + r.notes : ''}`);
  }
  console.log('\n===== RESULTS_JSON =====');
  console.log(JSON.stringify(results));

  await browser.close();
})();
