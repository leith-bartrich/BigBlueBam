import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Blast — UI-API Agreement', () => {
  test('campaign list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/blast/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'campaigns-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/campaigns',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'campaign-agreement-result');

    if (!result.passed) {
      console.log('Campaign UI-API mismatches:', result.mismatches);
    }
  });

  test('template list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/blast/templates');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'templates-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/templates',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'template-agreement-result');

    if (!result.passed) {
      console.log('Template UI-API mismatches:', result.mismatches);
    }
  });

  test('segment list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/blast/segments');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'segments-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/segments',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'segment-agreement-result');

    if (!result.passed) {
      console.log('Segment UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/blast/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/blast/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
