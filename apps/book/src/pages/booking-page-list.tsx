import { Plus, Link2, ExternalLink, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useBookingPages, useDeleteBookingPage, useUpdateBookingPage } from '@/hooks/use-booking-pages';
import { formatDate } from '@/lib/utils';

interface BookingPageListPageProps {
  onNavigate: (path: string) => void;
}

export function BookingPageListPage({ onNavigate }: BookingPageListPageProps) {
  const { data, isLoading } = useBookingPages();
  const deleteBookingPage = useDeleteBookingPage();
  const pages = data?.data ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this booking page?')) return;
    await deleteBookingPage.mutateAsync(id);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Booking Pages</h1>
          <p className="text-sm text-zinc-500 mt-1">Public scheduling links for clients and prospects</p>
        </div>
        <button
          onClick={() => onNavigate('/booking-pages/new/edit')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Booking Page
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-zinc-400">Loading...</div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
          <Link2 className="h-12 w-12 mb-4 text-zinc-300" />
          <p className="text-lg font-medium">No booking pages yet</p>
          <p className="text-sm mt-1">Create a scheduling link for external contacts</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {page.title}
                  </h3>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      page.enabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {page.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    /meet/{page.slug}
                  </span>
                  <span>{page.duration_minutes} min</span>
                  <span>Created {formatDate(page.created_at)}</span>
                </div>
                {page.description && (
                  <p className="text-xs text-zinc-400 mt-1 truncate">{page.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => onNavigate(`/booking-pages/${page.id}/edit`)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(page.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
