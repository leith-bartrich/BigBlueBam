import type { AppConfig } from '../../registry/types';

export const bearingConfig: AppConfig = {
  name: 'bearing',
  displayName: 'Bearing',
  basePath: '/bearing',
  apiBasePath: '/bearing/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'dashboard', path: '/', requiresAuth: true, interactions: ['table', 'filter'] },
    { name: 'periods', path: '/periods', requiresAuth: true, interactions: ['table', 'form', 'modal'] },
    { name: 'goal-detail', path: '/goals/:id', requiresAuth: true, requiresSetup: 'goal', interactions: ['form', 'table'] },
    { name: 'at-risk', path: '/at-risk', requiresAuth: true, interactions: ['table', 'filter'] },
    { name: 'my-goals', path: '/my-goals', requiresAuth: true, interactions: ['table', 'filter'] },
  ],
  entities: [
    {
      name: 'goal',
      apiPath: '/goals',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'period_id', type: 'select', required: true, label: 'Period' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
      listPath: '/',
      detailPath: '/goals/:id',
      supportsPagination: true,
    },
    {
      name: 'key-result',
      apiPath: '/goals/:goalId/key-results',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'target_value', type: 'number', required: true, label: 'Target Value' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'current_value', type: 'number', label: 'Current Value' },
      ],
      listPath: '/goals/:id',
      detailPath: '/goals/:id',
      supportsPagination: false,
    },
    {
      name: 'period',
      apiPath: '/periods',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Period Name' },
        { name: 'start_date', type: 'date', required: true, label: 'Start Date' },
        { name: 'end_date', type: 'date', required: true, label: 'End Date' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Period Name' },
      ],
      listPath: '/periods',
      detailPath: '/periods',
      supportsPagination: false,
    },
  ],
};
