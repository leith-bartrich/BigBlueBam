import { test, expect } from '../../../fixtures/base.fixture';
import { BenchDashboardListPage } from '../pages/dashboard-list.page';
import { benchConfig } from '../bench.config';

test.describe('Bench — Navigation', () => {
  let listPage: BenchDashboardListPage;

  test.beforeEach(async ({ page, screenshots }) => {
    listPage = new BenchDashboardListPage(page, screenshots);
  });

  test('dashboard list loads', async ({ page, screenshots }) => {
    await listPage.goto();
    await screenshots.capture(page, 'bench-dashboard-list-loaded');
    await listPage.expectDashboardListLoaded();
    await screenshots.capture(page, 'bench-content-visible');
  });

  test('navigate to explorer page', async ({ page, screenshots }) => {
    await listPage.goto();
    await listPage.navigateToExplorer();
    await screenshots.capture(page, 'explorer-page');
    await listPage.expectPath('/explorer');
    await screenshots.capture(page, 'explorer-url-verified');
  });

  test('navigate to reports page', async ({ page, screenshots }) => {
    await listPage.goto();
    await listPage.navigateToReports();
    await screenshots.capture(page, 'reports-page');
    await listPage.expectPath('/reports');
    await screenshots.capture(page, 'reports-url-verified');
  });

  test('navigate to settings page', async ({ page, screenshots }) => {
    await listPage.goto();
    await listPage.navigateToSettings();
    await screenshots.capture(page, 'settings-page');
    await listPage.expectPath('/settings');
    await screenshots.capture(page, 'settings-url-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = benchConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await listPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await listPage.goto();
    await listPage.navigate('/explorer');
    await listPage.navigate('/reports');
    await screenshots.capture(page, 'at-reports');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-explorer');
    await listPage.expectPath('/explorer');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-reports');
    await listPage.expectPath('/reports');
  });
});
