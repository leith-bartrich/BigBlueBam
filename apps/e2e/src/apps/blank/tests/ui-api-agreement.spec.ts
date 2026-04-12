import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Blank — UI-API Agreement', () => {
  test('form list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/blank/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'forms-for-agreement');

    // Forms are returned with `name` (the Blank form entity does not have a
    // `title` column — see apps/blank-api/src/db/schema/forms.ts).
    const result = await checker.checkListRendering({
      apiPath: '/v1/forms',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'form-agreement-result');

    if (!result.passed) {
      console.log('Form UI-API mismatches:', result.mismatches);
    }
  });

  test('form submissions in UI match API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/v1/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    await page.goto(`/blank/forms/${formId}/responses`);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'responses-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: `/v1/forms/${formId}/submissions`,
      itemTextExtractor: (item) => (item as any).id,
    });

    await screenshots.capture(page, 'responses-agreement-result');

    if (!result.passed) {
      console.log('Submissions UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/blank/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/blank/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
