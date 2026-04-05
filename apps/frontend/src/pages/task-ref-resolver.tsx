import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { api, ApiError } from '@/lib/api';

interface TaskRefResolverPageProps {
  ref: string;
  onNavigate: (path: string) => void;
}

interface ResolvedTask {
  id: string;
  project_id: string;
  human_id: string;
  title: string;
}

/**
 * Resolves a human-readable task reference (e.g. "MAGE-38") into the
 * right project board URL with the task drawer open. Used as the
 * landing page for cross-app links from Banter / Helpdesk — they
 * target /b3/tasks/ref/<REF> which hits this page, which calls the
 * API and redirects.
 *
 * This page should be short-lived on screen: fetch, redirect, done.
 * We render a spinner during the fetch and a friendly not-found /
 * error screen if the ref doesn't resolve.
 */
export function TaskRefResolverPage({ ref, onNavigate }: TaskRefResolverPageProps) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'not-found' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ResolvedTask }>(`/tasks/by-ref/${encodeURIComponent(ref)}`)
      .then((res) => {
        if (cancelled) return;
        // Navigate to the project board with the task drawer open.
        onNavigate(`/projects/${res.data.project_id}/board?task=${res.data.id}`);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: 'not-found' });
        } else if (err instanceof ApiError && err.status === 400) {
          setState({ kind: 'error', message: 'That doesn\u2019t look like a task reference.' });
        } else {
          setState({ kind: 'error', message: (err as Error).message ?? 'Something went wrong.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ref, onNavigate]);

  return (
    <AppLayout
      breadcrumbs={[{ label: ref }]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="flex h-full items-center justify-center">
        {state.kind === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Opening {ref}\u2026</p>
          </div>
        )}
        {state.kind === 'not-found' && (
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Task {ref} not found
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This task reference doesn\u2019t exist, or you don\u2019t have access to the
              project that owns it.
            </p>
            <Button variant="secondary" onClick={() => onNavigate('/')}>
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        )}
        {state.kind === 'error' && (
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Couldn\u2019t open {ref}
            </h1>
            <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
            <Button variant="secondary" onClick={() => onNavigate('/')}>
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
