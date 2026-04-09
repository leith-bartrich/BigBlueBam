import { useState } from 'react';
import {
  Plus, GripVertical, Trash2, Save, Eye, Send, Settings,
  Type, AlignLeft, Mail, Phone, Link, Hash,
  ListChecks, ChevronDown, Calendar, Clock,
  Star, BarChart3, ThumbsUp, CheckSquare, ToggleLeft,
  Heading, FileText, EyeOff, Upload,
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
];

export function FormBuilderPage({ formId, onNavigate }: FormBuilderPageProps) {
  const { data, isLoading } = useForm(formId);
  const updateMutation = useUpdateForm(formId);
  const publishMutation = usePublishForm();
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const form = data?.data;
  const fields = form?.fields ?? [];
  const selectedField = fields.find((f) => f.id === selectedFieldId);

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
                onClick={() => onNavigate(`/forms/${formId}/preview`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
              fields.map((field) => (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
                    selectedFieldId === field.id
                      ? 'border-primary-400 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600',
                  )}
                >
                  <GripVertical className="h-5 w-5 text-zinc-300 mt-0.5 shrink-0 cursor-grab" />
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
                    onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
