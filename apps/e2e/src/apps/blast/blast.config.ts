import type { AppConfig } from '../../registry/types';

export const blastConfig: AppConfig = {
  name: 'blast',
  displayName: 'Blast',
  basePath: '/blast',
  apiBasePath: '/blast/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: true,
  pages: [
    { name: 'campaigns', path: '/', requiresAuth: true, interactions: ['table', 'modal'] },
    { name: 'new-campaign', path: '/campaigns/new', requiresAuth: true, interactions: ['form'] },
    {
      name: 'campaign-detail',
      path: '/campaigns/:id',
      requiresAuth: true,
      requiresSetup: 'campaign',
      interactions: ['tabs', 'table'],
    },
    { name: 'templates', path: '/templates', requiresAuth: true, interactions: ['table', 'modal'] },
    { name: 'new-template', path: '/templates/new', requiresAuth: true, interactions: ['form', 'rich-text'] },
    {
      name: 'edit-template',
      path: '/templates/:id/edit',
      requiresAuth: true,
      requiresSetup: 'template',
      interactions: ['form', 'rich-text'],
    },
    { name: 'segments', path: '/segments', requiresAuth: true, interactions: ['table', 'modal'] },
    { name: 'new-segment', path: '/segments/new', requiresAuth: true, interactions: ['form'] },
    { name: 'analytics', path: '/analytics', requiresAuth: true, interactions: ['table', 'tabs'] },
    { name: 'domain-settings', path: '/settings/domains', requiresAuth: true, interactions: ['form', 'table'] },
    { name: 'smtp-settings', path: '/settings/smtp', requiresAuth: true, interactions: ['form'] },
  ],
  entities: [
    {
      name: 'campaign',
      apiPath: '/campaigns',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Campaign Name' },
        { name: 'subject', type: 'text', required: true, label: 'Subject' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Campaign Name' },
        { name: 'subject', type: 'text', label: 'Subject' },
      ],
      listPath: '/',
      detailPath: '/campaigns/:id',
      supportsPagination: true,
    },
    {
      name: 'template',
      apiPath: '/templates',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Template Name' },
        { name: 'html', type: 'rich-text', required: true, label: 'HTML Content' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Template Name' },
        { name: 'html', type: 'rich-text', label: 'HTML Content' },
      ],
      listPath: '/templates',
      detailPath: '/templates/:id/edit',
      supportsPagination: true,
    },
    {
      name: 'segment',
      apiPath: '/segments',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Segment Name' },
        { name: 'conditions', type: 'textarea', required: true, label: 'Conditions' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Segment Name' },
        { name: 'conditions', type: 'textarea', label: 'Conditions' },
      ],
      listPath: '/segments',
      detailPath: '/segments',
      supportsPagination: true,
    },
  ],
};
