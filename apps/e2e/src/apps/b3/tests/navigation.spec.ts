import { test, expect } from '../../../fixtures/base.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { b3Config } from '../b3.config';

test.describe('B3 — Navigation', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page, screenshots }) => {
    dashboardPage = new DashboardPage(page, screenshots);
  });

  test('dashboard loads after login', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await screenshots.capture(page, 'dashboard-loaded');
    await dashboardPage.expectDashboardLoaded();
    await screenshots.capture(page, 'dashboard-content-visible');
  });

  test('navigate to My Work', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigate('/my-work');
    await screenshots.capture(page, 'my-work-page');
    await dashboardPage.expectPath('/my-work');
    await screenshots.capture(page, 'my-work-url-verified');
  });

  test('navigate to Settings', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigate('/settings');
    await screenshots.capture(page, 'settings-page');
    await dashboardPage.expectPath('/settings');
    await screenshots.capture(page, 'settings-url-verified');
  });

  test('navigate to People', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await dashboardPage.navigate('/people');
    await screenshots.capture(page, 'people-page');
    await dashboardPage.expectPath('/people');
    await screenshots.capture(page, 'people-url-verified');
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await dashboardPage.goto();
    await screenshots.capture(page, 'start-at-dashboard');

    await dashboardPage.navigate('/my-work');
    await screenshots.capture(page, 'navigated-to-my-work');

    await dashboardPage.navigate('/settings');
    await screenshots.capture(page, 'navigated-to-settings');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await dashboardPage.expectPath('/my-work');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await dashboardPage.expectPath('/settings');
  });

  test('deep link to project board', async ({ page, screenshots, apiClient }) => {
    // Get a project via API to test deep linking
    const { status, body } = await apiClient.getRaw('/projects');
    if (status === 200 && (body as any)?.data?.length > 0) {
      const projectId = (body as any).data[0].id;
      await page.goto(`/b3/projects/${projectId}/board`);
      await dashboardPage.waitForAppReady();
      await screenshots.capture(page, 'deep-link-board-loaded');
      await expect(page.locator('main')).toBeVisible();
      await screenshots.capture(page, 'board-content-visible');
    }
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = b3Config.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    // Land on the dashboard first so the SPA picks up the admin session
    // before we start hopping between routes via pushState. If the very
    // first GET /auth/me happens to be rate-limited (sibling tests, CI
    // contention) the SPA renders the login form. In that case the
    // session cookie is still valid — we just need to wait for the rate
    // limiter to clear and reload.
    await dashboardPage.goto();
    const loginFormVisible = await page
      .getByRole('heading', { name: /welcome back/i })
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (loginFormVisible) {
      // Back off, then reload — the SPA will retry /auth/me with the
      // existing cookie and render the dashboard.
      await page.waitForTimeout(2000);
      await page.reload();
      await dashboardPage.waitForAppReady();
    }
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    for (const pageDef of simplePages) {
      await dashboardPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      // The SuperUser console redirects non-superusers back to the
      // dashboard via useEffect, so we just check that *some* layout
      // surface (main element or layout content wrapper) is visible.
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
