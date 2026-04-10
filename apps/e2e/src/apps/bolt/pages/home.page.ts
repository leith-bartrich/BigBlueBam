import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { boltConfig } from '../bolt.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BoltHomePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, boltConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getAutomationCount(): Promise<number> {
    const rows = this.page.locator('[class*="automation"], [class*="card"], tbody tr').filter({ hasText: /.+/ });
    return rows.count();
  }

  async clickAutomation(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async clickCreateAutomation(): Promise<void> {
    await this.page.getByRole('button', { name: /create automation|new automation/i }).click();
  }

  async expectAutomationVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectAutomationNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async navigateToExecutions(): Promise<void> {
    await this.navigate('/executions');
  }

  async navigateToTemplates(): Promise<void> {
    await this.navigate('/templates');
  }

  async navigateToNewAutomation(): Promise<void> {
    await this.navigate('/new');
  }
}
