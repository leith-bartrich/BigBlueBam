import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { bearingConfig } from '../bearing.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BearingDashboardPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, bearingConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectDashboardLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async navigateToPeriods(): Promise<void> {
    await this.navigate('/periods');
  }

  async navigateToAtRisk(): Promise<void> {
    await this.navigate('/at-risk');
  }

  async navigateToMyGoals(): Promise<void> {
    await this.navigate('/my-goals');
  }

  async clickCreateGoal(): Promise<void> {
    await this.page.getByRole('button', { name: /create|new goal|add goal/i }).click();
  }

  async expectGoalVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectGoalNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async getGoalCount(): Promise<number> {
    const items = this.page.locator('[class*="goal"], [class*="card"], [class*="item"]');
    return items.count();
  }

  async clickGoal(title: string): Promise<void> {
    await this.page.getByText(title, { exact: false }).first().click();
    await this.waitForAppReady();
  }
}
