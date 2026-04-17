import type { Scene } from '../types.js';

export const bamScenes: Scene[] = [
  {
    id: '01-board',
    label: 'Kanban board',
    route: '/b3/',
    waitFor: 'main',
  },
  {
    id: '02-sprint-board',
    label: 'Sprint board',
    route: '/b3/',
    waitFor: 'main',
    setup: async (page) => {
      // Try switching to sprint view via sidebar or view toggle
      const sprintBtn = page
        .locator('aside button:has-text("Sprint"), button:has-text("Sprint Board")')
        .first();
      if ((await sprintBtn.count()) > 0) {
        await sprintBtn.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '03-task-detail',
    label: 'Task detail',
    route: '/b3/',
    waitFor: 'main',
    setup: async (page) => {
      // Click first task card
      const card = page.locator('[data-task-id], [draggable="true"]:has(span)').first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '04-people',
    label: 'People management',
    route: '/b3/people',
    waitFor: 'main',
  },
  {
    id: '05-settings',
    label: 'Project settings',
    route: '/b3/settings',
    waitFor: 'main',
  },
];
