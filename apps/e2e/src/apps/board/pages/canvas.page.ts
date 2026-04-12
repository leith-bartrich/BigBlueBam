import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { boardConfig } from '../board.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class CanvasPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, boardConfig, screenshots);
  }

  async gotoBoard(boardId: string): Promise<void> {
    await super.goto(`/${boardId}`);
  }

  async expectCanvasLoaded(): Promise<void> {
    // Excalidraw renders a `<div class="excalidraw__canvas-wrapper">` with
    // `visibility: hidden` until its inner <canvas> paints, and the Board
    // SPA deliberately does NOT render a `<main>` landmark (the entire
    // Excalidraw root occupies <body>). The stable contract for "canvas
    // has mounted" is that the excalidraw root element is attached.
    await this.page
      .locator('.excalidraw, [class*="excalidraw"]')
      .first()
      .waitFor({ state: 'attached', timeout: 10_000 });
    await this.waitForAppReady();
  }

  // --- Canvas ---

  getCanvas(): Locator {
    // Excalidraw mounts the actual canvas inside `.excalidraw__canvas-wrapper`
    // — but that wrapper has `visibility: hidden` set on its computed style
    // until the canvas paints, which causes Playwright's actionability check
    // (`element is not visible`) to fail any click/dblclick on it. The inner
    // <canvas> element has its own bounding box and IS visible to the
    // browser; prefer that. Fall back to the wrapper for boards that haven't
    // mounted Excalidraw yet (e.g. legacy whiteboard divs).
    return this.page.locator('.excalidraw canvas, canvas, [class*="whiteboard"]').first();
  }

  async clickOnCanvas(x: number, y: number): Promise<void> {
    const canvas = this.getCanvas();
    // Excalidraw's canvas wrapper sometimes still reports `visibility: hidden`
    // on the wrapper element even once the inner <canvas> has painted, so
    // bypass actionability with `force: true`. Excalidraw listens to native
    // pointer events on the canvas itself and dispatches to its internal
    // event system, so a forced Playwright click is sufficient to register.
    await canvas.click({ position: { x, y }, force: true });
  }

  async doubleClickOnCanvas(x: number, y: number): Promise<void> {
    const canvas = this.getCanvas();
    await canvas.dblclick({ position: { x, y }, force: true });
  }

  // --- Elements ---

  getElements(): Locator {
    return this.page.locator('[class*="element"], [class*="shape"], [data-element]');
  }

  async getElementCount(): Promise<number> {
    return this.getElements().count();
  }

  async selectElement(index: number): Promise<void> {
    await this.getElements().nth(index).click();
    await this.page.waitForTimeout(300);
  }

  async deleteSelectedElement(): Promise<void> {
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(300);
  }

  // --- Toolbar ---

  async selectTool(toolName: string): Promise<void> {
    await this.page
      .getByRole('button', { name: new RegExp(toolName, 'i') })
      .click();
    await this.page.waitForTimeout(200);
  }

  // --- Zoom ---

  async zoomIn(): Promise<void> {
    const zoomIn = this.page.getByRole('button', { name: /zoom in|\+/i }).first();
    if (await zoomIn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await zoomIn.click();
    }
  }

  async zoomOut(): Promise<void> {
    const zoomOut = this.page.getByRole('button', { name: /zoom out|-/i }).first();
    if (await zoomOut.isVisible({ timeout: 2000 }).catch(() => false)) {
      await zoomOut.click();
    }
  }

  // --- Versions ---

  async navigateToVersions(boardId: string): Promise<void> {
    await this.navigate(`/${boardId}/versions`);
  }
}
