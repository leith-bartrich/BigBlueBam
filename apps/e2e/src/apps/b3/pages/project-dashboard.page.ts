import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class ProjectDashboardPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async gotoProject(projectId: string): Promise<void> {
    await super.goto(`/projects/${projectId}/dashboard`);
  }

  async expectDashboardLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getWidgetCount(): Promise<number> {
    const widgets = this.page.locator('[class*="widget"], [class*="card"], [class*="chart"]');
    return widgets.count();
  }

  async navigateToBoard(projectId: string): Promise<void> {
    await this.navigate(`/projects/${projectId}/board`);
  }

  async navigateToAuditLog(projectId: string): Promise<void> {
    await this.navigate(`/projects/${projectId}/audit-log`);
  }

  async navigateToReports(projectId: string): Promise<void> {
    await this.navigate(`/projects/${projectId}/reports`);
  }
}
