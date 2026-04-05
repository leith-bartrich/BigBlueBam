import { useState, type FormEvent } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { api, ApiError } from '@/lib/api';

interface BetaNotifyPageProps {
  onNavigate: (path: string) => void;
}

/**
 * Public "notify me when signups open" form. Writes to
 * `beta_signup_notifications`; SuperUsers review and CSV-export from
 * the superuser panel.
 */
export function BetaNotifyPage({ onNavigate }: BetaNotifyPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/public/beta-signup', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Something went wrong. Please try again.');
      } else {
        setError((err as Error).message ?? 'Something went wrong.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">You're on the list</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm">
              Thanks, {name.trim()}. We'll reach out at {email.trim()} when
              we're ready to open new accounts.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => onNavigate('/login')}>
                Back to sign in
              </Button>
              <Button variant="ghost" onClick={() => (window.location.href = '/')}>
                Visit main site
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Get notified</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-center">
            Tell us how to reach you when invites open up.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Ada Lovelace"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="ada@example.com"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Phone <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+1 555 867 5309"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              What would you like to use BigBlueBam for?{' '}
              <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={submitting}
              maxLength={2000}
              placeholder="Tell us about your team and how you'd use it…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            Notify me
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/login')}>
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
