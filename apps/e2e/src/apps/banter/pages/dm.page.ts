import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { banterConfig } from '../banter.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class DmPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, banterConfig, screenshots);
  }

  async gotoDm(dmId: string): Promise<void> {
    await super.goto(`/dm/${dmId}`);
  }

  async expectDmLoaded(): Promise<void> {
    await expect(this.page.locator('main, [class*="message"]').first()).toBeVisible();
  }

  async sendMessage(content: string): Promise<void> {
    const composer = this.page.locator('[class*="compose"], textarea, [contenteditable]').last();
    await composer.click();
    await this.page.keyboard.type(content);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async expectMessageVisible(content: string): Promise<void> {
    await expect(this.page.getByText(content, { exact: false }).first()).toBeVisible();
  }
}
