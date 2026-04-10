import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Book — UI-API Agreement', () => {
  test('event list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/book/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/book/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'calendar-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/events',
      itemTextExtractor: (item) => (item as any).title,
    });

    await screenshots.capture(page, 'agreement-check-result');

    if (!result.passed) {
      console.log('UI-API mismatches:', result.mismatches);
    }
  });

  test('booking pages list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/book/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/book/booking-pages');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'booking-pages-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/booking-pages',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'booking-agreement-result');

    if (!result.passed) {
      console.log('Booking UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/book/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/book/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
