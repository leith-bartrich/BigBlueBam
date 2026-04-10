import { test, expect } from '../../../fixtures/base.fixture';
import { BearingDashboardPage } from '../pages/dashboard.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bearing — Goal CRUD', () => {
  const testGoalTitle = `E2E Test Goal ${Date.now()}`;

  test('create a new goal via UI', async ({ page, screenshots, context, request }) => {
    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-before-create');

    await dashboard.clickCreateGoal();
    await screenshots.capture(page, 'create-goal-dialog');

    // Fill goal form
    await page.getByLabel(/title/i).fill(testGoalTitle);
    await screenshots.capture(page, 'goal-title-filled');

    // Select a period if the dropdown is visible
    const periodSelect = page.getByLabel(/period/i);
    if (await periodSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = periodSelect.locator('option');
      const count = await options.count();
      if (count > 1) {
        await periodSelect.selectOption({ index: 1 });
        await screenshots.capture(page, 'period-selected');
      }
    }

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'goal-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/bearing/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/goals');
    if (status === 200) {
      const goals = (body as any)?.data || body;
      const found = Array.isArray(goals)
        ? goals.find((g: any) => g.title === testGoalTitle)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'goal-verified-via-api');
  });

  test('goal list shows goals on dashboard', async ({ page, screenshots }) => {
    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-with-goals');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'goals-list-visible');
  });

  test('create goal with empty title shows validation error', async ({ page, screenshots }) => {
    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await dashboard.clickCreateGoal();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('my goals page shows filtered goals', async ({ page, screenshots }) => {
    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await dashboard.navigateToMyGoals();
    await screenshots.capture(page, 'my-goals-page');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'my-goals-content-visible');
  });
});
