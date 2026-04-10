import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { beaconConfig } from '../beacon.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BeaconHomePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, beaconConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async navigateToList(): Promise<void> {
    await this.navigate('/list');
  }

  async navigateToSearch(): Promise<void> {
    await this.navigate('/search');
  }

  async navigateToCreate(): Promise<void> {
    await this.navigate('/create');
  }

  async navigateToGraph(): Promise<void> {
    await this.navigate('/graph');
  }

  async navigateToDashboard(): Promise<void> {
    await this.navigate('/dashboard');
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async clickCreateArticle(): Promise<void> {
    await this.page.getByRole('button', { name: /create|new article|new/i }).click();
  }

  async searchFor(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  async expectArticleVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectArticleNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async getArticleCount(): Promise<number> {
    const items = this.page.locator('[class*="article"], [class*="card"], [class*="item"]');
    return items.count();
  }
}
