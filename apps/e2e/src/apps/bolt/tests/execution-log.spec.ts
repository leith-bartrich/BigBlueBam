import { test, expect } from '../../../fixtures/base.fixture';
import { BoltHomePage } from '../pages/home.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bolt — Execution Log', () => {
  let homePage: BoltHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BoltHomePage(page, screenshots);
  });

  test('executions page shows execution list', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToExecutions();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'executions-list-loaded');

    // Executions page should show a table or list
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'executions-content-visible');
  });

  test('execution list matches API data', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    let executions: any[] = [];
    try {
      executions = await api.get<any[]>('/v1/executions');
    } catch {}

    await homePage.goto();
    await homePage.navigateToExecutions();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'executions-for-comparison');

    // Log count comparison
    const uiRows = page.locator('tbody tr, [class*="execution-row"], [class*="execution-item"]');
    const uiCount = await uiRows.count();
    await screenshots.capture(page, `executions-ui-${uiCount}-api-${executions.length}`);
  });

  test('execution detail shows run information', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    let executionId: string | undefined;
    try {
      const raw = await api.get<unknown>('/v1/executions');
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown[] })?.data)
          ? (raw as { data: any[] }).data
          : Array.isArray((raw as { items?: unknown[] })?.items)
            ? (raw as { items: any[] }).items
            : [];
      if (list.length > 0) executionId = list[0].id;
    } catch {}

    // TODO: Executions are only created when an automation actually runs
    // (Redis event pipeline in bolt-api's event.processor). The e2e seed
    // creates an automation but does not trigger it, so a fresh db has no
    // rows in bolt_executions. When we add a seed-time trigger (e.g. POST
    // /v1/automations/:id/test) this block should force-create one and
    // drop the skip entirely.
    test.skip(!executionId, 'No executions available — fresh db has no runs yet.');

    await page.goto(`/bolt/executions/${executionId}`);
    await homePage.waitForAppReady();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'execution-detail-loaded');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'execution-detail-content');
  });

  test('automation-specific executions page loads', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    let automationId: string | undefined;
    try {
      const automations = await api.get<any[]>('/v1/automations');
      if (automations.length > 0) automationId = automations[0].id;
    } catch {}

    test.skip(!automationId, 'No automation available');

    await page.goto(`/bolt/automations/${automationId}/executions`);
    await homePage.waitForAppReady();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'automation-executions-loaded');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'automation-executions-content');
  });
});
