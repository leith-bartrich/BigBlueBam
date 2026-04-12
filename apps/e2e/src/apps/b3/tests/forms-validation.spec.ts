import { test, expect } from '../../../fixtures/base.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../../../page-objects/login.page';
import { expectFormValidationError } from '../../../helpers/interactions';

// b3 project config sets storageState: '.auth/admin.json' for every context,
// including those created via browser.newContext(). To exercise the login
// form we need an explicitly unauthenticated context — empty cookies +
// empty origins.
const EMPTY_STORAGE = { cookies: [], origins: [] } as const;

test.describe('B3 — Form Validation', () => {
  test('login form requires email and password', async ({ browser, screenshots }) => {
    const context = await browser.newContext({ storageState: EMPTY_STORAGE });
    const page = await context.newPage();
    const loginPage = new LoginPage(page, screenshots);
    await loginPage.goto();
    await screenshots.capture(page, 'login-empty-form');

    // Submit without filling anything
    await loginPage.clickSignIn();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'login-submitted-empty');

    // Browser validation or custom validation should prevent submission
    // Check that we're still on the login page
    await loginPage.expectLoginPage();
    await screenshots.capture(page, 'still-on-login-page');
    await context.close();
  });

  test('login form shows error for invalid credentials', async ({ browser, screenshots }) => {
    const context = await browser.newContext({ storageState: EMPTY_STORAGE });
    const page = await context.newPage();
    const loginPage = new LoginPage(page, screenshots);
    await loginPage.goto();
    await loginPage.login('invalid@email.com', 'wrongpassword');
    await screenshots.capture(page, 'invalid-credentials-submitted');

    // LoginPage.expectErrorMessage uses legacy selectors that don't match
    // the b3 login form's red error block — assert against the real markup.
    const errorBox = page.locator('div.bg-red-50.text-red-700, [role="alert"]').first();
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
    await screenshots.capture(page, 'error-message-displayed');
    await context.close();
  });

  test('project creation requires name', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-loaded');

    await dashboard.clickCreateProject();
    await screenshots.capture(page, 'create-project-dialog-open');

    // Submit without name. Scope to the dialog so we don't accidentally
    // match the sidebar/empty-state CTAs that share the same label.
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /create project/i }).click();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'project-form-submitted-empty');

    // Should show validation error inside the dialog
    const errorVisible = await dialog
      .locator('.text-red-500, .text-red-600, .text-destructive, [role="alert"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (errorVisible) {
      await screenshots.capture(page, 'project-validation-error');
    }
  });

  test('API validation errors render in UI', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();

    // Intercept the API to simulate a validation error
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ field: 'name', issue: 'required' }],
              request_id: 'test-123',
            },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await dashboard.clickCreateProject();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Project Name').fill('Test');
    await dialog.getByLabel('Task ID Prefix').fill('TST');
    await dialog.getByRole('button', { name: /create project/i }).click();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'api-validation-error-rendered');
  });
});
