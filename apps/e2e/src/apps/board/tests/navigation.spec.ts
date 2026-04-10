import { test, expect } from '../../../fixtures/base.fixture';
import { BoardHomePage } from '../pages/home.page';
import { boardConfig } from '../board.config';

test.describe('Board — Navigation', () => {
  let homePage: BoardHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BoardHomePage(page, screenshots);
  });

  test('home page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'board-home-loaded');
    await homePage.expectHomeLoaded();
    await screenshots.capture(page, 'board-content-visible');
  });

  test('templates page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToTemplates();
    await screenshots.capture(page, 'templates-page');
    await homePage.expectPath('/templates');
    await screenshots.capture(page, 'templates-verified');
  });

  test('starred page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToStarred();
    await screenshots.capture(page, 'starred-page');
    await homePage.expectPath('/starred');
    await screenshots.capture(page, 'starred-verified');
  });

  test('new board page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigate('/new');
    await screenshots.capture(page, 'new-board-page');
    await homePage.expectPath('/new');
    await screenshots.capture(page, 'new-board-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = boardConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await homePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigate('/templates');
    await homePage.navigate('/starred');
    await screenshots.capture(page, 'at-starred');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-templates');
    await homePage.expectPath('/templates');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-starred');
    await homePage.expectPath('/starred');
  });

  test('deep link to board canvas', async ({ page, screenshots, context, request }) => {
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    let boardId: string | undefined;
    try {
      const boards = await api.get<any[]>('/boards');
      if (boards.length > 0) boardId = boards[0].id;
    } catch {}

    if (boardId) {
      await page.goto(`/board/${boardId}`);
      await homePage.waitForAppReady();
      await screenshots.capture(page, 'deep-link-canvas-loaded');
      await expect(page.locator('main, canvas, [class*="canvas"]').first()).toBeVisible();
      await screenshots.capture(page, 'canvas-content-visible');
    }
  });
});
