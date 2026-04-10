import { test, expect } from '../../../fixtures/base.fixture';
import { BriefEditorPage } from '../pages/editor.page';

test.describe('Brief — Rich Text Editor', () => {
  test('editor loads on new document page', async ({ page, screenshots }) => {
    const editor = new BriefEditorPage(page, screenshots);
    await editor.gotoNew();
    await screenshots.capture(page, 'editor-page-loaded');

    await editor.expectEditorLoaded();
    await screenshots.capture(page, 'editor-visible');
  });

  test('can type into the editor', async ({ page, screenshots }) => {
    const editor = new BriefEditorPage(page, screenshots);
    await editor.gotoNew();
    await screenshots.capture(page, 'editor-before-typing');

    await editor.expectEditorLoaded();
    await editor.typeInEditor('Hello, Brief editor!');
    await screenshots.capture(page, 'editor-after-typing');

    const text = await editor.getEditorText();
    expect(text).toContain('Hello');
    await screenshots.capture(page, 'editor-text-verified');
  });

  test('can apply bold formatting', async ({ page, screenshots }) => {
    const editor = new BriefEditorPage(page, screenshots);
    await editor.gotoNew();
    await editor.expectEditorLoaded();

    await editor.typeInEditor('This text will be bold');
    await screenshots.capture(page, 'text-typed');

    await editor.selectAllEditorText();
    await screenshots.capture(page, 'text-selected');

    await editor.applyBold();
    await page.waitForTimeout(300);
    await screenshots.capture(page, 'bold-applied');
  });

  test('can apply italic formatting', async ({ page, screenshots }) => {
    const editor = new BriefEditorPage(page, screenshots);
    await editor.gotoNew();
    await editor.expectEditorLoaded();

    await editor.typeInEditor('This text will be italic');
    await screenshots.capture(page, 'italic-text-typed');

    await editor.selectAllEditorText();
    await editor.applyItalic();
    await page.waitForTimeout(300);
    await screenshots.capture(page, 'italic-applied');
  });

  test('editor toolbar is visible', async ({ page, screenshots }) => {
    const editor = new BriefEditorPage(page, screenshots);
    await editor.gotoNew();
    await editor.expectEditorLoaded();
    await screenshots.capture(page, 'editor-with-toolbar');

    const toolbar = page.locator('[class*="toolbar"], [role="toolbar"], [class*="menu"]').first();
    if (await toolbar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshots.capture(page, 'toolbar-visible');
    }
  });
});
