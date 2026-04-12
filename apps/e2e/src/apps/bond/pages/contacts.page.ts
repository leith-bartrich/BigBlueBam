import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { bondConfig } from '../bond.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class ContactsPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, bondConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/contacts');
    // Wait for the contacts list to finish loading (table renders or empty state text appears)
    await this.page
      .locator('table tbody tr, h3:has-text("No contacts found")')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  async expectContactsLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getContactCount(): Promise<number> {
    const rows = this.page.locator('tbody tr, [class*="contact-row"], [class*="contact-item"]').filter({ hasText: /.+/ });
    return rows.count();
  }

  async clickContact(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async clickCreateContact(): Promise<void> {
    await this.page.getByRole('button', { name: /create contact|new contact|add contact/i }).click();
  }

  async expectContactVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectContactNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async searchContacts(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder(/search/i).first();
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async navigateToCompanies(): Promise<void> {
    await this.navigate('/companies');
  }
}
