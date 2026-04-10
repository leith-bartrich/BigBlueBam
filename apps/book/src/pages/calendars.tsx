import { useState } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import {
  useCalendars,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  type Calendar,
} from '@/hooks/use-calendars';

interface CalendarsPageProps {
  onNavigate?: (path: string) => void;
}

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6b7280', // zinc
];

function CalendarRow({ calendar }: { calendar: Calendar }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);

  const updateMutation = useUpdateCalendar(calendar.id);
  const deleteMutation = useDeleteCalendar();

  const handleSave = async () => {
    if (!name.trim()) return;
    await updateMutation.mutateAsync({ name: name.trim(), color });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(calendar.name);
    setColor(calendar.color);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (calendar.is_default) return;
    if (!confirm(`Delete calendar "${calendar.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(calendar.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete calendar');
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800/50">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <CalendarIcon className="h-4 w-4" />
        </div>
        {isEditing ? (
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              autoFocus
            />
            <div className="flex gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#000' : 'transparent',
                  }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {calendar.name}
              </h3>
              {calendar.is_default && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Default
                </span>
              )}
              <span className="text-[10px] text-zinc-400 capitalize">{calendar.calendar_type}</span>
            </div>
            {calendar.description && (
              <p className="text-xs text-zinc-500 truncate mt-0.5">{calendar.description}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || !name.trim()}
              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 disabled:opacity-40"
              aria-label="Save"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Edit
            </button>
            {!calendar.is_default && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function CalendarsPage(_props: CalendarsPageProps) {
  const { data, isLoading } = useCalendars();
  const createMutation = useCreateCalendar();
  const calendars = data?.data ?? [];

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({
      name: newName.trim(),
      color: newColor,
      calendar_type: 'personal',
    });
    setNewName('');
    setNewColor('#3b82f6');
    setIsCreating(false);
  };

  const handleCancelCreate = () => {
    setNewName('');
    setNewColor('#3b82f6');
    setIsCreating(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            Calendars
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage the calendars you use to organize events
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Calendar
          </button>
        )}
      </div>

      {isCreating && (
        <div className="p-4 border border-blue-300 dark:border-blue-700 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New calendar</h3>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Calendar name"
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? '#000' : 'transparent',
                  }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancelCreate}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading calendars...
        </div>
      ) : calendars.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-400 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
          <CalendarIcon className="h-10 w-10 mb-3 text-zinc-300" />
          <p className="text-sm font-medium">No calendars yet</p>
          <p className="text-xs mt-1">Create one to start scheduling events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calendars.map((cal) => (
            <CalendarRow key={cal.id} calendar={cal} />
          ))}
        </div>
      )}
    </div>
  );
}
