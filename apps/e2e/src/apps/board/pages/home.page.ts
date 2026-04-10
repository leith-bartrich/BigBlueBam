import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { boardConfig } from '../board.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BoardHomePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, boardConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getBoardCount(): Promise<number> {
    const cards = this.page.locator('[class*="board"], [class*="card"]').filter({ hasText: /.+/ });
    return cards.count();
  }

  async clickBoard(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async clickCreateBoard(): Promise<void> {
    await this.page.getByRole('button', { name: /create board|new board/i }).click();
  }

  async expectBoardVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectBoardNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async navigateToTemplates(): Promise<void> {
    await this.navigate('/templates');
  }

  async navigateToStarred(): Promise<void> {
    await this.navigate('/starred');
  }
}
