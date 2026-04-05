import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, MoreHorizontal, Search, KeyRound, UserX, UserCheck, Trash2, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { Dialog } from '@/components/common/dialog';
import { Avatar } from '@/components/common/avatar';
import { Badge } from '@/components/common/badge';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { peopleApi, canActOn, type PersonListItem, type MemberRole } from '@/lib/api/people';
import { formatRelativeTime } from '@/lib/utils';

interface PeoplePageProps {
  onNavigate: (path: string) => void;
}

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'guest', label: 'Guest' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const EDITABLE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'guest', label: 'Guest' },
];

export function PeoplePage({ onNavigate }: PeoplePageProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Bulk-select stub
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Confirm-remove state
  const [confirmRemove, setConfirmRemove] = useState<PersonListItem | null>(null);

  // Reset-password dialog
  const [resetTarget, setResetTarget] = useState<PersonListItem | null>(null);
  const [resetMode, setResetMode] = useState<'generate' | 'manual'>('generate');
  const [resetManual, setResetManual] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  // --- Queries ---
  const { data: membersRes, isLoading } = useQuery({
    queryKey: ['people', 'members'],
    queryFn: () => peopleApi.listMembers(),
  });
  const members = membersRes?.data ?? [];

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const hay = `${m.display_name ?? ''} ${m.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (statusFilter === 'active' && !m.is_active) return false;
      if (statusFilter === 'disabled' && m.is_active) return false;
      return true;
    });
  }, [members, search, roleFilter, statusFilter]);

  // --- Mutations ---
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['people', 'members'] });

  const invite = useMutation({
    mutationFn: peopleApi.inviteMember,
    onSuccess: (res, vars) => {
      invalidate();
      setInviteSuccess(
        res.data.was_existing
          ? `Added ${vars.email} to this organization.`
          : `User created for ${vars.email}. Share credentials via reset password.`,
      );
      setInviteEmail('');
      setInviteDisplayName('');
      setInviteRole('member');
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      peopleApi.updateRole(userId, role),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      peopleApi.setActive(userId, isActive),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => peopleApi.removeMember(userId),
    onSuccess: () => {
      invalidate();
      setConfirmRemove(null);
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password?: string }) =>
      peopleApi.resetPassword(userId, password),
    onSuccess: (res) => {
      setResetResult(res.data.password);
      setResetCopied(false);
    },
  });

  const closeResetDialog = () => {
    setResetTarget(null);
    setResetMode('generate');
    setResetManual('');
    setResetResult(null);
    setResetCopied(false);
    resetPassword.reset();
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    invite.mutate({
      email: inviteEmail.trim(),
      display_name: inviteDisplayName.trim() || undefined,
      role: inviteRole,
    });
  };

  // --- Render helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedIds.has(m.id));

  return (
    <AppLayout
      breadcrumbs={[{ label: 'People' }]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">People</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage members of your organization.
            </p>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" />
            Invite member
          </Button>
        </div>

        {/* Filters row */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px] max-w-md">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>
          </div>
          <Select
            label="Role"
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onValueChange={setRoleFilter}
            className="w-40"
          />
          <Select
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-36"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {isLoading ? (
            <p className="px-6 py-10 text-center text-sm text-zinc-400">Loading people...</p>
          ) : filteredMembers.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-zinc-400">
              {members.length === 0 ? 'No people found.' : 'No matches for current filters.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            if (allChecked) {
                              const next = new Set(prev);
                              for (const m of filteredMembers) next.delete(m.id);
                              return next;
                            }
                            const next = new Set(prev);
                            for (const m of filteredMembers) next.add(m.id);
                            return next;
                          });
                        }}
                        className="rounded border-zinc-300 dark:border-zinc-700"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Name</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Email</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Role</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Last seen</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => {
                    const canAct = canActOn(user, m);
                    const isSelf = m.id === user?.id;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                        onClick={() => onNavigate(`/people/${m.id}`)}
                      >
                        <td
                          className="px-4 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="rounded border-zinc-300 dark:border-zinc-700"
                            aria-label={`Select ${m.display_name}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={m.avatar_url} name={m.display_name} size="sm" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {m.display_name || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{m.email}</td>
                        <td
                          className="px-4 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canAct ? (
                            <Select
                              options={EDITABLE_ROLE_OPTIONS}
                              value={m.role}
                              onValueChange={(role) => updateRole.mutate({ userId: m.id, role })}
                              className="w-28"
                            />
                          ) : (
                            <span className="capitalize text-zinc-700 dark:text-zinc-300">{m.role}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {m.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="danger">Disabled</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500">
                          {m.last_seen_at ? formatRelativeTime(m.last_seen_at) : '—'}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu
                            trigger={
                              <button
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                                title="Actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            }
                          >
                            <DropdownMenuItem onSelect={() => onNavigate(`/people/${m.id}`)}>
                              <Eye className="h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {canAct && (
                              <DropdownMenuItem onSelect={() => setResetTarget(m)}>
                                <KeyRound className="h-4 w-4" />
                                Reset password
                              </DropdownMenuItem>
                            )}
                            {canAct && !isSelf && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  setActive.mutate({ userId: m.id, isActive: !m.is_active })
                                }
                              >
                                {m.is_active ? (
                                  <>
                                    <UserX className="h-4 w-4" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Enable
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {canAct && !isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onSelect={() => setConfirmRemove(m)}>
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="text-xs text-zinc-500">
            {selectedIds.size} selected (bulk actions coming soon)
          </div>
        )}
      </div>

      {/* Invite modal */}
      <Dialog
        open={showInvite}
        onOpenChange={(open) => {
          setShowInvite(open);
          if (!open) {
            setInviteSuccess(null);
            invite.reset();
          }
        }}
        title="Invite member"
        description="Add a new user to your organization."
      >
        {inviteSuccess ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 dark:bg-green-950 dark:border-green-900 dark:text-green-200">
              {inviteSuccess}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setInviteSuccess(null);
                }}
              >
                Invite another
              </Button>
              <Button
                onClick={() => {
                  setInviteSuccess(null);
                  setShowInvite(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              id="people-invite-email"
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <Input
              id="people-invite-name"
              label="Display name"
              placeholder="Optional"
              value={inviteDisplayName}
              onChange={(e) => setInviteDisplayName(e.target.value)}
            />
            <Select
              label="Role"
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
                { value: 'viewer', label: 'Viewer' },
              ]}
              value={inviteRole}
              onValueChange={setInviteRole}
            />
            {invite.isError && (
              <p className="text-sm text-red-600">
                {(invite.error as Error)?.message ?? 'Failed to invite member.'}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={invite.isPending}
                disabled={!inviteEmail.trim()}
              >
                Invite
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Confirm remove */}
      <Dialog
        open={!!confirmRemove}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(null);
        }}
        title="Remove member"
        description={
          confirmRemove
            ? `Remove ${confirmRemove.display_name || confirmRemove.email} from this organization?`
            : ''
        }
      >
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => confirmRemove && remove.mutate(confirmRemove.id)}
          >
            Remove
          </Button>
        </div>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) closeResetDialog();
        }}
        title={resetResult ? 'Password reset complete' : 'Reset password'}
        description={
          resetResult
            ? `Share this password with ${resetTarget?.email}. It will not be shown again.`
            : `Reset the password for ${resetTarget?.display_name || resetTarget?.email}.`
        }
      >
        {!resetResult ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!resetTarget) return;
              resetPassword.mutate({
                userId: resetTarget.id,
                password: resetMode === 'manual' ? resetManual : undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={resetMode === 'generate'}
                  onChange={() => setResetMode('generate')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Auto-generate a strong password
                  </div>
                  <div className="text-xs text-zinc-500">16 chars, alphanumeric</div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={resetMode === 'manual'}
                  onChange={() => setResetMode('manual')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Enter a password manually
                  </div>
                  <div className="text-xs text-zinc-500 mb-2">Minimum 12 characters</div>
                  {resetMode === 'manual' && (
                    <Input
                      type="text"
                      value={resetManual}
                      onChange={(e) => setResetManual(e.target.value)}
                      placeholder="new password"
                      minLength={12}
                      autoFocus
                    />
                  )}
                </div>
              </label>
            </div>

            {resetPassword.isError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300">
                {(resetPassword.error as Error)?.message || 'Reset failed'}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeResetDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={resetPassword.isPending}
                disabled={resetMode === 'manual' && resetManual.length < 12}
              >
                Reset password
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200">
              This password is shown <strong>only once</strong>. Copy it now.
            </div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-900 dark:text-zinc-100 break-all">
                {resetResult}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetResult);
                  setResetCopied(true);
                  setTimeout(() => setResetCopied(false), 2000);
                }}
                className="shrink-0 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {resetCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-end">
              <Button onClick={closeResetDialog}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </AppLayout>
  );
}

// Suppress unused-import warning for types in case someone imports MemberRole externally
export type { MemberRole };
