import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { briefConfig } from '../brief.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class BriefEditorPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, briefConfig, screenshots);
  }

  async gotoNew(): Promise<void> {
    await super.goto('/new');
  }

  async gotoEdit(idOrSlug: string): Promise<void> {
    await super.goto(`/documents/${idOrSlug}/edit`);
  }

  async expectEditorLoaded(): Promise<void> {
    const editor = this.page.locator('[contenteditable], [class*="editor"], [class*="tiptap"], .ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
  }

  async fillTitle(title: string): Promise<void> {
    const titleInput = this.page.getByLabel(/title/i).first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(title);
    } else {
      const placeholder = this.page.getByPlaceholder(/title|untitled/i).first();
      if (await placeholder.isVisible({ timeout: 2000 }).catch(() => false)) {
        await placeholder.fill(title);
      }
    }
  }

  async typeInEditor(text: string): Promise<void> {
    const editor = this.page
      .locator('[contenteditable], [class*="editor"], [class*="tiptap"], .ProseMirror')
      .first();
    await editor.click();
    await this.page.keyboard.type(text);
  }

  async getEditorText(): Promise<string> {
    const editor = this.page
      .locator('[contenteditable], [class*="editor"], [class*="tiptap"], .ProseMirror')
      .first();
    return (await editor.textContent()) || '';
  }

  async clickSave(): Promise<void> {
    const saveBtn = this.page.getByRole('button', { name: /save|publish|create/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    }
  }

  async applyBold(): Promise<void> {
    await this.page.keyboard.press('Meta+b').catch(() => this.page.keyboard.press('Control+b'));
  }

  async applyItalic(): Promise<void> {
    await this.page.keyboard.press('Meta+i').catch(() => this.page.keyboard.press('Control+i'));
  }

  async selectAllEditorText(): Promise<void> {
    await this.page.keyboard.press('Meta+a').catch(() => this.page.keyboard.press('Control+a'));
  }

  async expectBoldApplied(): Promise<void> {
    const boldEl = this.page.locator('strong, [class*="bold"]').first();
    await expect(boldEl).toBeVisible({ timeout: 3000 });
  }

  async expectItalicApplied(): Promise<void> {
    const italicEl = this.page.locator('em, [class*="italic"]').first();
    await expect(italicEl).toBeVisible({ timeout: 3000 });
  }
}
