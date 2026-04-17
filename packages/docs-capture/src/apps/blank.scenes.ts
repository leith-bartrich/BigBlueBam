import type { Scene } from '../types.js';

export const blankScenes: Scene[] = [
  {
    id: '01-form-list',
    label: 'Form list',
    route: '/blank/',
    waitFor: 'main',
  },
  {
    id: '02-form-builder',
    label: 'Form builder',
    route: '/blank/',
    waitFor: 'main',
    setup: async (page) => {
      const card = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '03-form-preview',
    label: 'Form preview',
    route: '/blank/',
    waitFor: 'main',
    setup: async (page) => {
      const card = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(1500);
      }
      const previewBtn = page.locator('button:has-text("Preview")').first();
      if ((await previewBtn.count()) > 0) {
        await previewBtn.click();
        await page.waitForTimeout(1500);
      }
    },
  },
  {
    id: '04-settings',
    label: 'Settings',
    route: '/blank/settings',
    waitFor: 'main',
  },
];
