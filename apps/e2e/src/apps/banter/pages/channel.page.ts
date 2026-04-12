import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { banterConfig } from '../banter.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class ChannelPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, banterConfig, screenshots);
  }

  async goto(channelSlug?: string): Promise<void> {
    if (channelSlug) {
      await super.goto(`/channels/${channelSlug}`);
    } else {
      await super.goto('/');
    }
    // Wait for the Banter SPA shell to fully mount (may be slow under load)
    await this.page.locator('main, [class*="message"], [class*="channel"]').first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {});
  }

  async expectChannelLoaded(): Promise<void> {
    await expect(this.page.locator('main, [class*="message"], [class*="channel"]').first()).toBeVisible({ timeout: 30_000 });
  }

  async sendMessage(content: string): Promise<void> {
    const composer = this.page.locator('[class*="compose"], [class*="editor"], textarea, [contenteditable]').last();
    await composer.waitFor({ state: 'visible', timeout: 30_000 });
    await composer.click();
    await this.page.keyboard.type(content);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async expectMessageVisible(content: string): Promise<void> {
    await expect(this.page.getByText(content, { exact: false }).first()).toBeVisible();
  }

  async getMessageCount(): Promise<number> {
    return this.page.locator('[class*="message-row"], [class*="message-item"]').count();
  }

  async clickBrowseChannels(): Promise<void> {
    await this.page.getByText(/browse/i).first().click();
    await this.waitForAppReady();
  }

  async openSearch(): Promise<void> {
    await this.navigate('/search');
  }

  async openBookmarks(): Promise<void> {
    await this.navigate('/bookmarks');
  }

  async openSettings(): Promise<void> {
    await this.navigate('/settings');
  }
}
