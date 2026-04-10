import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class DashboardPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectDashboardLoaded(): Promise<void> {
    // Dashboard should show project list or welcome state
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getProjectCount(): Promise<number> {
    const cards = this.page.locator('[class*="project"], [class*="card"]');
    return cards.count();
  }

  async clickProject(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async clickCreateProject(): Promise<void> {
    await this.page.getByRole('button', { name: /create project|new project/i }).click();
  }

  async expectProjectVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectProjectNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async navigateToMyWork(): Promise<void> {
    await this.page.getByText('My Work', { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async navigateToPeople(): Promise<void> {
    await this.navigate('/people');
  }
}
