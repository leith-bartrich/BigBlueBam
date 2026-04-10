import { test, expect } from '../../../fixtures/base.fixture';
import { setViewport, VIEWPORTS, expectNoHorizontalOverflow } from '../../../helpers/responsive';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('B3 — Responsive Layout', () => {
  test('dashboard renders at mobile viewport', async ({ page, screenshots }) => {
    await setViewport(page, 'mobile');
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'mobile-dashboard');

    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await screenshots.capture(page, 'mobile-no-overflow');
  });

  test('dashboard renders at tablet viewport', async ({ page, screenshots }) => {
    await setViewport(page, 'tablet');
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'tablet-dashboard');

    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await screenshots.capture(page, 'tablet-no-overflow');
  });

  test('dashboard renders at desktop viewport', async ({ page, screenshots }) => {
    await setViewport(page, 'desktop');
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'desktop-dashboard');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'desktop-full-layout');
  });

  test('board renders at all viewports', async ({ page, screenshots, context, request }) => {
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);

    let projectId: string | undefined;
    try {
      const projects = await api.get<any[]>('/projects');
      if (projects.length > 0) projectId = projects[0].id;
    } catch {}

    test.skip(!projectId, 'No project available');

    for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto(`/b3/projects/${projectId}/board`);
      await page.waitForTimeout(1500);
      await screenshots.capture(page, `board-${viewportName}`);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
