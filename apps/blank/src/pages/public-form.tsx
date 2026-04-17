import { useState, useEffect, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

interface PublicFormPageProps {
  slug: string;
}

interface PublicField {
  id: string;
  field_key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  field_type: string;
  required: boolean;
  options: unknown;
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string | null;
  scale_max_label?: string | null;
  sort_order: number;
}

interface PublicForm {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  accept_responses: boolean;
  show_progress_bar: boolean;
  confirmation_type: string;
  confirmation_message: string | null;
  confirmation_redirect_url: string | null;
  header_image_url: string | null;
  theme_color: string;
  fields: PublicField[];
}

type FieldValue = string | string[] | number | boolean;

export function PublicFormPage({ slug }: PublicFormPageProps) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/blank/api/forms/${encodeURIComponent(slug)}/definition`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? `Form not found (${res.status})`);
        }
        return res.json() as Promise<{ data: PublicForm }>;
      })
      .then((json) => {
        if (cancelled) return;
        setForm(json.data);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load form');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const setValue = (key: string, v: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/blank/api/forms/${encodeURIComponent(form.slug)}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          response_data: values,
          email: email || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Submission failed (${res.status})`);
      }
      setSubmitted(true);
      if (form.confirmation_type === 'redirect' && form.confirmation_redirect_url) {
        window.location.href = form.confirmation_redirect_url;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-zinc-900 p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Form unavailable</h1>
          <p className="text-sm text-zinc-500">{loadError ?? 'This form could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (!form.accept_responses) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{form.name}</h1>
          <p className="text-sm text-zinc-500">This form is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div
          className="max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center"
          style={{ borderTop: `4px solid ${form.theme_color || '#3b82f6'}` }}
        >
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Thank you!</h1>
          <p className="text-sm text-zinc-500 whitespace-pre-wrap">
            {form.confirmation_message ?? 'Your response has been recorded.'}
          </p>
        </div>
      </div>
    );
  }

  const visibleFields = [...(form.fields ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6"
          style={{ borderTop: `4px solid ${form.theme_color || '#3b82f6'}` }}
        >
          {form.header_image_url && (
            <img src={form.header_image_url} alt="" className="w-full h-48 object-cover rounded-xl" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{form.name}</h1>
            {form.description && (
              <p className="text-sm text-zinc-500 mt-1">{form.description}</p>
            )}
          </div>

          {visibleFields.map((f) => (
            <PublicFieldInput
              key={f.id}
              field={f}
              value={values[f.field_key]}
              onChange={(v) => setValue(f.field_key, v)}
            />
          ))}

          <div>
            <label htmlFor="public-form-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Your email (optional)
            </label>
            <input
              id="public-form-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: form.theme_color || '#3b82f6' }}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PublicFieldInput({
  field,
  value,
  onChange,
}: {
  field: PublicField;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  const inputClass =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100';

  if (field.field_type === 'section_header') {
    return (
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        {field.label}
      </h2>
    );
  }

  if (field.field_type === 'paragraph') {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{field.description ?? field.label}</p>;
  }

  const labelBlock = (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.description && <p className="text-xs text-zinc-500 mb-1.5">{field.description}</p>}
    </div>
  );

  const strVal = typeof value === 'string' ? value : '';
  const arrVal = Array.isArray(value) ? value : [];
  const numVal = typeof value === 'number' ? value : '';

  switch (field.field_type) {
    case 'short_text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <div>
          {labelBlock}
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            required={field.required}
            placeholder={field.placeholder ?? ''}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case 'long_text':
      return (
        <div>
          {labelBlock}
          <textarea
            required={field.required}
            placeholder={field.placeholder ?? ''}
            rows={4}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case 'number':
      return (
        <div>
          {labelBlock}
          <input
            type="number"
            required={field.required}
            placeholder={field.placeholder ?? ''}
            value={numVal}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      );
    case 'date':
      return (
        <div>
          {labelBlock}
          <input
            type="date"
            required={field.required}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case 'time':
      return (
        <div>
          {labelBlock}
          <input
            type="time"
            required={field.required}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case 'datetime':
      return (
        <div>
          {labelBlock}
          <input
            type="datetime-local"
            required={field.required}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case 'single_select': {
      const opts = Array.isArray(field.options) ? (field.options as { value: string; label: string }[]) : [];
      return (
        <div>
          {labelBlock}
          <div className="space-y-2">
            {opts.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.field_key}
                  value={opt.value}
                  checked={strVal === opt.value}
                  onChange={() => onChange(opt.value)}
                  required={field.required}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case 'multi_select': {
      const opts = Array.isArray(field.options) ? (field.options as { value: string; label: string }[]) : [];
      return (
        <div>
          {labelBlock}
          <div className="space-y-2">
            {opts.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arrVal.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arrVal, opt.value]
                      : arrVal.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case 'dropdown': {
      const opts = Array.isArray(field.options) ? (field.options as { value: string; label: string }[]) : [];
      return (
        <div>
          {labelBlock}
          <select
            required={field.required}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="">{field.placeholder ?? 'Select...'}</option>
            {opts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case 'rating': {
      const max = field.scale_max ?? 5;
      const current = typeof value === 'number' ? value : 0;
      return (
        <div>
          {labelBlock}
          <div className="flex gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`text-2xl ${n <= current ? 'text-yellow-500' : 'text-zinc-300 dark:text-zinc-600'}`}
              >
                &#9733;
              </button>
            ))}
          </div>
        </div>
      );
    }
    case 'scale':
    case 'nps': {
      const min = field.scale_min ?? (field.field_type === 'nps' ? 0 : 1);
      const max = field.scale_max ?? (field.field_type === 'nps' ? 10 : 5);
      const current = typeof value === 'number' ? value : null;
      return (
        <div>
          {labelBlock}
          <div className="flex gap-1">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`flex-1 py-2 text-sm border rounded ${current === n ? 'bg-primary-600 text-white border-primary-600' : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400'}`}
              >
                {n}
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
        <div>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
            />
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {field.description && <p className="text-xs text-zinc-500 mt-1">{field.description}</p>}
        </div>
      );
    default:
      return (
        <div>
          {labelBlock}
          <input
            type="text"
            required={field.required}
            placeholder={field.placeholder ?? ''}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
  }
}
