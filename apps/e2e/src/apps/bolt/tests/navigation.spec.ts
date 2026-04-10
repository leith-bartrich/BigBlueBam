import { test, expect } from '../../../fixtures/base.fixture';
import { BoltHomePage } from '../pages/home.page';
import { boltConfig } from '../bolt.config';

test.describe('Bolt — Navigation', () => {
  let homePage: BoltHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BoltHomePage(page, screenshots);
  });

  test('home page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'bolt-home-loaded');
    await homePage.expectHomeLoaded();
    await screenshots.capture(page, 'bolt-content-visible');
  });

  test('executions page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToExecutions();
    await screenshots.capture(page, 'executions-page');
    await homePage.expectPath('/executions');
    await screenshots.capture(page, 'executions-verified');
  });

  test('templates page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToTemplates();
    await screenshots.capture(page, 'templates-page');
    await homePage.expectPath('/templates');
    await screenshots.capture(page, 'templates-verified');
  });

  test('new automation page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToNewAutomation();
    await screenshots.capture(page, 'new-automation-page');
    await homePage.expectPath('/new');
    await screenshots.capture(page, 'new-automation-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = boltConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await homePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigate('/executions');
    await homePage.navigate('/templates');
    await screenshots.capture(page, 'at-templates');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-executions');
    await homePage.expectPath('/executions');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-templates');
    await homePage.expectPath('/templates');
  });

  test('deep link to automation detail', async ({ page, screenshots, context, request }) => {
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    let automationId: string | undefined;
    try {
      const automations = await api.get<any[]>('/automations');
      if (automations.length > 0) automationId = automations[0].id;
    } catch {}

    if (automationId) {
      await page.goto(`/bolt/automations/${automationId}`);
      await homePage.waitForAppReady();
      await screenshots.capture(page, 'deep-link-automation-loaded');
      await expect(page.locator('main')).toBeVisible();
      await screenshots.capture(page, 'automation-detail-visible');
    }
  });
});
