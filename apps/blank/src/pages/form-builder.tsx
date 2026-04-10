import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, GripVertical, Trash2, Save, Eye, Send, Settings,
  Type, AlignLeft, Mail, Phone, Link, Hash,
  ListChecks, ChevronDown, Calendar, Clock,
  Star, BarChart3, ThumbsUp, CheckSquare, ToggleLeft,
  Heading, FileText, EyeOff, Upload, SeparatorHorizontal,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { useForm, useUpdateForm, usePublishForm } from '@/hooks/use-forms';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { BlankField } from '@/hooks/use-forms';

interface FormBuilderPageProps {
  formId: string;
  onNavigate: (path: string) => void;
}

const FIELD_TYPE_PALETTE = [
  { type: 'short_text', label: 'Short Text', icon: Type },
  { type: 'long_text', label: 'Long Text', icon: AlignLeft },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'url', label: 'URL', icon: Link },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'single_select', label: 'Single Select', icon: ListChecks },
  { type: 'multi_select', label: 'Multi Select', icon: ListChecks },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'time', label: 'Time', icon: Clock },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'scale', label: 'Scale', icon: BarChart3 },
  { type: 'nps', label: 'NPS', icon: ThumbsUp },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'toggle', label: 'Toggle', icon: ToggleLeft },
  { type: 'file_upload', label: 'File Upload', icon: Upload },
  { type: 'section_header', label: 'Section Header', icon: Heading },
  { type: 'paragraph', label: 'Paragraph', icon: FileText },
  { type: 'hidden', label: 'Hidden Field', icon: EyeOff },
  { type: 'page_break', label: 'Page Break', icon: SeparatorHorizontal },
];

/* ------------------------------------------------------------------ */
/*  Sortable field row                                                 */
/* ------------------------------------------------------------------ */

interface SortableFieldProps {
  field: BlankField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableField({ field, isSelected, onSelect, onDelete }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
        isSelected
          ? 'border-primary-400 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-950/20'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none p-0.5 text-zinc-300 hover:text-zinc-500 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.label}</span>
          {field.required && <span className="text-red-500 text-xs">*</span>}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
            {field.field_type.replace('_', ' ')}
          </span>
        </div>
        {field.description && (
          <p className="text-xs text-zinc-500">{field.description}</p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live preview renderer                                              */
/* ------------------------------------------------------------------ */

function FieldPreviewInput({ field }: { field: BlankField }) {
  const baseClass =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100';

  switch (field.field_type) {
    case 'short_text':
      return <input type="text" placeholder={field.placeholder ?? ''} disabled className={baseClass} />;
    case 'long_text':
      return <textarea rows={3} placeholder={field.placeholder ?? ''} disabled className={baseClass} />;
    case 'email':
      return <input type="email" placeholder={field.placeholder ?? 'email@example.com'} disabled className={baseClass} />;
    case 'phone':
      return <input type="tel" placeholder={field.placeholder ?? '+1 (555) 000-0000'} disabled className={baseClass} />;
    case 'url':
      return <input type="url" placeholder={field.placeholder ?? 'https://'} disabled className={baseClass} />;
    case 'number':
      return <input type="number" placeholder={field.placeholder ?? '0'} disabled className={baseClass} />;
    case 'date':
      return <input type="date" disabled className={baseClass} />;
    case 'time':
      return <input type="time" disabled className={baseClass} />;
    case 'single_select':
    case 'multi_select': {
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      return (
        <div className="space-y-1.5">
          {options.length > 0 ? (
            options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type={field.field_type === 'single_select' ? 'radio' : 'checkbox'}
                  disabled
                  className="rounded"
                />
                {opt}
              </label>
            ))
          ) : (
            <p className="text-xs text-zinc-400 italic">No options configured</p>
          )}
        </div>
      );
    }
    case 'dropdown': {
      const opts = Array.isArray(field.options) ? (field.options as string[]) : [];
      return (
        <select disabled className={baseClass}>
          <option value="">{field.placeholder ?? 'Select an option...'}</option>
          {opts.map((opt, i) => (
            <option key={i}>{opt}</option>
          ))}
        </select>
      );
    }
    case 'rating':
      return (
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
          ))}
        </div>
      );
    case 'scale':
      return (
        <div className="space-y-1">
          <input type="range" min={field.scale_min} max={field.scale_max} disabled className="w-full" />
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{field.scale_min_label ?? field.scale_min}</span>
            <span>{field.scale_max_label ?? field.scale_max}</span>
          </div>
        </div>
      );
    case 'nps':
      return (
        <div className="flex gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled
              className="flex-1 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded text-zinc-500"
            >
              {i}
            </button>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" disabled className="rounded" />
          {field.label}
        </label>
      );
    case 'toggle':
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full relative">
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
          </div>
          <span className="text-sm text-zinc-500">{field.label}</span>
        </div>
      );
    case 'file_upload':
      return (
        <div className="flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg py-6 text-sm text-zinc-400">
          <Upload className="h-4 w-4 mr-2" />
          Click or drag to upload
        </div>
      );
    case 'section_header':
      return <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{field.label}</h3>;
    case 'paragraph':
      return <p className="text-sm text-zinc-500">{field.description || 'Paragraph text'}</p>;
    case 'hidden':
      return <p className="text-xs text-zinc-400 italic">Hidden field (not shown to respondent)</p>;
    case 'page_break':
      return null; // handled by multi-page logic
    default:
      return <input type="text" placeholder={field.placeholder ?? ''} disabled className={baseClass} />;
  }
}

function FormPreviewPanel({
  form,
  fields,
  onClose,
}: {
  form: BlankForm | undefined;
  fields: BlankField[];
  onClose: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);

  // Split fields into pages at page_break boundaries
  const pages: BlankField[][] = [];
  let currentPageFields: BlankField[] = [];
  for (const field of fields) {
    if (field.field_type === 'page_break') {
      if (currentPageFields.length > 0) {
        pages.push(currentPageFields);
        currentPageFields = [];
      }
    } else {
      currentPageFields.push(field);
    }
  }
  if (currentPageFields.length > 0) pages.push(currentPageFields);
  if (pages.length === 0) pages.push([]); // always at least 1 page

  const totalPages = pages.length;
  const isMultiPage = totalPages > 1;
  const pageFields = pages[currentPage] ?? [];

  return (
    <div className="w-[420px] border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
      {/* Preview header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Live Preview</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-sm mx-auto bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-6 space-y-5">
          {/* Form title */}
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {form?.name || 'Untitled Form'}
            </h2>
            {form?.description && (
              <p className="text-sm text-zinc-500 mt-1">{form.description}</p>
            )}
          </div>

          {/* Progress bar for multi-page */}
          {isMultiPage && form?.show_progress_bar !== false && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Page {currentPage + 1} of {totalPages}</span>
                <span>{Math.round(((currentPage + 1) / totalPages) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Fields */}
          {pageFields.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">
              No fields on this page. Add fields from the palette.
            </p>
          ) : (
            <div className="space-y-4">
              {pageFields
                .filter((f) => f.field_type !== 'hidden')
                .map((field) => {
                  // section_header and paragraph render directly
                  if (field.field_type === 'section_header' || field.field_type === 'paragraph') {
                    return <FieldPreviewInput key={field.id} field={field} />;
                  }
                  // checkbox and toggle render inline
                  if (field.field_type === 'checkbox' || field.field_type === 'toggle') {
                    return <FieldPreviewInput key={field.id} field={field} />;
                  }
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-zinc-400">{field.description}</p>
                      )}
                      <FieldPreviewInput field={field} />
                    </div>
                  );
                })}
            </div>
          )}

          {/* Navigation buttons for multi-page */}
          {isMultiPage ? (
            <div className="flex justify-between pt-2">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg disabled:opacity-30 text-zinc-600 dark:text-zinc-300"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              {currentPage < totalPages - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-6 py-2 text-sm bg-primary-600 text-white rounded-lg opacity-75"
                >
                  Submit
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg opacity-75"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form builder page                                                  */
/* ------------------------------------------------------------------ */

export function FormBuilderPage({ formId, onNavigate }: FormBuilderPageProps) {
  const { data, isLoading } = useForm(formId);
  const updateMutation = useUpdateForm(formId);
  const publishMutation = usePublishForm();
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const form = data?.data;
  const fields = form?.fields ?? [];
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAddField = async (fieldType: string) => {
    const fieldKey = `field_${Date.now().toString(36)}`;
    const label = FIELD_TYPE_PALETTE.find((f) => f.type === fieldType)?.label ?? 'New Field';
    await api.post(`/v1/forms/${formId}/fields`, {
      field_key: fieldKey,
      label,
      field_type: fieldType,
      sort_order: fields.length,
    });
    updateMutation.mutate({});
  };

  const handleDeleteField = async (fieldId: string) => {
    await api.delete(`/v1/fields/${fieldId}`);
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    updateMutation.mutate({});
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = fields.findIndex((f) => f.id === active.id);
      const newIdx = fields.findIndex((f) => f.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;

      const reordered = arrayMove(fields, oldIdx, newIdx);
      const fieldOrders = reordered.map((f, i) => ({ id: f.id, sort_order: i }));

      await api.post(`/v1/forms/${formId}/fields/reorder`, { fields: fieldOrders });
      updateMutation.mutate({});
    },
    [fields, formId, updateMutation],
  );

  const handlePublish = async () => {
    await publishMutation.mutateAsync(formId);
  };

  if (isLoading) {
    return <div className="p-6"><div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="flex h-full">
      {/* Left panel: Field palette */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto custom-scrollbar">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Add Field</h3>
        <div className="space-y-1">
          {FIELD_TYPE_PALETTE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => handleAddField(item.type)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icon className="h-4 w-4 text-zinc-400" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center panel: Form canvas */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <input
                type="text"
                value={form?.name ?? ''}
                onChange={(e) => updateMutation.mutate({ name: e.target.value })}
                className="text-2xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 w-full"
                placeholder="Form Title"
              />
              <input
                type="text"
                value={form?.description ?? ''}
                onChange={(e) => updateMutation.mutate({ description: e.target.value })}
                className="text-sm bg-transparent border-none outline-none text-zinc-500 w-full mt-1"
                placeholder="Add a description..."
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg',
                  showPreview
                    ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950/20 dark:text-primary-300'
                    : 'text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
              >
                <Eye className="h-4 w-4" /> Preview
              </button>
              <button
                onClick={handlePublish}
                disabled={publishMutation.isPending || form?.status === 'published'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Publish
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                <Plus className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">Click a field type on the left to add it</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  {fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      isSelected={selectedFieldId === field.id}
                      onSelect={() => setSelectedFieldId(field.id === selectedFieldId ? null : field.id)}
                      onDelete={() => handleDeleteField(field.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Live preview panel */}
      {showPreview && (
        <FormPreviewPanel
          form={form}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Right panel: Field configuration */}
      {selectedField && (
        <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto custom-scrollbar">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Field Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Label</label>
              <input
                type="text"
                defaultValue={selectedField.label}
                onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { label: e.target.value }).then(() => updateMutation.mutate({}))}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Key</label>
              <input
                type="text"
                defaultValue={selectedField.field_key}
                onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { field_key: e.target.value }).then(() => updateMutation.mutate({}))}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
              <input
                type="text"
                defaultValue={selectedField.description ?? ''}
                onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { description: e.target.value || null }).then(() => updateMutation.mutate({}))}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="Helper text shown below the field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Placeholder</label>
              <input
                type="text"
                defaultValue={selectedField.placeholder ?? ''}
                onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { placeholder: e.target.value || null }).then(() => updateMutation.mutate({}))}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={selectedField.required}
                onChange={(e) => api.patch(`/v1/fields/${selectedField.id}`, { required: e.target.checked }).then(() => updateMutation.mutate({}))}
                className="rounded"
              />
              <label className="text-sm text-zinc-700 dark:text-zinc-300">Required</label>
            </div>

            {/* Options editor for select/dropdown field types */}
            {['single_select', 'multi_select', 'dropdown', 'checkbox_group'].includes(selectedField.field_type) && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Options</label>
                <div className="space-y-1.5">
                  {(Array.isArray(selectedField.options) ? selectedField.options as string[] : []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        defaultValue={opt}
                        onBlur={(e) => {
                          const opts = [...(Array.isArray(selectedField.options) ? selectedField.options as string[] : [])];
                          opts[i] = e.target.value;
                          api.patch(`/v1/fields/${selectedField.id}`, { options: opts }).then(() => updateMutation.mutate({}));
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => {
                          const opts = [...(Array.isArray(selectedField.options) ? selectedField.options as string[] : [])];
                          opts.splice(i, 1);
                          api.patch(`/v1/fields/${selectedField.id}`, { options: opts }).then(() => updateMutation.mutate({}));
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const opts = [...(Array.isArray(selectedField.options) ? selectedField.options as string[] : []), `Option ${(selectedField.options as string[] ?? []).length + 1}`];
                      api.patch(`/v1/fields/${selectedField.id}`, { options: opts }).then(() => updateMutation.mutate({}));
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Add option
                  </button>
                </div>
              </div>
            )}

            {/* Validation for text fields */}
            {['short_text', 'long_text', 'textarea'].includes(selectedField.field_type) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Min Length</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={selectedField.min_length ?? ''}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { min_length: e.target.value ? Number(e.target.value) : null }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Max Length</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={selectedField.max_length ?? ''}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { max_length: e.target.value ? Number(e.target.value) : null }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>
            )}

            {/* Validation for numeric fields */}
            {['number', 'rating', 'scale', 'nps'].includes(selectedField.field_type) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Min Value</label>
                  <input
                    type="number"
                    defaultValue={selectedField.min_value ?? ''}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { min_value: e.target.value || null }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Max Value</label>
                  <input
                    type="number"
                    defaultValue={selectedField.max_value ?? ''}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { max_value: e.target.value || null }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>
            )}

            {/* Scale labels for scale fields */}
            {selectedField.field_type === 'scale' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Scale Min</label>
                  <input
                    type="number"
                    defaultValue={selectedField.scale_min ?? 1}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { scale_min: Number(e.target.value) || 1 }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Scale Max</label>
                  <input
                    type="number"
                    defaultValue={selectedField.scale_max ?? 10}
                    onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { scale_max: Number(e.target.value) || 10 }).then(() => updateMutation.mutate({}))}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>
            )}

            {/* Regex pattern for any field */}
            {!['section_header', 'paragraph', 'hidden', 'page_break', 'file_upload'].includes(selectedField.field_type) && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Regex Pattern</label>
                <input
                  type="text"
                  defaultValue={selectedField.regex_pattern ?? ''}
                  onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { regex_pattern: e.target.value || null }).then(() => updateMutation.mutate({}))}
                  className="w-full px-2 py-1 text-sm font-mono border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  placeholder="^[A-Z]{3}$"
                />
              </div>
            )}

            {/* Page number assignment */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Page Number</label>
              <input
                type="number"
                min={0}
                defaultValue={selectedField.page_number ?? 0}
                onBlur={(e) => api.patch(`/v1/fields/${selectedField.id}`, { page_number: Number(e.target.value) || 0 }).then(() => updateMutation.mutate({}))}
                className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
              <p className="text-[10px] text-zinc-400 mt-0.5">Fields with the same page number appear together</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
