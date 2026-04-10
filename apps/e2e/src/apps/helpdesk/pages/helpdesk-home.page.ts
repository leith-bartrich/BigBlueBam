import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { helpdeskConfig } from '../helpdesk.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class HelpdeskHomePage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, helpdeskConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/tickets');
  }

  async gotoLogin(): Promise<void> {
    await super.goto('/login');
  }

  async gotoRegister(): Promise<void> {
    await super.goto('/register');
  }

  async gotoVerify(): Promise<void> {
    await super.goto('/verify');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.locator('main, [class*="content"]').first()).toBeVisible();
  }

  async navigateToTickets(): Promise<void> {
    await this.navigate('/tickets');
  }

  async navigateToNewTicket(): Promise<void> {
    await this.navigate('/tickets/new');
  }

  async navigateToTicketDetail(id: string): Promise<void> {
    await this.navigate(`/tickets/${id}`);
  }

  async clickCreateTicket(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /new ticket|create ticket|new|submit/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.navigate('/tickets/new');
    }
  }

  async fillTicketSubject(subject: string): Promise<void> {
    await this.page.getByLabel(/subject|title/i).first().fill(subject);
  }

  async fillTicketDescription(description: string): Promise<void> {
    const field = this.page.getByLabel(/description|message|details/i).first();
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(description);
    }
  }

  async clickSubmitTicket(): Promise<void> {
    await this.page
      .getByRole('button', { name: /submit|create|send/i })
      .first()
      .click();
  }

  async expectTicketVisible(subject: string): Promise<void> {
    await expect(this.page.getByText(subject, { exact: false }).first()).toBeVisible();
  }

  async expectTicketNotVisible(subject: string): Promise<void> {
    await expect(this.page.getByText(subject, { exact: false })).not.toBeVisible();
  }

  async getTicketCount(): Promise<number> {
    const rows = this.page.locator('[class*="ticket"], [class*="row"], tbody tr');
    return rows.count();
  }

  // Helpdesk-specific login helper. Helpdesk has its own auth system
  // separate from B3, so tests that need an authenticated session should
  // call this rather than relying on B3 storage state.
  async loginWithCredentials(email: string, password: string): Promise<void> {
    await this.gotoLogin();
    await this.page.getByLabel(/email/i).first().fill(email);
    await this.page.getByLabel(/password/i).first().fill(password);
    await this.page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
    await this.page.waitForTimeout(1000);
    await this.waitForAppReady();
  }

  async expectLoginPage(): Promise<void> {
    await expect(this.page.getByLabel(/email/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByLabel(/password/i).first()).toBeVisible();
  }

  async expectRegisterPage(): Promise<void> {
    await expect(this.page.getByLabel(/email/i).first()).toBeVisible({ timeout: 10_000 });
  }
}
