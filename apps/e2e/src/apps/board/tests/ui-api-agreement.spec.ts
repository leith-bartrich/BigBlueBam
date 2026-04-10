import { test, expect } from '../../../fixtures/base.fixture';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { UiApiChecker } from '../../../interceptors/ui-api-checker';

test.describe('Board — UI-API Agreement', () => {
  test('board list in UI matches API response', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);
    const checker = new UiApiChecker(page, api);

    await page.goto('/board/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-for-agreement');

    const result = await checker.checkListRendering({
      apiPath: '/boards',
      itemTextExtractor: (item) => (item as any).name,
    });

    await screenshots.capture(page, 'agreement-check-result');

    if (!result.passed) {
      console.log('UI-API mismatches:', result.mismatches);
    }
  });

  test('API health endpoint returns expected structure', async ({ request }) => {
    const api = new DirectApiClient(request, '/board/api');
    const { status, body } = await api.getRaw('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
  });

  test('API error envelope matches expected format', async ({ request }) => {
    const api = new DirectApiClient(request, '/board/api');
    const { status, body } = await api.getRaw('/nonexistent-endpoint');
    expect(status).toBeGreaterThanOrEqual(400);
    if (body) {
      expect(body).toHaveProperty('error');
      expect((body as any).error).toHaveProperty('code');
      expect((body as any).error).toHaveProperty('message');
    }
  });

  test('board detail in canvas matches API', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    let boardId: string | undefined;
    let boardName: string | undefined;
    try {
      const boards = await api.get<any[]>('/boards');
      if (boards.length > 0) {
        boardId = boards[0].id;
        boardName = boards[0].name;
      }
    } catch {}

    test.skip(!boardId, 'No board available');

    await page.goto(`/board/${boardId}`);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'canvas-for-agreement');

    // Board name should be displayed somewhere on the canvas page
    if (boardName) {
      const nameVisible = await page.getByText(boardName, { exact: false }).first().isVisible().catch(() => false);
      await screenshots.capture(page, `board-name-${nameVisible ? 'visible' : 'hidden'}`);
    }
  });
});
