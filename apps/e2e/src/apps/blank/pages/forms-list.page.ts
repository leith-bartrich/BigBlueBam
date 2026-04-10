import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { blankConfig } from '../blank.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class FormsListPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, blankConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectFormsListLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getFormCount(): Promise<number> {
    const items = this.page.locator('[class*="form"], [class*="card"], [class*="row"], tbody tr');
    return items.count();
  }

  async clickCreateForm(): Promise<void> {
    await this.page.getByRole('button', { name: /create form|new form/i }).click();
  }

  async expectFormVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectFormNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async clickForm(title: string): Promise<void> {
    await this.page.getByText(title, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async navigateToNewForm(): Promise<void> {
    await this.navigate('/forms/new');
  }
}
