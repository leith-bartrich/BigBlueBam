import { useState, useEffect } from 'react';
import { Save, Clock } from 'lucide-react';
import { useWorkingHours, useSetWorkingHours } from '@/hooks/use-working-hours';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WorkingHoursPageProps {
  onNavigate?: (path: string) => void;
}

export function WorkingHoursPage({ onNavigate: _onNavigate }: WorkingHoursPageProps) {
  const { data, isLoading } = useWorkingHours();
  const setWorkingHours = useSetWorkingHours();

  const [hours, setHours] = useState<
    Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      enabled: boolean;
    }>
  >([]);

  useEffect(() => {
    if (data?.data) {
      // Merge with defaults for all 7 days
      const merged = DAY_NAMES.map((_, i) => {
        const existing = data.data.find((h) => h.day_of_week === i);
        return {
          day_of_week: i,
          start_time: existing?.start_time ?? '09:00',
          end_time: existing?.end_time ?? '17:00',
          enabled: existing?.enabled ?? (i >= 1 && i <= 5), // Mon-Fri default
        };
      });
      setHours(merged);
    }
  }, [data]);

  const handleSave = async () => {
    await setWorkingHours.mutateAsync(hours.filter((h) => h.enabled));
  };

  const updateDay = (dayIndex: number, field: string, value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayIndex ? { ...h, [field]: value } : h,
      ),
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400">Loading...</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Clock className="h-6 w-6 text-blue-600" />
          Working Hours
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Set your available hours for booking pages and availability calculations
        </p>
      </div>

      <div className="space-y-3">
        {hours.map((h) => (
          <div
            key={h.day_of_week}
            className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
          >
            <label className="flex items-center gap-2 w-32">
              <input
                type="checkbox"
                checked={h.enabled}
                onChange={(e) => updateDay(h.day_of_week, 'enabled', e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {DAY_NAMES[h.day_of_week]}
              </span>
            </label>

            {h.enabled ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={h.start_time}
                  onChange={(e) => updateDay(h.day_of_week, 'start_time', e.target.value)}
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                />
                <span className="text-zinc-400 text-sm">to</span>
                <input
                  type="time"
                  value={h.end_time}
                  onChange={(e) => updateDay(h.day_of_week, 'end_time', e.target.value)}
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                />
              </div>
            ) : (
              <span className="text-sm text-zinc-400 italic">Unavailable</span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={setWorkingHours.isPending}
        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {setWorkingHours.isPending ? 'Saving...' : 'Save Working Hours'}
      </button>
    </div>
  );
}
