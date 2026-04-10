import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class PeoplePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/people');
  }

  async expectPeopleLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getUserCount(): Promise<number> {
    const rows = this.page.locator('table tbody tr, [class*="user-row"], [class*="member"]');
    return rows.count();
  }

  async clickUser(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async inviteUser(email: string): Promise<void> {
    await this.page.getByRole('button', { name: /invite|add/i }).click();
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByRole('button', { name: /send|invite/i }).last().click();
  }
}
