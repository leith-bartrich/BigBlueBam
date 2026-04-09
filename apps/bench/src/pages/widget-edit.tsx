import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useWidgetQuery } from '@/hooks/use-widgets';

interface WidgetEditPageProps {
  widgetId: string;
  onNavigate: (path: string) => void;
}

export function WidgetEditPage({ widgetId, onNavigate }: WidgetEditPageProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('/')}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Widget</h1>
      </div>

      <div className="p-8 text-center text-zinc-500">
        <p className="text-sm">Widget configuration editor for widget <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{widgetId}</code></p>
        <p className="text-xs mt-2 text-zinc-400">Modify data source, measures, dimensions, chart type, and visual styling.</p>
      </div>
    </div>
  );
}
