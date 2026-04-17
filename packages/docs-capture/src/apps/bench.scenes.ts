import type { Scene } from '../types.js';

export const benchScenes: Scene[] = [
  {
    id: '01-dashboard-list',
    label: 'Dashboard list',
    route: '/bench/',
    waitFor: 'main',
  },
  {
    id: '02-dashboard-view',
    label: 'Dashboard view',
    route: '/bench/',
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
    id: '03-explorer',
    label: 'Ad-hoc explorer',
    route: '/bench/explorer',
    waitFor: 'main',
  },
  {
    id: '04-reports',
    label: 'Scheduled reports',
    route: '/bench/reports',
    waitFor: 'main',
  },
  {
    id: '05-settings',
    label: 'Settings',
    route: '/bench/settings',
    waitFor: 'main',
  },
  {
    id: '06-widget-wizard',
    label: 'Widget wizard',
    route: '/bench/widgets/new',
    waitFor: 'main',
  },
];
