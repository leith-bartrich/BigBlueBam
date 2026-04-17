/**
 * Org picker (D-010).
 *
 * Shown at `/helpdesk/` (no org slug in the URL). Fetches the list of
 * orgs with helpdesk_settings rows from GET /helpdesk/api/public/orgs
 * and lets the visitor pick which support portal they want. Clicking
 * a row hard-navigates to `/helpdesk/<slug>/` so the SPA boots fresh
 * with the chosen tenant in scope.
 */
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Loader2, LifeBuoy, ArrowRight } from 'lucide-react';

interface OrgEntry {
  slug: string;
  name: string;
  logo_url: string | null;
}

export function OrgPickerPage() {
  const [orgs, setOrgs] = useState<OrgEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: OrgEntry[] }>('/public/orgs');
        if (!cancelled) setOrgs(res.data);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : 'Failed to load organizations';
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 text-white font-bold text-xl">
            B
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              BigBlueBam
            </span>
            <LifeBuoy className="h-5 w-5 text-primary-500" />
            <span className="text-zinc-500 dark:text-zinc-400">Helpdesk</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Choose your support portal
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
          Each organization has its own helpdesk. Pick the one you want to contact.
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!orgs && !error && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        )}

        {orgs && orgs.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No helpdesk portals are configured yet. An administrator needs to
            enable helpdesk support for at least one organization.
          </div>
        )}

        {orgs && orgs.length > 0 && (
          <ul className="space-y-2">
            {orgs.map((org) => (
              <li key={org.slug}>
                <a
                  href={`/helpdesk/${org.slug}/`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950"
                >
                  <div className="flex items-center gap-3">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {org.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        /helpdesk/{org.slug}/
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
