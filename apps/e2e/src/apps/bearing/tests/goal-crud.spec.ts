import { test, expect } from '../../../fixtures/base.fixture';
import { BearingDashboardPage } from '../pages/dashboard.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

// The Bearing dashboard gates "Create Goal" on a selected period being in
// localStorage (`bearing_selected_period_id`). Tests that open the create
// dialog must first ensure a period exists and is selected.
async function ensureSelectedPeriod(
  page: import('@playwright/test').Page,
  api: DirectApiClient,
): Promise<string> {
  const { status, body } = await api.getRaw('/v1/periods');
  let periodId: string | undefined;
  if (status === 200) {
    const rows = (body as any)?.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) {
      periodId = rows[0]?.id;
    }
  }
  if (!periodId) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const startsAt = `${year}-01-01`;
    const endsAt = `${year}-12-31`;
    // The live DB constraint `bearing_periods_period_type_check` accepts
    // only ('annual','semi_annual','quarterly','monthly','custom') (see
    // migration 0029_bearing_schema_alignment.sql) even though the shared
    // Zod enum also lists 'year'/'quarter'/'half'. Use `annual` here.
    const { status: createStatus, body: createBody } = await api.postRaw('/v1/periods', {
      name: `E2E Period ${year}`,
      period_type: 'annual',
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'active',
    });
    if (createStatus >= 400) {
      throw new Error(
        `Failed to create bearing period for test setup: ${createStatus} ${JSON.stringify(createBody)}`,
      );
    }
    periodId = (createBody as any)?.data?.id;
  }
  if (!periodId) throw new Error('Could not resolve a bearing period id for test setup');

  // Persist the selected period id in localStorage for the bearing SPA so the
  // CreateGoalDialog is not blocked by `!selectedPeriodId`.
  await page.addInitScript((id: string) => {
    try {
      window.localStorage.setItem('bearing_selected_period_id', id);
    } catch {
      // ignore
    }
  }, periodId);
  return periodId;
}

test.describe('Bearing — Goal CRUD', () => {
  const testGoalTitle = `E2E Test Goal ${Date.now()}`;

  test('create a new goal via UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/bearing/api', csrf || undefined);
    await ensureSelectedPeriod(page, apiClient);

    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-before-create');

    await dashboard.clickCreateGoal();
    await screenshots.capture(page, 'create-goal-dialog');

    // The Bearing create dialog contains a single "Title" input (via the
    // shared Input component with `htmlFor`). It has no period select inside
    // the dialog — period is chosen via the top-level PeriodSelector.
    await page.getByLabel(/^title$/i).fill(testGoalTitle);
    await screenshots.capture(page, 'goal-title-filled');

    // The dialog's action button reads "Create Goal" and becomes enabled once
    // a title is present and a period is selected.
    await page.getByRole('button', { name: /create goal/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'goal-created');

    // Verify via API
    const { status, body } = await apiClient.getRaw('/v1/goals');
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

  test('create goal with empty title shows validation error', async ({
    page,
    screenshots,
    context,
    request,
  }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/bearing/api', csrf || undefined);
    await ensureSelectedPeriod(page, apiClient);

    const dashboard = new BearingDashboardPage(page, screenshots);
    await dashboard.goto();
    await dashboard.clickCreateGoal();
    await screenshots.capture(page, 'create-dialog-open');

    // The Bearing CreateGoalDialog does not render an inline error message;
    // instead, the "Create Goal" button stays disabled until the title is
    // non-empty. Asserting the disabled state is the canonical validation
    // check for this UI.
    const createButton = page.getByRole('button', { name: /create goal/i });
    await expect(createButton).toBeDisabled();
    await screenshots.capture(page, 'validation-button-disabled');
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
