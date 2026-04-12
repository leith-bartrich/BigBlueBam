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
    // Under heavy parallel load the auth check and initial data fetches can
    // take 20-30 s; block until the BriefLayout has mounted so subsequent
    // selectors don't race the app shell.
    await this.page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 40_000 });
  }

  async gotoEdit(idOrSlug: string): Promise<void> {
    await super.goto(`/documents/${idOrSlug}/edit`);
    await this.page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 40_000 });
  }

  async expectEditorLoaded(): Promise<void> {
    // Tiptap's EditorContent renders a <div class="ProseMirror" contenteditable="true">
    // once the editor is fully mounted. Other wrapper divs (brief-editor, editor-toolbar)
    // appear earlier, so using the actual ProseMirror node is the only reliable signal.
    //
    // The document editor renders a loading spinner until `initialContent` is
    // set (DocumentEditorPage.tsx), so we first wait for the layout main then
    // for the PM node itself.
    await this.page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    const editor = this.page.locator('.ProseMirror[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 20_000 });
  }

  async fillTitle(title: string): Promise<void> {
    // The document-editor uses a borderless <input type="text"> with
    // placeholder "Document title..." — there is no associated <label>.
    const titleInput = this.page.getByPlaceholder(/document title|title|untitled/i).first();
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.fill(title);
  }

  async typeInEditor(text: string): Promise<void> {
    const editor = this.page.locator('.ProseMirror[contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await this.page.keyboard.type(text);
  }

  async getEditorText(): Promise<string> {
    const editor = this.page.locator('.ProseMirror[contenteditable="true"]').first();
    return (await editor.textContent()) || '';
  }

  async clickSave(): Promise<void> {
    // Buttons are "Save Draft" / "Publish". Both become disabled when the
    // title is empty — callers that exercise the "validation" path should
    // use assertSaveDisabled() instead of clickSave().
    const saveBtn = this.page.getByRole('button', { name: /save draft|publish/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await saveBtn.isEnabled().catch(() => false)) {
        await saveBtn.click();
      }
    }
  }

  async assertSaveDisabled(): Promise<void> {
    const saveBtn = this.page.getByRole('button', { name: /save draft/i }).first();
    const publishBtn = this.page.getByRole('button', { name: /^publish$/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await expect(saveBtn).toBeDisabled();
    await expect(publishBtn).toBeDisabled();
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
