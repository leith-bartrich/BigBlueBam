import type { AppConfig } from '../../registry/types';

export const blankConfig: AppConfig = {
  name: 'blank',
  displayName: 'Blank',
  basePath: '/blank',
  apiBasePath: '/blank/api',
  authRequired: true,
  hasDragDrop: true,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'forms-list', path: '/', requiresAuth: true, interactions: ['table', 'modal'] },
    { name: 'new-form', path: '/forms/new', requiresAuth: true, interactions: ['form'] },
    {
      name: 'edit-form',
      path: '/forms/:id/edit',
      requiresAuth: true,
      requiresSetup: 'form',
      interactions: ['form', 'drag-drop', 'modal'],
    },
    {
      name: 'preview',
      path: '/forms/:id/preview',
      requiresAuth: true,
      requiresSetup: 'form',
      interactions: ['form'],
    },
    {
      name: 'responses',
      path: '/forms/:id/responses',
      requiresAuth: true,
      requiresSetup: 'form',
      interactions: ['table', 'filter'],
    },
    {
      name: 'analytics',
      path: '/forms/:id/analytics',
      requiresAuth: true,
      requiresSetup: 'form',
      interactions: ['table'],
    },
    {
      name: 'form-settings',
      path: '/forms/:id/settings',
      requiresAuth: true,
      requiresSetup: 'form',
      interactions: ['form', 'tabs'],
    },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
  ],
  entities: [
    {
      name: 'form',
      apiPath: '/forms',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Form Title' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Form Title' },
      ],
      listPath: '/',
      detailPath: '/forms/:id/edit',
      supportsPagination: true,
    },
    {
      name: 'field',
      apiPath: '/forms/:formId/fields',
      createFields: [
        { name: 'label', type: 'text', required: true, label: 'Field Label' },
        { name: 'type', type: 'select', required: true, label: 'Field Type', options: ['text', 'email', 'number', 'select', 'textarea', 'checkbox', 'date', 'file'] },
      ],
      updateFields: [
        { name: 'label', type: 'text', label: 'Field Label' },
      ],
      listPath: '/forms/:formId/edit',
      detailPath: '/forms/:formId/edit',
      supportsPagination: false,
    },
    {
      name: 'submission',
      apiPath: '/forms/:formId/submissions',
      createFields: [],
      updateFields: [],
      listPath: '/forms/:formId/responses',
      detailPath: '/forms/:formId/responses',
      supportsPagination: true,
    },
  ],
};
