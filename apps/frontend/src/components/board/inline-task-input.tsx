import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface InlineTaskInputProps {
  onSubmit: (title: string) => Promise<void> | void;
  onCancel: () => void;
}

export function InlineTaskInput({ onSubmit, onCancel }: InlineTaskInputProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const title = value.trim();
    if (!title) return;

    setIsSubmitting(true);
    try {
      await onSubmit(title);
      setValue('');
      // Keep focus for rapid entry
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="relative rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-zinc-900 p-2 shadow-sm">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Only cancel if empty; if there's text, user might click away briefly
          if (!value.trim()) onCancel();
        }}
        placeholder="Task title..."
        disabled={isSubmitting}
        className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none disabled:opacity-50"
        aria-label="New task title"
      />
      {isSubmitting && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500" />
        </div>
      )}
      <p className="text-[10px] text-zinc-400 mt-1">
        Enter to create, Esc to cancel
      </p>
    </div>
  );
}
