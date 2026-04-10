import type { AppConfig } from '../../registry/types';

export const benchConfig: AppConfig = {
  name: 'bench',
  displayName: 'Bench',
  basePath: '/bench',
  apiBasePath: '/bench/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'dashboard-list', path: '/', requiresAuth: true, interactions: ['table', 'tabs'] },
    { name: 'explorer', path: '/explorer', requiresAuth: true, interactions: ['form', 'table', 'filter'] },
    { name: 'reports', path: '/reports', requiresAuth: true, interactions: ['table', 'filter'] },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
    { name: 'dashboard-detail', path: '/dashboards/:id', requiresAuth: true, requiresSetup: 'dashboard', interactions: ['canvas', 'tabs'] },
    { name: 'dashboard-edit', path: '/dashboards/:id/edit', requiresAuth: true, requiresSetup: 'dashboard', interactions: ['form', 'canvas'] },
  ],
  entities: [
    {
      name: 'dashboard',
      apiPath: '/dashboards',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
      listPath: '/',
      detailPath: '/dashboards/:id',
      supportsPagination: true,
    },
    {
      name: 'widget',
      apiPath: '/dashboards/:dashboardId/widgets',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'type', type: 'select', required: true, label: 'Type', options: ['chart', 'table', 'metric', 'text'] },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
      ],
      listPath: '/dashboards/:id',
      detailPath: '/dashboards/:id',
      supportsPagination: false,
    },
    {
      name: 'data-source',
      apiPath: '/data-sources',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Name' },
        { name: 'type', type: 'select', required: true, label: 'Type', options: ['sql', 'api', 'csv'] },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Name' },
      ],
      listPath: '/settings',
      detailPath: '/settings',
      supportsPagination: false,
    },
  ],
};
