import { useState, useEffect, type FormEvent } from 'react';
import { Loader2, Calendar, Clock, CheckCircle } from 'lucide-react';

interface MeetPageProps {
  slug: string;
}

interface PublicBookingPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  color: string | null;
  logo_url: string | null;
  confirmation_message: string | null;
  redirect_url: string | null;
  owner?: {
    display_name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface SlotsResponse {
  data: Array<{ start_at: string; end_at: string }>;
}

function fmtDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtDayLabel(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function MeetPage({ slug }: MeetPageProps) {
  const [page, setPage] = useState<PublicBookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Array<{ start_at: string; end_at: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ start_at: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/book/api/meet/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? `Booking page not found (${res.status})`);
        }
        return res.json() as Promise<{ data: PublicBookingPage }>;
      })
      .then((json) => {
        if (!cancelled) setPage(json.data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    setSlotsLoading(true);
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const params = new URLSearchParams({
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    });
    fetch(`/book/api/meet/${encodeURIComponent(slug)}/slots?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => res.json() as Promise<SlotsResponse>)
      .then((json) => {
        if (!cancelled) setSlots(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, slug]);

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setSubmitError('Pick a time first.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/book/api/meet/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ start_at: selectedSlot, name, email, notes: notes || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Booking failed (${res.status})`);
      }
      setConfirmed({ start_at: selectedSlot });
      if (page?.redirect_url) {
        window.location.href = page.redirect_url;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to book');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError || !page) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-zinc-900 p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Booking unavailable</h1>
          <p className="text-sm text-zinc-500">{loadError ?? 'This booking page could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
        <div
          className="max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center"
          style={{ borderTop: `4px solid ${page.color || '#3b82f6'}` }}
        >
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Booking confirmed</h1>
          <p className="text-sm text-zinc-500 whitespace-pre-wrap">
            {page.confirmation_message ??
              `You are booked for ${fmtDayLabel(fmtDayKey(confirmed.start_at))} at ${fmtTime(confirmed.start_at)}.`}
          </p>
        </div>
      </div>
    );
  }

  // Group slots by day
  const grouped = new Map<string, Array<{ start_at: string; end_at: string }>>();
  for (const s of slots) {
    const key = fmtDayKey(s.start_at);
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }
  const days = Array.from(grouped.keys()).sort();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
          style={{ borderTop: `4px solid ${page.color || '#3b82f6'}` }}
        >
          <div className="p-8 border-b border-zinc-200 dark:border-zinc-800">
            {page.logo_url && (
              <img src={page.logo_url} alt="" className="h-12 mb-4 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{page.title}</h1>
            {page.owner?.display_name && (
              <p className="text-sm text-zinc-500 mt-1">with {page.owner.display_name}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-zinc-500 mt-3">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {page.duration_minutes} min
              </span>
            </div>
            {page.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4 whitespace-pre-wrap">{page.description}</p>
            )}
          </div>

          <form onSubmit={handleBook} className="p-8 space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-400" />
                Pick a time
              </h2>
              {slotsLoading ? (
                <div className="text-sm text-zinc-400">Loading available times...</div>
              ) : days.length === 0 ? (
                <div className="text-sm text-zinc-400">No times available in the next two weeks.</div>
              ) : (
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {days.map((dayKey) => (
                    <div key={dayKey}>
                      <div className="text-xs font-medium text-zinc-500 mb-1.5">{fmtDayLabel(dayKey)}</div>
                      <div className="flex flex-wrap gap-2">
                        {grouped.get(dayKey)!.map((s) => {
                          const picked = selectedSlot === s.start_at;
                          return (
                            <button
                              key={s.start_at}
                              type="button"
                              onClick={() => setSelectedSlot(s.start_at)}
                              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                picked
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-blue-400'
                              }`}
                            >
                              {fmtTime(s.start_at)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Your details</h2>
              <div>
                <label htmlFor="meet-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Full name
                </label>
                <input
                  id="meet-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="meet-email" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  id="meet-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="meet-notes" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="meet-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
            </section>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting || !selectedSlot}
              className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: page.color || '#3b82f6' }}
            >
              {submitting ? 'Booking...' : selectedSlot ? `Book ${fmtTime(selectedSlot)}` : 'Pick a time above'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
