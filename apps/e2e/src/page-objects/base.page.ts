import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AppConfig } from '../registry/types';
import type { ScreenshotCollector } from '../helpers/screenshot';

export abstract class BasePage {
  constructor(
    public readonly page: Page,
    protected readonly appConfig: AppConfig,
    protected readonly screenshots?: ScreenshotCollector,
  ) {}

  get basePath(): string {
    return this.appConfig.basePath;
  }

  async goto(subPath = '/'): Promise<void> {
    const fullPath = subPath.startsWith(this.basePath) ? subPath : `${this.basePath}${subPath}`;
    await this.page.goto(fullPath);
    await this.waitForAppReady();
  }

  async waitForAppReady(): Promise<void> {
    // All apps show a Loader2 spinner during initial auth check
    await this.page
      .locator('.animate-spin')
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => {});
    // Give React a tick to settle
    await this.page.waitForTimeout(300);
  }

  async navigate(path: string): Promise<void> {
    const fullPath = path.startsWith(this.basePath) ? path : `${this.basePath}${path}`;
    // If we're not on the target app yet (e.g. still at about:blank), do a full goto instead
    const currentUrl = this.page.url();
    if (!currentUrl.includes(this.basePath) || currentUrl === 'about:blank') {
      await this.page.goto(fullPath);
    } else {
      await this.page.evaluate((p) => {
        window.history.pushState(null, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, fullPath);
    }
    await this.waitForAppReady();
  }

  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }

  async expectPath(expected: string): Promise<void> {
    const fullExpected = expected.startsWith(this.basePath) ? expected : `${this.basePath}${expected}`;
    await expect(this.page).toHaveURL(new RegExp(fullExpected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[role="status"], [data-sonner-toast]').first();
    if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
      return toast.textContent();
    }
    return null;
  }

  async openCommandPalette(): Promise<void> {
    await this.page.keyboard.press('Meta+k');
    await this.page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 3000 });
  }

  async expectVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible();
  }

  async expectNotVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: false })).not.toBeVisible();
  }

  async capture(stepName: string): Promise<void> {
    if (this.screenshots) {
      await this.screenshots.capture(this.page, stepName);
    }
  }

  async clickButton(name: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name }).click();
  }

  async clickLink(name: string | RegExp): Promise<void> {
    await this.page.getByRole('link', { name }).click();
  }

  async fillField(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  async selectOption(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).selectOption(value);
  }

  async waitForApiResponse(pathContains: string): Promise<void> {
    await this.page.waitForResponse((r) => r.url().includes(pathContains) && r.status() < 400);
  }

  async getMainContent(): Locator {
    return this.page.locator('main').first();
  }
}
