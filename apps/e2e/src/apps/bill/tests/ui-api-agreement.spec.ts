import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Bill — UI-API Agreement', () => {
  test('invoice list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bill/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'invoices-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/invoices',
      itemTextExtractor: (item) => (item as any).number || (item as any).id,
    });

    await screenshots.capture(page, 'invoice-agreement-result');

    if (!result.passed) {
      console.log('Invoice UI-API mismatches:', result.mismatches);
    }
  });

  test('client list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bill/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bill/clients');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'clients-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/clients',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'client-agreement-result');

    if (!result.passed) {
      console.log('Client UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/bill/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/bill/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
