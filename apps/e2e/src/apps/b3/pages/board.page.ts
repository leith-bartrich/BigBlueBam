import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { b3Config } from '../b3.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BoardPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, b3Config, screenshots);
  }

  async gotoProject(projectId: string): Promise<void> {
    await super.goto(`/projects/${projectId}/board`);
  }

  async expectBoardLoaded(): Promise<void> {
    // Board should show phase columns
    await expect(this.page.locator('main')).toBeVisible();
    await this.waitForAppReady();
  }

  // --- Phase Columns ---

  getPhaseColumns(): Locator {
    return this.page.locator('[class*="column"], [data-phase]');
  }

  async getPhaseColumnNames(): Promise<string[]> {
    const headers = this.page.locator('[class*="column"] h2, [class*="column"] h3, [class*="phase"] h2, [class*="phase"] h3');
    return headers.allTextContents();
  }

  // --- Tasks ---

  getTaskCards(): Locator {
    return this.page.locator('[class*="task-card"], [class*="card"]').filter({ hasText: /.+/ });
  }

  async getTaskCount(): Promise<number> {
    return this.getTaskCards().count();
  }

  async createTaskInline(title: string): Promise<void> {
    // Look for the inline task creation input or "Add task" button
    const addBtn = this.page.getByRole('button', { name: /add task|new task|\+/i }).first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
    }
    const input = this.page.getByPlaceholder(/task title|enter title|new task/i).first();
    await input.fill(title);
    await input.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async openTask(titleText: string): Promise<void> {
    await this.page.getByText(titleText, { exact: false }).first().click();
    await this.page.waitForTimeout(500);
  }

  async expectTaskVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectTaskNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  // --- Task Detail Drawer ---

  getTaskDrawer(): Locator {
    return this.page.locator('[class*="drawer"], [class*="detail"], [role="dialog"]').first();
  }

  async editTaskTitle(newTitle: string): Promise<void> {
    const drawer = this.getTaskDrawer();
    const titleEl = drawer.locator('h1, h2, [class*="title"]').first();
    await titleEl.dblclick();
    await this.page.keyboard.press('Meta+a');
    await this.page.keyboard.type(newTitle);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async closeTaskDrawer(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  // --- Sprint ---

  async selectSprint(sprintName: string): Promise<void> {
    const sprintSelector = this.page.locator('[class*="sprint"] button, [class*="sprint-select"]').first();
    if (await sprintSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sprintSelector.click();
      await this.page.getByText(sprintName, { exact: false }).first().click();
      await this.waitForAppReady();
    }
  }

  // --- Filters ---

  async openFilterPanel(): Promise<void> {
    await this.page.getByRole('button', { name: /filter/i }).first().click();
  }

  async applyFilter(filterName: string, value: string): Promise<void> {
    await this.openFilterPanel();
    await this.page.getByText(filterName, { exact: false }).first().click();
    await this.page.getByText(value, { exact: false }).first().click();
  }

  // --- View Modes ---

  async switchView(viewName: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(viewName, 'i') }).click();
    await this.waitForAppReady();
  }
}
