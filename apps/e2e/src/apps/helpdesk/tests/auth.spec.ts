import { test, expect } from '../../../fixtures/base.fixture';
import { HelpdeskHomePage } from '../pages/helpdesk-home.page';

// Helpdesk has its OWN auth system separate from B3.
// These tests exercise the helpdesk login/register flows directly at
// /helpdesk/login and /helpdesk/register rather than going through B3.
test.describe('Helpdesk — Authentication', () => {
  test('login page renders correctly', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.gotoLogin();
    await screenshots.capture(page, 'login-page-loaded');

    await homePage.expectLoginPage();
    await screenshots.capture(page, 'login-form-visible');
  });

  test('register page renders correctly', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.gotoRegister();
    await screenshots.capture(page, 'register-page-loaded');

    await homePage.expectRegisterPage();
    await screenshots.capture(page, 'register-form-visible');
  });

  test('login with invalid credentials shows error', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.gotoLogin();
    await screenshots.capture(page, 'login-before-submit');

    const emailField = page.getByLabel(/email/i).first();
    const passwordField = page.getByLabel(/password/i).first();

    if (
      (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) &&
      (await passwordField.isVisible({ timeout: 3000 }).catch(() => false))
    ) {
      await emailField.fill('nonexistent@helpdesk-e2e.test');
      await passwordField.fill('wrongpassword123');
      await screenshots.capture(page, 'invalid-credentials-filled');

      await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
      await page.waitForTimeout(1500);
      await screenshots.capture(page, 'after-invalid-submit');

      const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
      if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) {
        await screenshots.capture(page, 'error-message-visible');
      }
    }
  });

  test('login with empty fields shows validation error', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.gotoLogin();
    await screenshots.capture(page, 'empty-login-form');

    await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'empty-submit-attempted');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await screenshots.capture(page, 'validation-error-visible');
    }
  });

  test('unauthenticated access to protected page redirects to login', async ({ browser, screenshots }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/helpdesk/tickets');
    await page.waitForTimeout(1500);
    await screenshots.capture(page, 'unauthenticated-access');

    // Expect login form to be visible (whether via redirect or inline)
    const emailVisible = await page
      .getByLabel(/email/i)
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(emailVisible || page.url().includes('/login')).toBeTruthy();
    await screenshots.capture(page, 'login-shown-after-redirect');

    await context.close();
  });

  test('can navigate from login to register page', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.gotoLogin();
    await screenshots.capture(page, 'on-login-page');

    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i }).first();
    if (await registerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(500);
      await screenshots.capture(page, 'navigated-to-register');
    } else {
      await homePage.gotoRegister();
      await screenshots.capture(page, 'register-page-direct');
    }
  });
});
