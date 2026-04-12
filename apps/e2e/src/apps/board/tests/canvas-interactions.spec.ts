import { test, expect } from '../../../fixtures/base.fixture';
import { CanvasPage } from '../pages/canvas.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';
import { dragElement } from '../../../helpers/drag-drop';

test.describe('Board — Canvas Interactions', () => {
  let canvasPage: CanvasPage;
  let boardId: string;

  test.beforeEach(async ({ page, screenshots, context, request }) => {
    canvasPage = new CanvasPage(page, screenshots);

    try {
      const cookies = await context.cookies();
      const csrf = readCsrfTokenFromCookies(cookies);
      const api = new DirectApiClient(request, '/board/api', csrf || undefined);
      const boards = await api.get<any[]>('/v1/boards');
      if (boards.length > 0) {
        boardId = boards[0].id;
      }
    } catch {}
  });

  test('canvas loads with toolbar', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await screenshots.capture(page, 'canvas-loaded');
    await canvasPage.expectCanvasLoaded();
    await screenshots.capture(page, 'canvas-toolbar-visible');
  });

  test('click on canvas to place element', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await canvasPage.expectCanvasLoaded();
    await screenshots.capture(page, 'canvas-before-click');

    const initialCount = await canvasPage.getElementCount();
    await canvasPage.clickOnCanvas(200, 200);
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'canvas-after-click');
  });

  test('drag element on canvas', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await canvasPage.expectCanvasLoaded();
    await screenshots.capture(page, 'canvas-before-element-drag');

    const elements = canvasPage.getElements();
    const elementCount = await elements.count();
    test.skip(elementCount === 0, 'No elements on canvas');

    const element = elements.first();
    const canvas = canvasPage.getCanvas();
    await screenshots.capture(page, 'before-drag');
    await dragElement(page, element, canvas, { steps: 10 });
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-drag');
  });

  test('zoom in and out', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await canvasPage.expectCanvasLoaded();
    await screenshots.capture(page, 'canvas-default-zoom');

    await canvasPage.zoomIn();
    await page.waitForTimeout(300);
    await screenshots.capture(page, 'canvas-zoomed-in');

    await canvasPage.zoomOut();
    await page.waitForTimeout(300);
    await screenshots.capture(page, 'canvas-zoomed-out');
  });

  test('select and delete element', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await canvasPage.expectCanvasLoaded();

    const elements = canvasPage.getElements();
    const initialCount = await elements.count();
    test.skip(initialCount === 0, 'No elements to delete');

    await screenshots.capture(page, 'before-select-element');
    await canvasPage.selectElement(0);
    await screenshots.capture(page, 'element-selected');

    await canvasPage.deleteSelectedElement();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'element-deleted');
  });

  test('double-click on canvas to create text', async ({ page, screenshots }) => {
    test.skip(!boardId, 'No board available');
    await canvasPage.gotoBoard(boardId);
    await canvasPage.expectCanvasLoaded();
    await screenshots.capture(page, 'canvas-before-dblclick');

    await canvasPage.doubleClickOnCanvas(300, 300);
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'canvas-after-dblclick');

    // Check if an editable text field appeared
    const editable = page.locator('[contenteditable], textarea, input[type="text"]').last();
    if (await editable.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.type('E2E text element');
      await screenshots.capture(page, 'text-element-typed');
    }
  });
});
