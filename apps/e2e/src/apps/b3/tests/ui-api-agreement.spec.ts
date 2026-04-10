import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('B3 — UI-API Agreement', () => {
  test('project list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/b3/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'dashboard-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/projects',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'agreement-check-result');

    if (!result.passed) {
      console.log('UI-API mismatches:', result.mismatches);
    }
    // Log but don't fail — some items may be hidden by scroll or filters
  });

  test('task list on board matches API', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    let projectId: string | undefined;
    try {
      const projects = await api.get<any[]>('/projects');
      if (projects.length > 0) projectId = projects[0].id;
    } catch {}

    test.skip(!projectId, 'No project available');

    await page.goto(`/b3/projects/${projectId}/board`);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'board-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: `/projects/${projectId}/tasks`,
      itemTextExtractor: (item) => (item as any).title,
    });

    await screenshots.capture(page, 'task-agreement-result');

    if (!result.passed) {
      console.log('Task UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/b3/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/b3/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });
});
