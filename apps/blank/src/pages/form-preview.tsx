import { useForm } from '@/hooks/use-forms';

interface FormPreviewPageProps {
  formId: string;
  onNavigate: (path: string) => void;
}

export function FormPreviewPage({ formId, onNavigate }: FormPreviewPageProps) {
  const { data, isLoading } = useForm(formId);
  const form = data?.data;
  const fields = form?.fields ?? [];

  if (isLoading) {
    return <div className="p-6"><div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => onNavigate(`/forms/${formId}/edit`)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Builder
        </button>
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Preview Mode</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
        {form?.header_image_url && (
          <img src={form.header_image_url} alt="" className="w-full h-48 object-cover rounded-xl mb-6" />
        )}
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{form?.name}</h1>
        {form?.description && (
          <p className="text-sm text-zinc-500 mb-6">{form.description}</p>
        )}

        <div className="space-y-6">
          {fields.map((field) => {
            if (field.field_type === 'section_header') {
              return <h2 key={field.id} className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 pt-4 border-t border-zinc-200 dark:border-zinc-700">{field.label}</h2>;
            }
            if (field.field_type === 'paragraph') {
              return <p key={field.id} className="text-sm text-zinc-600 dark:text-zinc-400">{field.description ?? field.label}</p>;
            }

            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.description && (
                  <p className="text-xs text-zinc-500 mb-1.5">{field.description}</p>
                )}
                {renderFieldPreview(field)}
              </div>
            );
          })}
        </div>

        <button
          className="mt-8 w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          style={{ backgroundColor: form?.theme_color ?? '#3b82f6' }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function renderFieldPreview(field: { field_type: string; placeholder?: string | null; options?: unknown; scale_min?: number; scale_max?: number; scale_min_label?: string | null; scale_max_label?: string | null }) {
  const inputClass = 'w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100';

  switch (field.field_type) {
    case 'short_text':
    case 'email':
    case 'phone':
    case 'url':
      return <input type="text" placeholder={field.placeholder ?? ''} className={inputClass} disabled />;
    case 'long_text':
      return <textarea placeholder={field.placeholder ?? ''} className={inputClass} rows={4} disabled />;
    case 'number':
      return <input type="number" placeholder={field.placeholder ?? ''} className={inputClass} disabled />;
    case 'date':
      return <input type="date" className={inputClass} disabled />;
    case 'time':
      return <input type="time" className={inputClass} disabled />;
    case 'datetime':
      return <input type="datetime-local" className={inputClass} disabled />;
    case 'single_select':
    case 'multi_select': {
      const opts = Array.isArray(field.options) ? field.options : [];
      return (
        <div className="space-y-2">
          {opts.map((opt: { value: string; label: string }, i: number) => (
            <label key={i} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type={field.field_type === 'single_select' ? 'radio' : 'checkbox'} disabled className="rounded" />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    case 'dropdown': {
      const opts = Array.isArray(field.options) ? field.options : [];
      return (
        <select className={inputClass} disabled>
          <option>{field.placeholder ?? 'Select...'}</option>
          {opts.map((opt: { value: string; label: string }, i: number) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    case 'rating': {
      const max = field.scale_max ?? 5;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => (
            <button key={i} className="text-2xl text-zinc-300 dark:text-zinc-600" disabled>
              &#9733;
            </button>
          ))}
        </div>
      );
    }
    case 'scale':
    case 'nps': {
      const min = field.scale_min ?? (field.field_type === 'nps' ? 0 : 1);
      const max = field.scale_max ?? (field.field_type === 'nps' ? 10 : 5);
      return (
        <div>
          <div className="flex gap-1">
            {Array.from({ length: max - min + 1 }, (_, i) => (
              <button
                key={i}
                className="flex-1 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded text-zinc-600 dark:text-zinc-400"
                disabled
              >
                {min + i}
              </button>
            ))}
          </div>
          {(field.scale_min_label || field.scale_max_label) && (
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>{field.scale_min_label}</span>
              <span>{field.scale_max_label}</span>
            </div>
          )}
        </div>
      );
    }
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" disabled className="rounded" />
          {field.placeholder ?? 'Yes'}
        </label>
      );
    case 'toggle':
      return (
        <div className="w-10 h-6 bg-zinc-300 dark:bg-zinc-600 rounded-full relative">
          <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
        </div>
      );
    case 'file_upload':
    case 'image_upload':
      return (
        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-6 text-center text-sm text-zinc-500">
          Click or drag to upload
        </div>
      );
    default:
      return <input type="text" placeholder={field.placeholder ?? ''} className={inputClass} disabled />;
  }
}
