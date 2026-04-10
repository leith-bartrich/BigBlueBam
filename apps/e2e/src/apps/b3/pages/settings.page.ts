import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class SettingsPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/settings');
  }

  async expectSettingsLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async updateDisplayName(name: string): Promise<void> {
    await this.page.getByLabel(/display name|name/i).fill(name);
    await this.page.getByRole('button', { name: /save|update/i }).click();
  }

  async selectTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.page.getByText(theme, { exact: false }).first().click();
  }
}
