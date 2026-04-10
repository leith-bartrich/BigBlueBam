import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class MyWorkPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/my-work');
  }

  async expectMyWorkLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getAssignedTaskCount(): Promise<number> {
    const tasks = this.page.locator('[class*="task"], tr').filter({ hasText: /.+/ });
    return tasks.count();
  }

  async clickTask(title: string): Promise<void> {
    await this.page.getByText(title, { exact: false }).first().click();
    await this.waitForAppReady();
  }
}
