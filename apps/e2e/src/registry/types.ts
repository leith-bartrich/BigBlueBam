export type InteractionType =
  | 'form'
  | 'modal'
  | 'dropdown'
  | 'drag-drop'
  | 'table'
  | 'keyboard-shortcut'
  | 'inline-edit'
  | 'rich-text'
  | 'file-upload'
  | 'search'
  | 'filter'
  | 'sort'
  | 'infinite-scroll'
  | 'tabs'
  | 'canvas'
  | 'calendar';

export interface FieldDef {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'rich-text' | 'date' | 'checkbox' | 'file';
  required?: boolean;
  label?: string;
  placeholder?: string;
  options?: string[];
}

export interface EntityDef {
  name: string;
  apiPath: string;
  createFields: FieldDef[];
  updateFields: FieldDef[];
  listPath: string;
  detailPath: string;
  supportsPagination: boolean;
  deleteRequiresConfirmation?: boolean;
}

export interface PageDef {
  name: string;
  path: string;
  requiresAuth: boolean;
  requiresSetup?: string;
  interactions: InteractionType[];
  description?: string;
}

export interface AppConfig {
  name: string;
  displayName: string;
  basePath: string;
  apiBasePath: string;
  wsPath?: string;
  authRequired: boolean;
  hasDragDrop: boolean;
  hasKeyboardShortcuts: boolean;
  hasWebSocket: boolean;
  hasRichText: boolean;
  pages: PageDef[];
  entities: EntityDef[];
}
