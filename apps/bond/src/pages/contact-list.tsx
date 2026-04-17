import { useState } from 'react';
import { Search, Plus, Mail, Phone, Star, RotateCcw } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Avatar } from '@/components/common/avatar';
import { EmptyState } from '@/components/common/empty-state';
import { CreateContactDialog } from '@/components/contacts/create-contact-dialog';
import { useContacts, contactDisplayName, useRestoreContact } from '@/hooks/use-contacts';
import { cn, lifecycleStageLabel, lifecycleStageColor, formatRelativeTime } from '@/lib/utils';
import { Loader2, Users } from 'lucide-react';

interface ContactListPageProps {
  onNavigate: (path: string) => void;
}

export function ContactListPage({ onNavigate }: ContactListPageProps) {
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading } = useContacts({
    search: search || undefined,
    lifecycle_stage: lifecycleFilter || undefined,
    include_deleted: includeDeleted || undefined,
  });
  const contacts = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const restoreContact = useRestoreContact();

  const lifecycleStages = [
    '', 'lead', 'subscriber', 'marketing_qualified', 'sales_qualified',
    'opportunity', 'customer', 'evangelist',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Contacts</h2>
          <span className="text-sm text-zinc-500">{total} total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary-600"
            />
            Include deleted
          </label>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Lifecycle filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0 overflow-x-auto">
        {lifecycleStages.map((stage) => (
          <button
            key={stage}
            onClick={() => setLifecycleFilter(stage)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              lifecycleFilter === stage
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
            )}
          >
            {stage === '' ? 'All' : lifecycleStageLabel(stage)}
          </button>
        ))}
      </div>

      {/* Contact table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description={search ? 'Try a different search term.' : 'Add your first contact to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Contact
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Email</th>
                <th className="px-6 py-3 text-left font-medium">Company</th>
                <th className="px-6 py-3 text-left font-medium">Stage</th>
                <th className="px-6 py-3 text-left font-medium">Score</th>
                <th className="px-6 py-3 text-left font-medium">Owner</th>
                <th className="px-6 py-3 text-left font-medium">Last Contact</th>
                {includeDeleted && <th className="px-6 py-3 text-left font-medium">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {contacts.map((contact) => {
                const isDeleted = !!(contact as any).deleted_at;
                return (
                <tr
                  key={contact.id}
                  onClick={() => !isDeleted && onNavigate(`/contacts/${contact.id}`)}
                  className={cn(
                    'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
                    isDeleted ? 'opacity-50' : 'cursor-pointer',
                  )}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={contact.avatar_url} name={contactDisplayName(contact)} size="sm" />
                      <div>
                        <p className={cn(
                          'text-sm font-medium text-zinc-900 dark:text-zinc-100',
                          isDeleted && 'line-through',
                        )}>
                          {contactDisplayName(contact)}
                        </p>
                        {contact.title && (
                          <p className="text-xs text-zinc-500">{contact.title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {contact.email ?? '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {contact.company_name ?? '-'}
                  </td>
                  <td className="px-6 py-3">
                    <Badge color={lifecycleStageColor(contact.lifecycle_stage)}>
                      {lifecycleStageLabel(contact.lifecycle_stage)}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {contact.lead_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {contact.owner_name ?? '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-500">
                    {contact.last_contacted_at ? formatRelativeTime(contact.last_contacted_at) : '-'}
                  </td>
                  {includeDeleted && (
                    <td className="px-6 py-3">
                      {isDeleted ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreContact.mutate(contact.id);
                          }}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CreateContactDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(id) => onNavigate(`/contacts/${id}`)}
      />
    </div>
  );
}
