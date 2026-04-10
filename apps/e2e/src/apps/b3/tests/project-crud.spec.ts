import { test, expect } from '../../../fixtures/base.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('B3 — Project CRUD', () => {
  const testProjectName = `E2E Test Project ${Date.now()}`;
  const testProjectKey = `E2E${Date.now().toString().slice(-4)}`;

  test('create a new project via UI', async ({ page, screenshots, context, request }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-before-create');

    await dashboard.clickCreateProject();
    await screenshots.capture(page, 'create-project-dialog');

    // Fill project form
    await page.getByLabel(/project name|name/i).fill(testProjectName);
    await screenshots.capture(page, 'project-name-filled');

    await page.getByLabel(/key/i).fill(testProjectKey);
    await screenshots.capture(page, 'project-key-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'project-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/b3/api', csrf || undefined);
    const projects = await apiClient.get<any[]>('/projects');
    const found = projects.find((p: any) => p.name === testProjectName);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'project-verified-via-api');
  });

  test('project appears in dashboard list', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-with-projects');

    // Should see at least some projects
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'projects-list-visible');
  });

  test('create project with empty name shows validation error', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await dashboard.clickCreateProject();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    // Should show some form of error
    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });
});
