import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { benchConfig } from '../bench.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BenchDashboardListPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, benchConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectDashboardListLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async navigateToExplorer(): Promise<void> {
    await this.navigate('/explorer');
  }

  async navigateToReports(): Promise<void> {
    await this.navigate('/reports');
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async clickCreateDashboard(): Promise<void> {
    await this.page
      .getByRole('main')
      .getByRole('button', { name: /new dashboard/i })
      .click();
  }

  async expectDashboardVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectDashboardNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async getDashboardCount(): Promise<number> {
    const items = this.page.locator('[class*="dashboard"], [class*="card"], [class*="item"]');
    return items.count();
  }

  async clickDashboard(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }
}
