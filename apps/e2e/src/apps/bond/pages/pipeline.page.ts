import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { bondConfig } from '../bond.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class PipelinePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, bondConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async gotoPipeline(pipelineId: string): Promise<void> {
    await super.goto(`/pipelines/${pipelineId}`);
  }

  async expectPipelineLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
    await this.waitForAppReady();
  }

  // --- Stage Columns ---

  getStageColumns(): Locator {
    return this.page.locator('[class*="column"], [class*="stage"], [data-stage]');
  }

  async getStageColumnNames(): Promise<string[]> {
    const headers = this.page.locator(
      '[class*="column"] h2, [class*="column"] h3, [class*="stage"] h2, [class*="stage"] h3',
    );
    return headers.allTextContents();
  }

  // --- Deals ---

  getDealCards(): Locator {
    return this.page.locator('[class*="deal-card"], [class*="deal"], [class*="card"]').filter({ hasText: /.+/ });
  }

  async getDealCount(): Promise<number> {
    return this.getDealCards().count();
  }

  async clickDeal(title: string): Promise<void> {
    await this.page.getByText(title, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async expectDealVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectDealNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async clickCreateDeal(): Promise<void> {
    await this.page.getByRole('button', { name: /create deal|new deal|add deal/i }).click();
  }

  // --- Navigation ---

  async navigateToContacts(): Promise<void> {
    await this.navigate('/contacts');
  }

  async navigateToCompanies(): Promise<void> {
    await this.navigate('/companies');
  }

  async navigateToAnalytics(): Promise<void> {
    await this.navigate('/analytics');
  }

  async navigateToPipelineSettings(): Promise<void> {
    await this.navigate('/settings/pipelines');
  }

  async navigateToCustomFields(): Promise<void> {
    await this.navigate('/settings/fields');
  }

  async navigateToLeadScoring(): Promise<void> {
    await this.navigate('/settings/scoring');
  }

  // --- Filters ---

  async openFilterPanel(): Promise<void> {
    await this.page.getByRole('button', { name: /filter/i }).first().click();
  }

  async searchDeals(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder(/search/i).first();
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }
}
