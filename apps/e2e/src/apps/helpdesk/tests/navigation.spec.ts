import { test, expect } from '../../../fixtures/base.fixture';
import { HelpdeskHomePage } from '../pages/helpdesk-home.page';
import { helpdeskConfig } from '../helpdesk.config';

test.describe('Helpdesk — Navigation', () => {
  let homePage: HelpdeskHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new HelpdeskHomePage(page, screenshots);
  });

  test('login page is reachable without auth', async ({ page, screenshots }) => {
    await homePage.gotoLogin();
    await screenshots.capture(page, 'login-page-loaded');
    await homePage.expectPath('/login');
    await screenshots.capture(page, 'login-url-verified');
  });

  test('register page is reachable without auth', async ({ page, screenshots }) => {
    await homePage.gotoRegister();
    await screenshots.capture(page, 'register-page-loaded');
    await homePage.expectPath('/register');
    await screenshots.capture(page, 'register-url-verified');
  });

  test('verify page is reachable', async ({ page, screenshots }) => {
    await homePage.gotoVerify();
    await screenshots.capture(page, 'verify-page-loaded');
    await homePage.expectPath('/verify');
    await screenshots.capture(page, 'verify-url-verified');
  });

  test('unauthenticated access to tickets redirects or shows login', async ({ browser, screenshots }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/helpdesk/tickets');
    await page.waitForTimeout(1500);
    await screenshots.capture(page, 'unauth-tickets-access');

    // Should either redirect to login or show a login form inline
    const loginVisible = await page
      .getByLabel(/email/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(loginVisible || page.url().includes('/login')).toBeTruthy();
    await screenshots.capture(page, 'redirected-or-login-shown');
    await context.close();
  });

  test('tickets list page renders', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'tickets-page-loaded');
    await homePage.expectPath('/tickets');
    await screenshots.capture(page, 'tickets-url-verified');
  });

  test('new ticket page renders', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToNewTicket();
    await screenshots.capture(page, 'new-ticket-page');
    await homePage.expectPath('/tickets/new');
    await screenshots.capture(page, 'new-ticket-url-verified');
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'start-at-tickets');

    await homePage.navigateToNewTicket();
    await screenshots.capture(page, 'navigated-to-new');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await homePage.expectPath('/tickets');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await homePage.expectPath('/tickets/new');
  });

  test('unauthenticated pages from config are reachable', async ({ page, screenshots }) => {
    const publicPages = helpdeskConfig.pages.filter(
      (p) => !p.requiresAuth && !p.path.includes(':'),
    );

    for (const pageDef of publicPages) {
      await homePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      // Helpdesk public pages (login/register/verify) each render inside a
      // top-level `min-h-screen` wrapper rather than a `<main>` element. Match
      // any of: main, form, or the wrapper class shared by all helpdesk pages.
      await expect(
        page.locator('main, form, [class*="min-h-screen"]').first(),
      ).toBeVisible();
    }
  });
});
