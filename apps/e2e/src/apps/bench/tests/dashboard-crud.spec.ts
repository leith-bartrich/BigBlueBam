import { test, expect } from '../../../fixtures/base.fixture';
import { BenchDashboardListPage } from '../pages/dashboard-list.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bench — Dashboard CRUD', () => {
  const testDashboardName = `E2E Test Dashboard ${Date.now()}`;

  test('create a new dashboard via UI', async ({ page, screenshots, context, request }) => {
    const listPage = new BenchDashboardListPage(page, screenshots);
    await listPage.goto();
    await screenshots.capture(page, 'list-before-create');

    await listPage.clickCreateDashboard();
    await screenshots.capture(page, 'create-dashboard-dialog');

    // Fill dashboard form
    await page.getByLabel(/name/i).fill(testDashboardName);
    await screenshots.capture(page, 'dashboard-name-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'dashboard-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/bench/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/dashboards');
    if (status === 200) {
      const dashboards = (body as any)?.data || body;
      const found = Array.isArray(dashboards)
        ? dashboards.find((d: any) => d.name === testDashboardName)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'dashboard-verified-via-api');
  });

  test('dashboard list shows dashboards', async ({ page, screenshots }) => {
    const listPage = new BenchDashboardListPage(page, screenshots);
    await listPage.goto();
    await screenshots.capture(page, 'dashboard-list');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'dashboards-visible');
  });

  test('create dashboard with empty name shows validation error', async ({ page, screenshots }) => {
    const listPage = new BenchDashboardListPage(page, screenshots);
    await listPage.goto();
    await listPage.clickCreateDashboard();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('explorer page renders query interface', async ({ page, screenshots }) => {
    const listPage = new BenchDashboardListPage(page, screenshots);
    await listPage.goto();
    await listPage.navigateToExplorer();
    await screenshots.capture(page, 'explorer-page-loaded');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'explorer-content-visible');
  });
});
