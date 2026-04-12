import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class DashboardPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
    // Defensive: when sibling tests are hammering /auth/login the global
    // rate limiter can cause GET /auth/me to return 429 on first load.
    // The SPA treats that as unauthenticated and renders the login form,
    // which has no <main> and breaks every downstream assertion. The
    // session cookie is still valid — back off and reload until /auth/me
    // succeeds. We try up to 3 times with progressively longer waits.
    for (let attempt = 0; attempt < 3; attempt++) {
      const showsLogin = await this.page
        .getByRole('heading', { name: /welcome back/i })
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (!showsLogin) return;
      // Back off — the rate limiter window is 60 s but most blips clear
      // in seconds. Wait 5 / 10 / 20 s.
      const waitMs = 5000 * Math.pow(2, attempt);
      await this.page.waitForTimeout(waitMs);
      await this.page.reload();
      await this.waitForAppReady();
    }
  }

  async expectDashboardLoaded(): Promise<void> {
    // Dashboard should show project list or welcome state
    await expect(this.page.locator('main')).toBeVisible();
  }

  async getProjectCount(): Promise<number> {
    const cards = this.page.locator('[class*="project"], [class*="card"]');
    return cards.count();
  }

  async clickProject(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async clickCreateProject(): Promise<void> {
    // Two buttons can match here: the sidebar "+ Create project" icon-button
    // (aria-label="Create project") and the main "+ New Project" / "Create
    // Project" CTA on the projects panel. Prefer the visible CTA inside main
    // to avoid strict-mode violations and to actually open the dialog.
    const cta = this.page
      .locator('main')
      .getByRole('button', { name: /^(new project|create project)$/i });
    await cta.first().click();
  }

  async expectProjectVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  async expectProjectNotVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name, { exact: false })).not.toBeVisible();
  }

  async navigateToMyWork(): Promise<void> {
    await this.page.getByText('My Work', { exact: false }).first().click();
    await this.waitForAppReady();
  }

  async navigateToSettings(): Promise<void> {
    await this.navigate('/settings');
  }

  async navigateToPeople(): Promise<void> {
    await this.navigate('/people');
  }
}
