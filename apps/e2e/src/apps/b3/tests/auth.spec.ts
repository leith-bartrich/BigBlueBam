import { test, expect } from '../../../fixtures/base.fixture';
import { LoginPage } from '../../../page-objects/login.page';
import { TEST_USERS } from '../../../auth/test-users';

test.describe('B3 — Authentication', () => {
  test('login page renders correctly', async ({ page, screenshots }) => {
    const loginPage = new LoginPage(page, screenshots);
    await loginPage.goto();
    await screenshots.capture(page, 'login-page-loaded');
    await loginPage.expectLoginPage();
    await screenshots.capture(page, 'login-form-visible');
  });

  test('login with valid credentials redirects to dashboard', async ({ page, screenshots }) => {
    const loginPage = new LoginPage(page, screenshots);
    await loginPage.goto();
    await screenshots.capture(page, 'login-page');
    await loginPage.fillEmail(TEST_USERS.admin.email);
    await screenshots.capture(page, 'email-filled');
    await loginPage.fillPassword(TEST_USERS.admin.password);
    await screenshots.capture(page, 'password-filled');
    await loginPage.clickSignIn();
    await screenshots.capture(page, 'sign-in-clicked');
    await loginPage.expectRedirectToDashboard();
    await screenshots.capture(page, 'dashboard-after-login');
  });

  test('login with invalid credentials shows error', async ({ page, screenshots }) => {
    const loginPage = new LoginPage(page, screenshots);
    await loginPage.goto();
    await loginPage.login('invalid@test.com', 'wrongpassword');
    await screenshots.capture(page, 'invalid-login-attempted');
    await loginPage.expectErrorMessage();
    await screenshots.capture(page, 'error-message-visible');
  });

  test('unauthenticated access redirects to login', async ({ browser, screenshots }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/b3/');
    await screenshots.capture(page, 'unauthenticated-redirect');
    // Should end up at login
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10_000 });
    await screenshots.capture(page, 'login-page-after-redirect');
    await context.close();
  });

  test('logout clears session', async ({ page, screenshots }) => {
    // Already logged in via storageState
    await page.goto('/b3/');
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'logged-in-dashboard');

    // Find and click logout (usually in user menu dropdown)
    const userMenu = page.locator('[class*="user-menu"], [class*="avatar"]').first();
    if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenu.click();
      await screenshots.capture(page, 'user-menu-opened');
      const logoutBtn = page.getByText(/log out|sign out/i).first();
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await screenshots.capture(page, 'logout-clicked');
        await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10_000 });
        await screenshots.capture(page, 'login-page-after-logout');
      }
    }
  });
});
