import type { AppConfig } from '../../registry/types';

export const bondConfig: AppConfig = {
  name: 'bond',
  displayName: 'Bond',
  basePath: '/bond',
  apiBasePath: '/bond/api',
  authRequired: true,
  hasDragDrop: true,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'pipeline', path: '/', requiresAuth: true, interactions: ['drag-drop', 'modal', 'form', 'filter', 'search'] },
    {
      name: 'pipeline-detail',
      path: '/pipelines/:id',
      requiresAuth: true,
      requiresSetup: 'pipeline',
      interactions: ['drag-drop', 'modal', 'form'],
    },
    {
      name: 'deal-detail',
      path: '/deals/:id',
      requiresAuth: true,
      requiresSetup: 'deal',
      interactions: ['form', 'modal', 'tabs'],
    },
    { name: 'contacts', path: '/contacts', requiresAuth: true, interactions: ['table', 'search', 'filter', 'modal', 'form'] },
    {
      name: 'contact-detail',
      path: '/contacts/:id',
      requiresAuth: true,
      requiresSetup: 'contact',
      interactions: ['form', 'tabs'],
    },
    { name: 'companies', path: '/companies', requiresAuth: true, interactions: ['table', 'search', 'filter', 'modal', 'form'] },
    {
      name: 'company-detail',
      path: '/companies/:id',
      requiresAuth: true,
      requiresSetup: 'company',
      interactions: ['form', 'tabs'],
    },
    { name: 'analytics', path: '/analytics', requiresAuth: true, interactions: ['table'] },
    { name: 'pipeline-settings', path: '/settings/pipelines', requiresAuth: true, interactions: ['table', 'form', 'modal'] },
    { name: 'custom-fields', path: '/settings/fields', requiresAuth: true, interactions: ['table', 'form', 'modal'] },
    { name: 'lead-scoring', path: '/settings/scoring', requiresAuth: true, interactions: ['form'] },
  ],
  entities: [
    {
      name: 'deal',
      apiPath: '/deals',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Deal Title' },
        { name: 'pipeline_id', type: 'select', required: true, label: 'Pipeline' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Deal Title' },
      ],
      listPath: '/',
      detailPath: '/deals/:id',
      supportsPagination: true,
      deleteRequiresConfirmation: true,
    },
    {
      name: 'contact',
      apiPath: '/contacts',
      createFields: [
        { name: 'first_name', type: 'text', required: true, label: 'First Name' },
        { name: 'email', type: 'email', required: true, label: 'Email' },
      ],
      updateFields: [
        { name: 'first_name', type: 'text', label: 'First Name' },
        { name: 'last_name', type: 'text', label: 'Last Name' },
        { name: 'email', type: 'email', label: 'Email' },
      ],
      listPath: '/contacts',
      detailPath: '/contacts/:id',
      supportsPagination: true,
    },
    {
      name: 'company',
      apiPath: '/companies',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Company Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Company Name' },
      ],
      listPath: '/companies',
      detailPath: '/companies/:id',
      supportsPagination: true,
    },
    {
      name: 'pipeline',
      apiPath: '/pipelines',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Pipeline Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Pipeline Name' },
      ],
      listPath: '/settings/pipelines',
      detailPath: '/pipelines/:id',
      supportsPagination: false,
    },
  ],
};
