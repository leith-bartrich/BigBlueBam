import type { Scene } from '../types.js';

export const briefScenes: Scene[] = [
  {
    id: '01-home',
    label: 'Brief home',
    route: '/brief/',
    waitFor: 'main',
  },
  {
    id: '02-documents',
    label: 'Document list',
    route: '/brief/',
    waitFor: 'main',
    setup: async (page) => {
      const btn = page.locator('aside button:has-text("Documents")').first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(2500);
      }
    },
  },
  {
    id: '03-detail',
    label: 'Document detail',
    route: '/brief/',
    waitFor: 'main',
    setup: async (page) => {
      const docBtn = page.locator('aside button:has-text("Documents")').first();
      if ((await docBtn.count()) > 0) {
        await docBtn.click();
        await page.waitForTimeout(2000);
      }
      for (const sel of ['button.w-full.text-left', 'button:has(h3)', 'main button[class*="rounded-xl"]']) {
        const card = page.locator(sel).first();
        if ((await card.count()) > 0) {
          await card.click();
          await page.waitForTimeout(2500);
          break;
        }
      }
    },
  },
  {
    id: '04-editor',
    label: 'Document editor',
    route: '/brief/new',
    waitFor: 'main',
  },
  {
    id: '05-templates',
    label: 'Template browser',
    route: '/brief/templates',
    waitFor: 'main',
  },
  {
    id: '06-starred',
    label: 'Starred documents',
    route: '/brief/starred',
    waitFor: 'main',
  },
];
