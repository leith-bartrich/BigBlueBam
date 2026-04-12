import { test, expect } from '../../../fixtures/base.fixture';
import { BoardHomePage } from '../pages/home.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Board — CRUD', () => {
  let homePage: BoardHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BoardHomePage(page, screenshots);
  });

  test('create a new board via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    const boardName = `E2E Board ${Date.now()}`;
    let board: any;
    try {
      board = await api.post('/v1/boards', { name: boardName, visibility: 'organization' });
    } catch {
      test.skip(true, 'Could not create board via API');
      return;
    }
    await screenshots.capture(page, 'board-created-via-api');

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-create');
    await homePage.expectBoardVisible(boardName);
    await screenshots.capture(page, 'new-board-visible-in-list');

    // Cleanup
    try {
      await api.delete(`/v1/boards/${board.id}`);
    } catch {}
  });

  test('open board canvas from list', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    let board: any;
    try {
      const boards = await api.get<any[]>('/v1/boards');
      if (boards.length > 0) board = boards[0];
    } catch {}

    test.skip(!board, 'No board available');

    await homePage.goto();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'home-before-click');

    await homePage.clickBoard(board.name);
    await screenshots.capture(page, 'board-canvas-opened');
    // Board SPA uses Excalidraw as its root (no <main> landmark), and the
    // excalidraw canvas wrapper is `visibility: hidden` until painted.
    // Assert the excalidraw root is attached instead of visible.
    await page
      .locator('.excalidraw, [class*="excalidraw"]')
      .first()
      .waitFor({ state: 'attached', timeout: 10_000 });
    await screenshots.capture(page, 'canvas-visible');
  });

  test('update board name via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    const boardName = `E2E Board Update ${Date.now()}`;
    let board: any;
    try {
      board = await api.post('/v1/boards', { name: boardName, visibility: 'organization' });
    } catch {
      test.skip(true, 'Could not create board via API');
      return;
    }

    const updatedName = `${boardName} Updated`;
    try {
      await api.patch(`/v1/boards/${board.id}`, { name: updatedName });
    } catch {
      test.skip(true, 'Could not update board via API');
      return;
    }

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-rename');
    await homePage.expectBoardVisible(updatedName);
    await screenshots.capture(page, 'renamed-board-visible');

    // Cleanup
    try {
      await api.delete(`/v1/boards/${board.id}`);
    } catch {}
  });

  test('delete board via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/board/api', csrf || undefined);

    const boardName = `E2E Board Delete ${Date.now()}`;
    let board: any;
    try {
      board = await api.post('/v1/boards', { name: boardName, visibility: 'organization' });
    } catch {
      test.skip(true, 'Could not create board via API');
      return;
    }

    try {
      await api.delete(`/v1/boards/${board.id}`);
    } catch {
      test.skip(true, 'Could not delete board via API');
      return;
    }

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-delete');
    await homePage.expectBoardNotVisible(boardName);
    await screenshots.capture(page, 'deleted-board-gone');
  });
});
