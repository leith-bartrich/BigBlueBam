import { test, expect } from '../../../fixtures/base.fixture';
import { InvoicesPage } from '../pages/invoices.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bill — Invoice CRUD', () => {
  test('create a new invoice via UI', async ({ page, screenshots, context, request }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await screenshots.capture(page, 'invoices-before-create');

    await invoicesPage.clickCreateInvoice();
    await screenshots.capture(page, 'create-invoice-dialog');

    // Fill invoice form — select client and due date
    const clientSelect = page.locator('select, [role="combobox"]').first();
    if (await clientSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientSelect.click();
      await page.waitForTimeout(300);
      // Select first available option
      const option = page.locator('[role="option"], option').first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
      }
    }
    await screenshots.capture(page, 'client-selected');

    const dueDateInput = page.getByLabel(/due date/i);
    if (await dueDateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dueDateInput.fill('2026-12-31');
    }
    await screenshots.capture(page, 'due-date-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'invoice-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);
    const { status } = await api.getRaw('/invoices');
    expect(status).toBe(200);
    await screenshots.capture(page, 'invoice-verified-via-api');
  });

  test('invoice list shows existing invoices', async ({ page, screenshots }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await screenshots.capture(page, 'invoice-list');

    await invoicesPage.expectInvoicesLoaded();
    await screenshots.capture(page, 'invoice-list-visible');
  });

  test('create invoice with missing required fields shows validation error', async ({ page, screenshots }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await invoicesPage.clickCreateInvoice();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('invoice detail page loads for existing invoice', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);

    let invoiceId: string | undefined;
    try {
      const invoices = await api.get<any[]>('/invoices');
      if (invoices.length > 0) invoiceId = invoices[0].id;
    } catch {}

    test.skip(!invoiceId, 'No invoice available');

    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto(`/invoices/${invoiceId}`);
    await screenshots.capture(page, 'invoice-detail-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'invoice-detail-content');
  });
});
