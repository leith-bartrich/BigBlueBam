import { useState } from 'react';
import { useCreateTicket, useHelpdeskSettings } from '@/hooks/use-tickets';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { ArrowLeft } from 'lucide-react';

interface NewTicketPageProps {
  onNavigate: (path: string) => void;
}

export function NewTicketPage({ onNavigate }: NewTicketPageProps) {
  const createTicket = useCreateTicket();
  const { data: settings } = useHelpdeskSettings();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const categories = settings?.categories ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    try {
      const ticket = await createTicket.mutateAsync({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category: category || undefined,
      });
      onNavigate(`/tickets/${ticket.id}`);
    } catch {
      setError('Failed to create ticket. Please try again.');
    }
  };

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => onNavigate('/tickets')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">New Ticket</h1>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Input
            id="subject"
            label="Subject"
            type="text"
            placeholder="Brief summary of your issue"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          {categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="priority" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              id="description"
              rows={6}
              placeholder="Describe your issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 resize-y"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={createTicket.isPending}>
              Submit Ticket
            </Button>
            <Button type="button" variant="secondary" onClick={() => onNavigate('/tickets')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
