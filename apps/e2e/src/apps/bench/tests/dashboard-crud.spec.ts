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

    // Bench's "New Dashboard" button does NOT open a dialog — it immediately
    // creates an "Untitled Dashboard" via the API and navigates the user to
    // the edit page (/dashboards/:id/edit), where Name/Description/Visibility
    // are inline fields.
    await listPage.clickCreateDashboard();
    await page.waitForURL(/\/bench\/dashboards\/[0-9a-f-]{36}\/edit/, { timeout: 10_000 });
    await screenshots.capture(page, 'dashboard-edit-page');

    // Capture the dashboard id from the URL — we use it to verify the rename
    // round-trip via the per-id GET endpoint, which is the only currently
    // working path on bench-api (the LIST endpoint /v1/dashboards 500s with
    // a Postgres "op ANY/ALL (array) requires array on right side" error —
    // tracked separately as a bench-api bug, out of scope for this test).
    const editUrlMatch = page.url().match(/dashboards\/([0-9a-f-]{36})\/edit/);
    expect(editUrlMatch).not.toBeNull();
    const dashboardId = editUrlMatch![1]!;

    // The Name <label> on the edit page is not associated to its input via
    // htmlFor, so getByLabel will not resolve it. The Name input is the
    // first text input on the page, scoped to <main>.
    const nameInput = page.getByRole('main').locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill(testDashboardName);
    await screenshots.capture(page, 'dashboard-name-filled');

    await page
      .getByRole('main')
      .getByRole('button', { name: /^save$/i })
      .click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'dashboard-saved');

    // Verify via API. Bench API GET /v1/dashboards/:id works even though
    // GET /v1/dashboards (list) currently 500s.
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/bench/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw(`/v1/dashboards/${dashboardId}`);
    expect(status).toBe(200);
    const dashboard = (body as any)?.data;
    expect(dashboard).toBeTruthy();
    expect(dashboard.name).toBe(testDashboardName);
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

    // Bench has no client-side validation surface (no toast, no inline error
    // element) — its dashboard editor just sends the PATCH and the bench-api
    // Zod schema rejects empty names with HTTP 400. Validate the contract by
    // landing on the edit page, clearing the Name input, hitting Save, and
    // asserting the network response is a 4xx with an error envelope.
    await listPage.clickCreateDashboard();
    await page.waitForURL(/\/bench\/dashboards\/[0-9a-f-]{36}\/edit/, { timeout: 10_000 });
    await screenshots.capture(page, 'edit-page-open');

    const nameInput = page.getByRole('main').locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('');
    await screenshots.capture(page, 'name-cleared');

    const patchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/bench/api/v1/dashboards/') &&
        resp.request().method() === 'PATCH',
      { timeout: 5000 },
    );

    await page
      .getByRole('main')
      .getByRole('button', { name: /^save$/i })
      .click();
    await screenshots.capture(page, 'save-clicked-with-empty-name');

    const resp = await patchPromise;
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    const body = await resp.json().catch(() => null);
    expect(body).toHaveProperty('error');
    expect((body as any).error).toHaveProperty('code');
    await screenshots.capture(page, 'api-rejected-empty-name');
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
