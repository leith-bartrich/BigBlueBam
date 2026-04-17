import type { Scene } from '../types.js';

export const blastScenes: Scene[] = [
  {
    id: '01-campaigns',
    label: 'Campaign list',
    route: '/blast/',
    waitFor: 'main',
  },
  {
    id: '02-campaign-new',
    label: 'New campaign form',
    route: '/blast/campaigns/new',
    waitFor: 'main',
  },
  {
    id: '03-templates',
    label: 'Template gallery',
    route: '/blast/templates',
    waitFor: 'main',
  },
  {
    id: '04-template-editor',
    label: 'Template editor',
    route: '/blast/templates/new',
    waitFor: 'main',
  },
  {
    id: '05-segments',
    label: 'Segment list',
    route: '/blast/segments',
    waitFor: 'main',
  },
  {
    id: '06-segment-builder',
    label: 'Segment builder',
    route: '/blast/segments/new',
    waitFor: 'main',
  },
  {
    id: '07-analytics',
    label: 'Analytics dashboard',
    route: '/blast/analytics',
    waitFor: 'main',
  },
];
