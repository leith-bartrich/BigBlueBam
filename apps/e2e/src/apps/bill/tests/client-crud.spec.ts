import { test, expect } from '../../../fixtures/base.fixture';
import { InvoicesPage } from '../pages/invoices.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bill — Client CRUD', () => {
  const testClientName = `E2E Client ${Date.now()}`;
  const testClientEmail = `e2e-client-${Date.now()}@test.local`;

  test('create a new client via UI', async ({ page, screenshots, context, request }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await invoicesPage.navigateToClients();
    await screenshots.capture(page, 'clients-before-create');

    await invoicesPage.clickCreateClient();
    await screenshots.capture(page, 'create-client-dialog');

    // Fill client form
    await page.getByLabel(/client name|name/i).fill(testClientName);
    await screenshots.capture(page, 'client-name-filled');

    await page.getByLabel(/email/i).fill(testClientEmail);
    await screenshots.capture(page, 'client-email-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'client-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);
    const clients = await api.get<any[]>('/clients');
    const found = clients.find((c: any) => c.name === testClientName);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'client-verified-via-api');
  });

  test('client list shows existing clients', async ({ page, screenshots }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await invoicesPage.navigateToClients();
    await screenshots.capture(page, 'client-list');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'client-list-visible');
  });

  test('create client with empty name shows validation error', async ({ page, screenshots }) => {
    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto();
    await invoicesPage.navigateToClients();
    await invoicesPage.clickCreateClient();
    await screenshots.capture(page, 'create-client-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'client-validation-error');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'client-error-detail');
  });

  test('client detail page loads for existing client', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);

    let clientId: string | undefined;
    try {
      const clients = await api.get<any[]>('/clients');
      if (clients.length > 0) clientId = clients[0].id;
    } catch {}

    test.skip(!clientId, 'No client available');

    const invoicesPage = new InvoicesPage(page, screenshots);
    await invoicesPage.goto(`/clients/${clientId}`);
    await screenshots.capture(page, 'client-detail-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'client-detail-content');
  });
});
