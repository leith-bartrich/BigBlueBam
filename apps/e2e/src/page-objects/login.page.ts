import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import type { AppConfig } from '../registry/types';
import type { ScreenshotCollector } from '../helpers/screenshot';

const loginAppConfig: AppConfig = {
  name: 'b3',
  displayName: 'BigBlueBam',
  basePath: '/b3',
  apiBasePath: '/b3/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [],
  entities: [],
};

export class LoginPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, loginAppConfig, screenshots);
  }

  async goto(): Promise<void> {
    await this.page.goto('/b3/login');
    await this.waitForAppReady();
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.getByLabel('Email').fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.getByLabel('Password').fill(password);
  }

  async clickSignIn(): Promise<void> {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  async expectLoginPage(): Promise<void> {
    await expect(this.page.getByLabel('Email')).toBeVisible();
    await expect(this.page.getByLabel('Password')).toBeVisible();
    await expect(this.page.getByRole('button', { name: /sign in/i })).toBeVisible();
  }

  async expectErrorMessage(message?: string): Promise<void> {
    const errorEl = this.page.locator('[role="alert"], .text-red-500, .text-destructive').first();
    await expect(errorEl).toBeVisible();
    if (message) {
      await expect(errorEl).toContainText(message);
    }
  }

  async expectRedirectToDashboard(): Promise<void> {
    await this.page.waitForURL('**/b3/**', { timeout: 10_000 });
    // Should not be on login page anymore
    await expect(this.page.getByLabel('Email')).not.toBeVisible();
  }
}
