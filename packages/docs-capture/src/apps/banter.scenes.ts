import type { Scene } from '../types.js';

export const banterScenes: Scene[] = [
  {
    id: '01-channels',
    label: 'Channel list',
    route: '/banter/',
    waitFor: 'main',
  },
  {
    id: '02-channel-view',
    label: 'Channel conversation',
    route: '/banter/',
    waitFor: 'main',
    setup: async (page) => {
      // Click the first channel in the sidebar
      const channel = page.locator('aside a[href*="/banter/"], aside button:has-text("#")').first();
      if ((await channel.count()) > 0) {
        await channel.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '03-threads',
    label: 'Thread view',
    route: '/banter/',
    waitFor: 'main',
    setup: async (page) => {
      const channel = page.locator('aside a[href*="/banter/"], aside button:has-text("#")').first();
      if ((await channel.count()) > 0) {
        await channel.click();
        await page.waitForTimeout(1500);
      }
      // Try to open a thread
      const threadBtn = page.locator('button:has-text("Reply"), [data-thread-id]').first();
      if ((await threadBtn.count()) > 0) {
        await threadBtn.click();
        await page.waitForTimeout(1500);
      }
    },
  },
  {
    id: '04-dms',
    label: 'Direct messages',
    route: '/banter/dms',
    waitFor: 'main',
  },
];
