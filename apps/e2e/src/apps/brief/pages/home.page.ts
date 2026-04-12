import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { briefConfig } from '../brief.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BriefHomePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, briefConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
    // Under heavy parallel load (this suite runs alongside 5 sibling
    // clusters hammering the same stack) the Brief SPA's initial auth
    // check (/b3/api/auth/me) can take 20-30 s to return. The base
    // waitForAppReady only waits for the loader spinner to hide, which
    // resolves before <main> exists in the DOM. Explicitly wait for the
    // BriefLayout <main> with a generous budget so downstream assertions
    // are stable.
    await this.page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 40_000 });
  }

  async expectHomeLoaded(): Promise<void> {
    await expect(this.page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  }

  async navigateToDocuments(): Promise<void> {
    await this.navigate('/documents');
  }

  async navigateToDocumentDetail(idOrSlug: string): Promise<void> {
    await this.navigate(`/documents/${idOrSlug}`);
  }

  async navigateToDocumentEdit(idOrSlug: string): Promise<void> {
    await this.navigate(`/documents/${idOrSlug}/edit`);
  }

  async navigateToNewDocument(): Promise<void> {
    await this.navigate('/new');
  }

  async navigateToTemplates(): Promise<void> {
    await this.navigate('/templates');
  }

  async navigateToSearch(): Promise<void> {
    await this.navigate('/search');
  }

  async navigateToStarred(): Promise<void> {
    await this.navigate('/starred');
  }

  async clickCreateDocument(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /new document|create|new/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.navigate('/new');
    }
  }

  async searchFor(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  async expectDocumentVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectDocumentNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async getDocumentCount(): Promise<number> {
    const items = this.page.locator('[class*="document"], [class*="card"], [class*="item"]');
    return items.count();
  }
}
