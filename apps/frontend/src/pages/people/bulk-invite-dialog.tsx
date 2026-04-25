import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { peopleApi, type PersonListItem } from '@/lib/api/people';

interface BulkInviteRow {
  id: string;
  email: string;
  display_name: string;
  role: 'member' | 'admin';
}

interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type InviteResult = {
  succeeded: Array<PersonListItem & { was_existing: boolean }>;
  failed: Array<{ email: string; code: string; message: string }>;
  total_requested: number;
  total_succeeded: number;
  total_failed: number;
};

function makeRow(): BulkInviteRow {
  return {
    id: crypto.randomUUID(),
    email: '',
    display_name: '',
    role: 'member',
  };
}

const STARTING_ROWS = 3;

function buildStartingRows(): BulkInviteRow[] {
  return Array.from({ length: STARTING_ROWS }, () => makeRow());
}

export function BulkInviteDialog({ open, onOpenChange }: BulkInviteDialogProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkInviteRow[]>(buildStartingRows);
  const [result, setResult] = useState<InviteResult | null>(null);

  const invite = useMutation({
    mutationFn: (payload: Array<{ email: string; display_name?: string; role: string }>) =>
      peopleApi.bulkInviteMembers(payload),
    onSuccess: (res) => {
      setResult(res.data);
      // Refresh the people list so newly-added rows appear immediately.
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['org-summary'] });
    },
  });

  function close() {
    onOpenChange(false);
    // Reset state after the close animation finishes. The delay keeps
    // the user from seeing the form flash back to empty mid-dismiss.
    window.setTimeout(() => {
      setRows(buildStartingRows());
      setResult(null);
      invite.reset();
    }, 200);
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function updateRow(id: string, patch: Partial<BulkInviteRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Rows that actually have an email typed in — empty rows are ignored
  // on submit so users don't have to prune the starting rows.
  const filledRows = rows.filter((r) => r.email.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filledRows.length === 0) return;
    invite.mutate(
      filledRows.map((r) => ({
        email: r.email.trim(),
        role: r.role,
        ...(r.display_name.trim() ? { display_name: r.display_name.trim() } : {}),
      })),
    );
  }

  function inviteMore() {
    // Keep only rows whose email failed, plus fresh blanks so the
    // operator can retry problem rows alongside new ones.
    const failedEmails = new Set(result?.failed.map((f) => f.email.toLowerCase()) ?? []);
    const retryRows = rows
      .filter((r) => failedEmails.has(r.email.toLowerCase()))
      .map((r) => ({ ...r, id: crypto.randomUUID() }));
    const blanks = Array.from(
      { length: Math.max(0, STARTING_ROWS - retryRows.length) },
      () => makeRow(),
    );
    setRows([...retryRows, ...blanks]);
    setResult(null);
    invite.reset();
  }

  const title = result ? 'Invite results' : 'Invite members';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
      title={title}
      description={
        result
          ? `${result.total_succeeded} of ${result.total_requested} invites succeeded`
          : 'Add up to 100 people at once. Leave unused rows blank — they\'ll be ignored.'
      }
      className="max-w-3xl"
    >
      {result ? (
        <div className="space-y-4">
          {result.succeeded.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Invited ({result.succeeded.length})
              </h3>
              <ul className="rounded-md border border-green-200 dark:border-green-900 divide-y divide-green-200 dark:divide-green-900 overflow-hidden">
                {result.succeeded.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 bg-green-50/60 dark:bg-green-950/40 text-sm"
                  >
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {s.display_name || s.email}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.email}
                      {s.was_existing ? ' · existing user, added to org' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.failed.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                Couldn't invite ({result.failed.length})
              </h3>
              <ul className="rounded-md border border-red-200 dark:border-red-900 divide-y divide-red-200 dark:divide-red-900 overflow-hidden">
                {result.failed.map((f, idx) => (
                  <li
                    key={`${f.email}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-red-50/60 dark:bg-red-950/40 text-sm"
                  >
                    <span className="text-zinc-900 dark:text-zinc-100 truncate">{f.email}</span>
                    <span className="text-xs text-red-700 dark:text-red-300 text-right">
                      {f.message}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={inviteMore}>
              Invite more
            </Button>
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <th className="pb-2 pr-2 font-medium">
                    Email <span className="text-red-500">*</span>
                  </th>
                  <th className="pb-2 px-2 font-medium">Display name</th>
                  <th className="pb-2 px-2 font-medium w-36">Role</th>
                  <th className="pb-2 w-8" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-1.5 pr-2">
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) => updateRow(row.id, { email: e.target.value })}
                        placeholder="user@example.com"
                        autoFocus={idx === 0}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={row.display_name}
                        onChange={(e) => updateRow(row.id, { display_name: e.target.value })}
                        placeholder="Optional"
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={row.role}
                        onChange={(e) =>
                          updateRow(row.id, { role: e.target.value as BulkInviteRow['role'] })
                        }
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-1.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        aria-label="Remove row"
                        className="rounded-md p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={addRow}
              disabled={rows.length >= 100}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {rows.length} row{rows.length === 1 ? '' : 's'} · {filledRows.length} to invite
            </span>
          </div>
          {invite.isError && (
            <p className="text-sm text-red-600">
              {(invite.error as Error)?.message ?? 'Failed to send invites.'}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.isPending} disabled={filledRows.length === 0}>
              {filledRows.length === 0
                ? 'Invite'
                : `Invite ${filledRows.length} ${filledRows.length === 1 ? 'person' : 'people'}`}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
