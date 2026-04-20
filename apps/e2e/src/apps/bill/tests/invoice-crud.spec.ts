import { test, expect } from '../../../fixtures/base.fixture';
import { InvoicesPage } from '../pages/invoices.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bill — Invoice CRUD', () => {
  test('create a new invoice via UI', async ({ page, screenshots, context, request }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await screenshots.capture(page, 'invoices-before-create');

    // The Bill /invoices/new page is a full page (not a dialog) and only
    // requires a client selection — there is no separate due-date input,
    // and the submit button is "Create Draft Invoice".
    await invoicesPage.clickCreateInvoice();
    await page.waitForURL(/\/bill\/invoices\/new/);
    await screenshots.capture(page, 'invoice-new-page');

    // Pre-seed a client via API so the <select> always has at least one option.
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);

    let clients = await api.get<any[]>('/v1/clients').catch(() => [] as any[]);
    if (!clients.length) {
      await api.post('/v1/clients', { name: `E2E Seed Client ${Date.now()}` });
      // Bill list pages cache via TanStack Query — reload so the SPA picks
      // it up before we touch the <select>.
      await page.reload();
      await page.waitForURL(/\/bill\/invoices\/new/);
      clients = await api.get<any[]>('/v1/clients').catch(() => [] as any[]);
    }

    const clientSelect = page.getByRole('main').locator('select').first();
    await expect(clientSelect).toBeVisible();
    // The first <option> is the placeholder ("Select a client..."), so we
    // pick by index 1 to ensure a real client value is chosen.
    await clientSelect.selectOption({ index: 1 });
    await screenshots.capture(page, 'client-selected');

    // Submit
    const createBtn = page
      .getByRole('main')
      .getByRole('button', { name: /create draft invoice/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();
    await screenshots.capture(page, 'invoice-create-clicked');

    // After a successful create the SPA navigates to /invoices/:id
    await page.waitForURL(/\/bill\/invoices\/[0-9a-f-]{36}/, { timeout: 5000 });
    await screenshots.capture(page, 'invoice-created');

    // Verify via API
    const { status } = await api.getRaw('/v1/invoices');
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
    await page.waitForURL(/\/bill\/invoices\/new/);
    await screenshots.capture(page, 'invoice-new-page-open');

    // The Bill new-invoice page does not surface a `text-red-500` /
    // `[role="alert"]` validation message — instead it disables the
    // "Create Draft Invoice" submit button until a client is selected
    // (the SPA also short-circuits with `if (!clientId) return;`).
    // Assert that disabled state, which is the SPA's actual contract.
    const createBtn = page
      .getByRole('main')
      .getByRole('button', { name: /create draft invoice/i });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeDisabled();
    await screenshots.capture(page, 'create-button-disabled-no-client');
  });

  test('invoice detail page loads for existing invoice', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);

    let invoiceId: string | undefined;
    try {
      const invoices = await api.get<any[]>('/v1/invoices');
      if (invoices.length > 0) invoiceId = invoices[0].id;
    } catch {}

    test.skip(!invoiceId, 'No invoice available');

    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.navigate(`/invoices/${invoiceId}`);
    await screenshots.capture(page, 'invoice-detail-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'invoice-detail-content');
  });
});
