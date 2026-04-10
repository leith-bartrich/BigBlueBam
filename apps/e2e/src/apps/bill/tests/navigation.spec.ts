import { test, expect } from '../../../fixtures/base.fixture';
import { InvoicesPage } from '../pages/invoices.page';
import { billConfig } from '../bill.config';

test.describe('Bill — Navigation', () => {
  let invoicesPage: InvoicesPage;

  test.beforeEach(async ({ page, screenshots }) => {
    invoicesPage = new InvoicesPage(page, screenshots);
  });

  test('invoices page loads after login', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await screenshots.capture(page, 'invoices-loaded');
    await invoicesPage.expectInvoicesLoaded();
    await screenshots.capture(page, 'invoices-content-visible');
  });

  test('navigate to Clients', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToClients();
    await screenshots.capture(page, 'clients-page');
    await invoicesPage.expectPath('/clients');
    await screenshots.capture(page, 'clients-url-verified');
  });

  test('navigate to Expenses', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToExpenses();
    await screenshots.capture(page, 'expenses-page');
    await invoicesPage.expectPath('/expenses');
    await screenshots.capture(page, 'expenses-url-verified');
  });

  test('navigate to Rates', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToRates();
    await screenshots.capture(page, 'rates-page');
    await invoicesPage.expectPath('/rates');
    await screenshots.capture(page, 'rates-url-verified');
  });

  test('navigate to Reports', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToReports();
    await screenshots.capture(page, 'reports-page');
    await invoicesPage.expectPath('/reports');
    await screenshots.capture(page, 'reports-url-verified');
  });

  test('navigate to Settings', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToSettings();
    await screenshots.capture(page, 'settings-page');
    await invoicesPage.expectPath('/settings');
    await screenshots.capture(page, 'settings-url-verified');
  });

  test('navigate to New Invoice', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToNewInvoice();
    await screenshots.capture(page, 'new-invoice-page');
    await invoicesPage.expectPath('/invoices/new');
    await screenshots.capture(page, 'new-invoice-url-verified');
  });

  test('navigate to From Time', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await invoicesPage.navigateToFromTime();
    await screenshots.capture(page, 'from-time-page');
    await invoicesPage.expectPath('/invoices/from-time');
    await screenshots.capture(page, 'from-time-url-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = billConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await invoicesPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await invoicesPage.goto();
    await screenshots.capture(page, 'start-at-invoices');

    await invoicesPage.navigate('/clients');
    await screenshots.capture(page, 'navigated-to-clients');

    await invoicesPage.navigate('/expenses');
    await screenshots.capture(page, 'navigated-to-expenses');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await invoicesPage.expectPath('/clients');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await invoicesPage.expectPath('/expenses');
  });
});
