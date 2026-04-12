import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { blastConfig } from '../blast.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class CampaignsPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, blastConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectCampaignsLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getCampaignCount(): Promise<number> {
    const rows = this.page.locator('[class*="campaign"], [class*="row"], tbody tr');
    return rows.count();
  }

  async clickCreateCampaign(): Promise<void> {
    await this.page
      .getByRole('main')
      .getByRole('button', { name: /create campaign|new campaign/i })
      .click();
  }

  async expectCampaignVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async clickCampaign(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async navigateToTemplates(): Promise<void> {
    await this.navigate('/templates');
  }

  async navigateToNewTemplate(): Promise<void> {
    await this.navigate('/templates/new');
  }

  async navigateToSegments(): Promise<void> {
    await this.navigate('/segments');
  }

  async navigateToNewSegment(): Promise<void> {
    await this.navigate('/segments/new');
  }

  async navigateToAnalytics(): Promise<void> {
    await this.navigate('/analytics');
  }

  async navigateToDomainSettings(): Promise<void> {
    await this.navigate('/settings/domains');
  }

  async navigateToSmtpSettings(): Promise<void> {
    await this.navigate('/settings/smtp');
  }

  async navigateToNewCampaign(): Promise<void> {
    await this.navigate('/campaigns/new');
  }

  async clickCreateTemplate(): Promise<void> {
    await this.page
      .getByRole('main')
      .getByRole('button', { name: /create template|new template/i })
      .click();
  }

  async clickCreateSegment(): Promise<void> {
    await this.page.getByRole('button', { name: /create segment|new segment/i }).click();
  }
}
