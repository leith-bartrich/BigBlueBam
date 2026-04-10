import type { AppConfig } from '../../registry/types';

export const briefConfig: AppConfig = {
  name: 'brief',
  displayName: 'Brief',
  basePath: '/brief',
  apiBasePath: '/brief/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: true,
  hasRichText: true,
  pages: [
    { name: 'home', path: '/', requiresAuth: true, interactions: ['search', 'table'] },
    { name: 'documents', path: '/documents', requiresAuth: true, interactions: ['table', 'search', 'filter', 'sort'] },
    {
      name: 'document-detail',
      path: '/documents/:idOrSlug',
      requiresAuth: true,
      requiresSetup: 'document',
      interactions: ['rich-text'],
    },
    {
      name: 'document-edit',
      path: '/documents/:idOrSlug/edit',
      requiresAuth: true,
      requiresSetup: 'document',
      interactions: ['form', 'rich-text'],
    },
    { name: 'new-document', path: '/new', requiresAuth: true, interactions: ['form', 'rich-text'] },
    { name: 'templates', path: '/templates', requiresAuth: true, interactions: ['table', 'modal'] },
    { name: 'search', path: '/search', requiresAuth: true, interactions: ['search', 'filter'] },
    { name: 'starred', path: '/starred', requiresAuth: true, interactions: ['table'] },
  ],
  entities: [
    {
      name: 'document',
      apiPath: '/documents',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'content', type: 'rich-text', required: true, label: 'Content' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'content', type: 'rich-text', label: 'Content' },
      ],
      listPath: '/documents',
      detailPath: '/documents/:idOrSlug',
      supportsPagination: true,
      deleteRequiresConfirmation: true,
    },
    {
      name: 'folder',
      apiPath: '/folders',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Folder Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Folder Name' },
      ],
      listPath: '/documents',
      detailPath: '/documents',
      supportsPagination: false,
    },
    {
      name: 'template',
      apiPath: '/templates',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Template Name' },
        { name: 'content', type: 'rich-text', required: true, label: 'Content' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Template Name' },
        { name: 'content', type: 'rich-text', label: 'Content' },
      ],
      listPath: '/templates',
      detailPath: '/templates',
      supportsPagination: true,
    },
  ],
};
