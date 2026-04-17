import type { Scene } from '../types.js';

export const boardScenes: Scene[] = [
  {
    id: '01-list',
    label: 'Board grid view',
    route: '/board/',
    waitFor: 'main',
  },
  {
    id: '02-canvas',
    label: 'Board canvas',
    route: '/board/',
    waitFor: 'main',
    setup: async (page) => {
      const card = page
        .locator('a[href*="/board/"], button:has(h3), [data-testid="board-card"]')
        .first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2500);
      }
    },
  },
  {
    id: '03-templates',
    label: 'Board templates',
    route: '/board/',
    waitFor: 'main',
    setup: async (page) => {
      const newBtn = page
        .locator('button:has-text("New Board"), button:has-text("New"), a:has-text("New Board")')
        .first();
      if ((await newBtn.count()) > 0) {
        await newBtn.click();
        await page.waitForTimeout(1500);
      }
    },
  },
];
