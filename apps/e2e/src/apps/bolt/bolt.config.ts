import type { AppConfig } from '../../registry/types';

export const boltConfig: AppConfig = {
  name: 'bolt',
  displayName: 'Bolt',
  basePath: '/bolt',
  apiBasePath: '/bolt/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'home', path: '/', requiresAuth: true, interactions: ['table', 'search'] },
    { name: 'new-automation', path: '/new', requiresAuth: true, interactions: ['form', 'modal'] },
    {
      name: 'edit-automation',
      path: '/automations/:id',
      requiresAuth: true,
      requiresSetup: 'automation',
      interactions: ['form', 'modal', 'dropdown'],
    },
    {
      name: 'automation-executions',
      path: '/automations/:id/executions',
      requiresAuth: true,
      requiresSetup: 'automation',
      interactions: ['table'],
    },
    { name: 'all-executions', path: '/executions', requiresAuth: true, interactions: ['table', 'filter', 'search'] },
    {
      name: 'execution-detail',
      path: '/executions/:id',
      requiresAuth: true,
      requiresSetup: 'execution',
      interactions: ['table'],
    },
    { name: 'templates', path: '/templates', requiresAuth: true, interactions: ['table'] },
  ],
  entities: [
    {
      name: 'automation',
      apiPath: '/automations',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Automation Name' },
        { name: 'trigger_type', type: 'select', required: true, label: 'Trigger Type', options: ['event', 'schedule', 'webhook', 'manual'] },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Automation Name' },
      ],
      listPath: '/',
      detailPath: '/automations/:id',
      supportsPagination: true,
    },
    {
      name: 'execution',
      apiPath: '/executions',
      createFields: [],
      updateFields: [],
      listPath: '/executions',
      detailPath: '/executions/:id',
      supportsPagination: true,
    },
  ],
};
