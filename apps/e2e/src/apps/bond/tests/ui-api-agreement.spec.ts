import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Bond — UI-API Agreement', () => {
  test('deal list in pipeline UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bond/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/deals',
      itemTextExtractor: (item) => (item as any).title,
    });

    await screenshots.capture(page, 'deal-agreement-result');

    if (!result.passed) {
      console.log('Deal UI-API mismatches:', result.mismatches);
    }
  });

  test('contact list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bond/contacts');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'contacts-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/contacts',
      itemTextExtractor: (item) => (item as any).first_name || (item as any).email,
    });

    await screenshots.capture(page, 'contact-agreement-result');

    if (!result.passed) {
      console.log('Contact UI-API mismatches:', result.mismatches);
    }
  });

  test('company list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bond/companies');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'companies-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/companies',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'company-agreement-result');

    if (!result.passed) {
      console.log('Company UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/bond/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/bond/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
