import { test, expect } from '../../../fixtures/base.fixture';
import { BearingDashboardPage } from '../pages/dashboard.page';
import { bearingConfig } from '../bearing.config';

test.describe('Bearing — Navigation', () => {
  let dashboardPage: BearingDashboardPage;

  test.beforeEach(async ({ page, screenshots }) => {
    dashboardPage = new BearingDashboardPage(page, screenshots);
  });

  test('dashboard loads', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await screenshots.capture(page, 'bearing-dashboard-loaded');
    await dashboardPage.expectDashboardLoaded();
    await screenshots.capture(page, 'bearing-content-visible');
  });

  test('navigate to periods page', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigateToPeriods();
    await screenshots.capture(page, 'periods-page');
    await dashboardPage.expectPath('/periods');
    await screenshots.capture(page, 'periods-url-verified');
  });

  test('navigate to at-risk page', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigateToAtRisk();
    await screenshots.capture(page, 'at-risk-page');
    await dashboardPage.expectPath('/at-risk');
    await screenshots.capture(page, 'at-risk-url-verified');
  });

  test('navigate to my goals page', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigateToMyGoals();
    await screenshots.capture(page, 'my-goals-page');
    await dashboardPage.expectPath('/my-goals');
    await screenshots.capture(page, 'my-goals-url-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = bearingConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await dashboardPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigate('/periods');
    await dashboardPage.navigate('/at-risk');
    await screenshots.capture(page, 'at-at-risk');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-periods');
    await dashboardPage.expectPath('/periods');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-at-risk');
    await dashboardPage.expectPath('/at-risk');
  });
});
