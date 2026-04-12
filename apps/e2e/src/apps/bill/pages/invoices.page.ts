import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { billConfig } from '../bill.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class InvoicesPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, billConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
  }

  async expectInvoicesLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getInvoiceCount(): Promise<number> {
    const rows = this.page.locator('[class*="invoice"], [class*="row"], tbody tr');
    return rows.count();
  }

  async clickCreateInvoice(): Promise<void> {
    // Both the sidebar and the page header expose a "New Invoice" button —
    // scope to the page's <main> region to avoid a strict-mode violation.
    await this.page
      .getByRole('main')
      .getByRole('button', { name: /create invoice|new invoice/i })
      .click();
  }

  async expectInvoiceVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible();
  }

  async navigateToClients(): Promise<void> {
    await this.navigate('/clients');
  }

  async navigateToExpenses(): Promise<void> {
    await this.navigate('/expenses');
  }

  async navigateToRates(): Promise<void> {
    await this.navigate('/rates');
  }

  async navigateToReports(): Promise<void> {
    await this.navigate('/reports');
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async navigateToNewInvoice(): Promise<void> {
    await this.navigate('/invoices/new');
  }

  async navigateToFromTime(): Promise<void> {
    await this.navigate('/invoices/from-time');
  }

  async clickCreateClient(): Promise<void> {
    // Bill's Clients page uses an inline form toggle, so the same page contains
    // both a "New Client" toggle button and (after expansion) a "Create Client"
    // submit button. Click only the toggle to open the form.
    await this.page
      .getByRole('main')
      .getByRole('button', { name: /^new client$/i })
      .click();
  }

  async clickCreateExpense(): Promise<void> {
    await this.page.getByRole('button', { name: /create expense|new expense|add expense/i }).click();
  }
}
