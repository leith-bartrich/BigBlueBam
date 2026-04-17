import type { Scene } from '../types.js';

export const boltScenes: Scene[] = [
  {
    id: '01-automations',
    label: 'Automation list',
    route: '/bolt/',
    waitFor: 'main',
  },
  {
    id: '02-editor',
    label: 'Automation builder',
    route: '/bolt/new',
    waitFor: 'main',
  },
  {
    id: '03-detail',
    label: 'Automation detail',
    route: '/bolt/',
    waitFor: 'main',
    setup: async (page) => {
      const card = page
        .locator('button.w-full.text-left, button:has(h3), main a[href*="automations"]')
        .first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '04-executions',
    label: 'Execution log',
    route: '/bolt/executions',
    waitFor: 'main',
  },
  {
    id: '05-templates',
    label: 'Automation templates',
    route: '/bolt/templates',
    waitFor: 'main',
  },
];
