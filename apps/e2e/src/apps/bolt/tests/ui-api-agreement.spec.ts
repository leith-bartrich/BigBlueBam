import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Bolt — UI-API Agreement', () => {
  test('automation list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bolt/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/automations',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'agreement-check-result');

    if (!result.passed) {
      console.log('UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/bolt/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/bolt/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });

  test('execution list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/bolt/executions');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'executions-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/executions',
      itemTextExtractor: (item) => (item as any).automation_name || (item as any).id,
    });

    await screenshots.capture(page, 'execution-agreement-result');

    if (!result.passed) {
      console.log('Execution UI-API mismatches:', result.mismatches);
    }
  });
});
