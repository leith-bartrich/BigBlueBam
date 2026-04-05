import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, X, GripVertical } from 'lucide-react';
import type { ApiResponse, PaginatedResponse } from '@bigbluebam/shared';
import { Dialog } from '@/components/common/dialog';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { Badge } from '@/components/common/badge';
import { api } from '@/lib/api';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'url', label: 'URL' },
  { value: 'checkbox', label: 'Checkbox' },
];

interface SelectOption {
  label: string;
  color: string;
}

interface CustomFieldDef {
  id: string;
  project_id: string;
  name: string;
  field_type: string;
  is_required: boolean;
  is_visible_on_card: boolean;
  options?: SelectOption[];
  created_at: string;
  updated_at: string;
}

interface CustomFieldManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function CustomFieldManager({ open, onOpenChange, projectId }: CustomFieldManagerProps) {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newVisibleOnCard, setNewVisibleOnCard] = useState(false);
  const [newOptions, setNewOptions] = useState<SelectOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionColor, setNewOptionColor] = useState('#6366f1');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [editVisibleOnCard, setEditVisibleOnCard] = useState(false);
  const [editOptions, setEditOptions] = useState<SelectOption[]>([]);
  const [editOptionLabel, setEditOptionLabel] = useState('');
  const [editOptionColor, setEditOptionColor] = useState('#6366f1');

  const { data: fieldsRes } = useQuery({
    queryKey: ['custom-fields', projectId],
    queryFn: () => api.get<PaginatedResponse<CustomFieldDef>>(`/projects/${projectId}/custom-fields`),
    enabled: !!projectId && open,
  });
  const fields = fieldsRes?.data ?? [];

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditingId(null);
      setNewName('');
      setNewType('text');
      setNewRequired(false);
      setNewVisibleOnCard(false);
      setNewOptions([]);
    }
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-fields', projectId] });
  };

  const createField = useMutation({
    mutationFn: (data: {
      name: string;
      field_type: string;
      is_required: boolean;
      is_visible_on_card: boolean;
      options?: SelectOption[];
    }) => api.post<ApiResponse<CustomFieldDef>>(`/projects/${projectId}/custom-fields`, data),
    onSuccess: () => {
      invalidate();
      setNewName('');
      setNewType('text');
      setNewRequired(false);
      setNewVisibleOnCard(false);
      setNewOptions([]);
      setShowForm(false);
    },
  });

  const updateField = useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: Record<string, unknown> }) =>
      api.patch<ApiResponse<CustomFieldDef>>(`/custom-fields/${fieldId}`, data),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deleteField = useMutation({
    mutationFn: (fieldId: string) => api.delete(`/custom-fields/${fieldId}`),
    onSuccess: () => invalidate(),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const hasOptions = newType === 'select' || newType === 'multi_select';
    createField.mutate({
      name: newName.trim(),
      field_type: newType,
      is_required: newRequired,
      is_visible_on_card: newVisibleOnCard,
      options: hasOptions ? newOptions : undefined,
    });
  };

  const handleAddNewOption = () => {
    if (!newOptionLabel.trim()) return;
    setNewOptions((prev) => [...prev, { label: newOptionLabel.trim(), color: newOptionColor }]);
    setNewOptionLabel('');
    setNewOptionColor('#6366f1');
  };

  const handleRemoveNewOption = (index: number) => {
    setNewOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const startEditing = (field: CustomFieldDef) => {
    setEditingId(field.id);
    setEditName(field.name);
    setEditRequired(field.is_required);
    setEditVisibleOnCard(field.is_visible_on_card);
    setEditOptions(field.options ?? []);
  };

  const handleSaveEdit = (field: CustomFieldDef) => {
    const hasOptions = field.field_type === 'select' || field.field_type === 'multi_select';
    updateField.mutate({
      fieldId: field.id,
      data: {
        name: editName.trim() || field.name,
        is_required: editRequired,
        is_visible_on_card: editVisibleOnCard,
        ...(hasOptions ? { options: editOptions } : {}),
      },
    });
  };

  const handleAddEditOption = () => {
    if (!editOptionLabel.trim()) return;
    setEditOptions((prev) => [...prev, { label: editOptionLabel.trim(), color: editOptionColor }]);
    setEditOptionLabel('');
    setEditOptionColor('#6366f1');
  };

  const handleRemoveEditOption = (index: number) => {
    setEditOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDelete = (field: CustomFieldDef) => {
    if (!confirm(`Delete custom field "${field.name}"? This will remove the field and its values from all tasks.`)) return;
    deleteField.mutate(field.id);
  };

  const isSelectType = (type: string) => type === 'select' || type === 'multi_select';

  const renderOptionsEditor = (
    options: SelectOption[],
    optionLabel: string,
    optionColor: string,
    onLabelChange: (v: string) => void,
    onColorChange: (v: string) => void,
    onAdd: () => void,
    onRemove: (i: number) => void,
  ) => (
    <div className="space-y-2 mt-2">
      <label className="text-xs font-medium text-zinc-500">Options</label>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border"
              style={{ borderColor: opt.color, color: opt.color }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
              <button
                onClick={() => onRemove(i)}
                className="ml-0.5 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Option label"
          value={optionLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        />
        <input
          type="color"
          value={optionColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-6 w-6 rounded border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
        />
        <Button size="sm" variant="ghost" onClick={onAdd} disabled={!optionLabel.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Custom Fields"
      description="Manage custom field definitions for this project."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Field list */}
        {fields.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {fields.map((field) => (
              <div
                key={field.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2"
              >
                {editingId === field.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 text-sm font-medium px-2 py-1 rounded border border-primary-400 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <Badge variant="default">{field.field_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={editRequired}
                          onChange={(e) => setEditRequired(e.target.checked)}
                          className="rounded border-zinc-300"
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          checked={editVisibleOnCard}
                          onChange={(e) => setEditVisibleOnCard(e.target.checked)}
                          className="rounded border-zinc-300"
                        />
                        Visible on card
                      </label>
                    </div>
                    {isSelectType(field.field_type) &&
                      renderOptionsEditor(
                        editOptions,
                        editOptionLabel,
                        editOptionColor,
                        setEditOptionLabel,
                        setEditOptionColor,
                        handleAddEditOption,
                        handleRemoveEditOption,
                      )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(field)}
                        loading={updateField.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-zinc-300 shrink-0" />
                    <button
                      onClick={() => startEditing(field)}
                      className="flex-1 min-w-0 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer"
                    >
                      {field.name}
                    </button>
                    <Badge variant="default">{field.field_type}</Badge>
                    {field.is_required && (
                      <Badge variant="danger">Required</Badge>
                    )}
                    {field.is_visible_on_card && (
                      <Badge variant="info">Card</Badge>
                    )}
                    <button
                      onClick={() => handleDelete(field)}
                      disabled={deleteField.isPending}
                      className="p-1 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      title="Delete field"
                      aria-label={`Delete custom field ${field.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 py-2">No custom fields yet. Add one to get started.</p>
        )}

        {/* Create form */}
        {showForm ? (
          <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  id="cf-name"
                  label="Field Name"
                  placeholder="e.g. Customer ID"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSelectType(newType)) handleCreate();
                  }}
                />
              </div>
              <div className="w-36">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Type</label>
                <Select
                  options={FIELD_TYPES}
                  value={newType}
                  onValueChange={setNewType}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Required
              </label>
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={newVisibleOnCard}
                  onChange={(e) => setNewVisibleOnCard(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Visible on card
              </label>
            </div>
            {isSelectType(newType) &&
              renderOptionsEditor(
                newOptions,
                newOptionLabel,
                newOptionColor,
                setNewOptionLabel,
                setNewOptionColor,
                handleAddNewOption,
                handleRemoveNewOption,
              )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                loading={createField.isPending}
                disabled={!newName.trim()}
              >
                Add Field
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Add Custom Field
          </Button>
        )}
      </div>
    </Dialog>
  );
}
