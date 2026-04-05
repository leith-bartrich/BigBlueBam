import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MoreHorizontal,
  Crown,
  UserX,
  UserCheck,
  Trash2,
  KeyRound,
  Lock,
  Plus,
  Loader2,
  X as XIcon,
} from 'lucide-react';
import type { PaginatedResponse, Project } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { Dialog } from '@/components/common/dialog';
import { Avatar } from '@/components/common/avatar';
import { Badge } from '@/components/common/badge';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { peopleApi, canActOn, type ProjectMemberRole, type PersonProjectMembership } from '@/lib/api/people';
import { formatDate, formatRelativeTime } from '@/lib/utils';

interface PersonDetailPageProps {
  userId: string;
  onNavigate: (path: string) => void;
}

type DetailTab = 'overview' | 'projects';

const PROJECT_ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const ORG_ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'guest', label: 'Guest' },
];

export function PersonDetailPage({ userId, onNavigate }: PersonDetailPageProps) {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DetailTab>('overview');

  // Fetch member detail
  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['people', 'member', userId],
    queryFn: () => peopleApi.getMember(userId),
  });
  const member = detailRes?.data;

  // Identity form state
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [timezoneInput, setTimezoneInput] = useState('');
  const [identityDirty, setIdentityDirty] = useState(false);

  useEffect(() => {
    if (member) {
      setDisplayNameInput(member.display_name ?? '');
      setTimezoneInput(member.timezone ?? 'UTC');
      setIdentityDirty(false);
    }
  }, [member?.id, member?.display_name, member?.timezone]);

  // Dialogs
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [showAddProjects, setShowAddProjects] = useState(false);

  // Reset-password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'generate' | 'manual'>('generate');
  const [resetManual, setResetManual] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['people'] });
  };

  // --- Mutations ---
  const updateProfile = useMutation({
    mutationFn: () =>
      peopleApi.updateProfile(userId, {
        display_name: displayNameInput,
        timezone: timezoneInput,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', 'member', userId] });
      queryClient.invalidateQueries({ queryKey: ['people', 'members'] });
      setIdentityDirty(false);
    },
  });

  const updateOrgRole = useMutation({
    mutationFn: (role: string) => peopleApi.updateRole(userId, role),
    onSuccess: invalidateAll,
  });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => peopleApi.setActive(userId, isActive),
    onSuccess: invalidateAll,
  });

  const transfer = useMutation({
    mutationFn: () => peopleApi.transferOwnership(userId),
    onSuccess: () => {
      invalidateAll();
      // Also refetch current user role (demotion)
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setConfirmTransfer(false);
    },
  });

  const removeMember = useMutation({
    mutationFn: () => peopleApi.removeMember(userId),
    onSuccess: () => {
      invalidateAll();
      onNavigate('/people');
    },
  });

  const resetPassword = useMutation({
    mutationFn: (password: string | undefined) => peopleApi.resetPassword(userId, password),
    onSuccess: (res) => {
      setResetResult(res.data.password);
      setResetCopied(false);
    },
  });

  const closeResetDialog = () => {
    setResetOpen(false);
    setResetMode('generate');
    setResetManual('');
    setResetResult(null);
    setResetCopied(false);
    resetPassword.reset();
  };

  // --- Render guards ---
  if (isLoading) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'People', href: '/people' }, { label: '...' }]}
        onNavigate={onNavigate}
        onCreateProject={() => onNavigate('/')}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'People', href: '/people' }, { label: 'Not found' }]}
        onNavigate={onNavigate}
        onCreateProject={() => onNavigate('/')}
      >
        <div className="max-w-7xl mx-auto px-6 py-10">
          <p className="text-sm text-zinc-500">Member not found.</p>
          <Button variant="ghost" onClick={() => onNavigate('/people')} className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to People
          </Button>
        </div>
      </AppLayout>
    );
  }

  const canAct = canActOn(currentUser, member);
  const isSelf = member.id === currentUser?.id;
  const callerIsOwner = currentUser?.role === 'owner' || currentUser?.is_superuser === true;

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'People', href: '/people' },
        { label: member.display_name || member.email },
      ]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar src={member.avatar_url} name={member.display_name} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {member.display_name || member.email}
                </h1>
                {member.is_active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="danger">Disabled</Badge>
                )}
                <span className="text-xs capitalize text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-0.5">
                  {member.role}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mt-1">{member.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onNavigate('/people')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <DropdownMenu
              trigger={
                <button
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            >
              {canAct && (
                <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                  <KeyRound className="h-4 w-4" /> Reset password
                </DropdownMenuItem>
              )}
              {canAct && (
                <DropdownMenuItem
                  onSelect={() => {
                    /* stub */
                  }}
                >
                  <Lock className="h-4 w-4" /> Force password change
                </DropdownMenuItem>
              )}
              {canAct && !isSelf && (
                <DropdownMenuItem onSelect={() => setActive.mutate(!member.is_active)}>
                  {member.is_active ? (
                    <>
                      <UserX className="h-4 w-4" /> Disable account
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" /> Enable account
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {callerIsOwner && !isSelf && member.role !== 'owner' && (
                <DropdownMenuItem onSelect={() => setConfirmTransfer(true)}>
                  <Crown className="h-4 w-4" /> Transfer ownership
                </DropdownMenuItem>
              )}
              {canAct && !isSelf && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setConfirmRemove(true)}>
                    <Trash2 className="h-4 w-4" /> Remove from org
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'projects'} onClick={() => setTab('projects')}>
            Projects
          </TabButton>
        </div>

        {tab === 'overview' && (
          <div className="space-y-5">
            {!member.is_active && member.disabled_at && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                Account disabled
                {member.disabled_by && ` by ${member.disabled_by.display_name || member.disabled_by.email}`}
                {` on ${formatDate(member.disabled_at)}.`}
              </div>
            )}

            {/* Identity card */}
            <Card title="Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  id="detail-display-name"
                  label="Display name"
                  value={displayNameInput}
                  onChange={(e) => {
                    setDisplayNameInput(e.target.value);
                    setIdentityDirty(true);
                  }}
                  disabled={!canAct && !isSelf}
                />
                <Input
                  id="detail-timezone"
                  label="Timezone"
                  value={timezoneInput}
                  onChange={(e) => {
                    setTimezoneInput(e.target.value);
                    setIdentityDirty(true);
                  }}
                  disabled={!canAct && !isSelf}
                  placeholder="UTC"
                />
              </div>
              <div className="text-xs text-zinc-500 mt-3">
                Avatar:{' '}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {member.avatar_url ? 'custom image' : 'default initials'}
                </span>{' '}
                (editing coming soon)
              </div>
              {(canAct || isSelf) && (
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDisplayNameInput(member.display_name ?? '');
                      setTimezoneInput(member.timezone ?? 'UTC');
                      setIdentityDirty(false);
                    }}
                    disabled={!identityDirty}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateProfile.mutate()}
                    loading={updateProfile.isPending}
                    disabled={!identityDirty}
                  >
                    Save
                  </Button>
                </div>
              )}
              {updateProfile.isError && (
                <p className="text-sm text-red-600 mt-2">
                  {(updateProfile.error as Error)?.message ?? 'Save failed'}
                </p>
              )}
            </Card>

            {/* Membership card */}
            <Card title="Membership">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <Row label="Role">
                  {canAct ? (
                    <Select
                      options={ORG_ROLE_OPTIONS}
                      value={member.role}
                      onValueChange={(role) => updateOrgRole.mutate(role)}
                      className="w-32"
                    />
                  ) : (
                    <span className="capitalize text-zinc-700 dark:text-zinc-300">{member.role}</span>
                  )}
                </Row>
                <Row label="Default org">
                  {member.is_default_org ? (
                    <Badge variant="info">Yes</Badge>
                  ) : (
                    <span className="text-zinc-500">No</span>
                  )}
                </Row>
                <Row label="Joined">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(member.joined_at)}
                  </span>
                </Row>
                <Row label="Last seen">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {member.last_seen_at ? formatRelativeTime(member.last_seen_at) : 'Never'}
                  </span>
                </Row>
                {!member.is_active && (
                  <>
                    <Row label="Disabled at">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {formatDate(member.disabled_at)}
                      </span>
                    </Row>
                    <Row label="Disabled by">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {member.disabled_by?.display_name || member.disabled_by?.email || '—'}
                      </span>
                    </Row>
                  </>
                )}
              </dl>
            </Card>
          </div>
        )}

        {tab === 'projects' && (
          <ProjectsTab
            userId={userId}
            canAct={canAct}
            onAddClick={() => setShowAddProjects(true)}
          />
        )}
      </div>

      {/* Add-projects modal */}
      {showAddProjects && (
        <AddProjectsDialog
          userId={userId}
          onClose={() => setShowAddProjects(false)}
        />
      )}

      {/* Transfer ownership confirm */}
      <Dialog
        open={confirmTransfer}
        onOpenChange={setConfirmTransfer}
        title="Transfer ownership"
        description={
          currentUser?.is_superuser_viewing
            ? `Promote ${member.display_name || member.email} to owner of this organization? You are acting as a SuperUser and will not be demoted.`
            : currentUser?.role === 'owner'
            ? `Promote ${member.display_name || member.email} to owner and demote yourself to admin?`
            : `Promote ${member.display_name || member.email} to owner of this organization?`
        }
      >
        {transfer.isError && (
          <p className="text-sm text-red-600 mb-3">
            {(transfer.error as Error)?.message ?? 'Transfer failed'}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setConfirmTransfer(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={transfer.isPending} onClick={() => transfer.mutate()}>
            Transfer ownership
          </Button>
        </div>
      </Dialog>

      {/* Confirm remove */}
      <Dialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove from organization"
        description={`Remove ${member.display_name || member.email} from this organization? Their access will be revoked.`}
      >
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={removeMember.isPending}
            onClick={() => removeMember.mutate()}
          >
            Remove
          </Button>
        </div>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (!open) closeResetDialog();
        }}
        title={resetResult ? 'Password reset complete' : 'Reset password'}
        description={
          resetResult
            ? `Share this password with ${member.email}. It will not be shown again.`
            : `Reset the password for ${member.display_name || member.email}.`
        }
      >
        {!resetResult ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetPassword.mutate(resetMode === 'manual' ? resetManual : undefined);
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

// --- Supporting components ---

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ' +
        (active
          ? 'border-primary-600 text-primary-700 dark:text-primary-300'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
      }
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 last:border-0 last:pb-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ProjectsTab({
  userId,
  canAct,
  onAddClick,
}: {
  userId: string;
  canAct: boolean;
  onAddClick: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'member', userId, 'projects'],
    queryFn: () => peopleApi.listMemberProjects(userId),
  });
  const memberships = data?.data ?? [];

  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['people', 'member', userId, 'projects'] });
    queryClient.invalidateQueries({ queryKey: ['people', 'member', userId] });
  };

  const updateRole = useMutation({
    mutationFn: ({ projectId, role }: { projectId: string; role: ProjectMemberRole }) =>
      peopleApi.updateMemberProjectRole(userId, projectId, role),
    onSuccess: invalidateProjects,
  });

  const remove = useMutation({
    mutationFn: (projectId: string) => peopleApi.removeMemberFromProject(userId, projectId),
    onSuccess: invalidateProjects,
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Project access</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Projects this user belongs to in the current organization.
          </p>
        </div>
        {canAct && (
          <Button size="sm" onClick={onAddClick}>
            <Plus className="h-4 w-4" /> Add to project
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="px-6 py-10 text-center text-sm text-zinc-400">Loading...</p>
      ) : memberships.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-zinc-400">
          Not a member of any project in this org.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                <th className="px-4 py-2.5 font-medium text-zinc-500">Project</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500">Role</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500">Joined</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m: PersonProjectMembership) => (
                <tr
                  key={m.project_id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {m.project_name}
                      </span>
                      {m.is_archived && <Badge variant="warning">Archived</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {canAct ? (
                      <Select
                        options={PROJECT_ROLE_OPTIONS}
                        value={m.role}
                        onValueChange={(v) =>
                          updateRole.mutate({
                            projectId: m.project_id,
                            role: v as ProjectMemberRole,
                          })
                        }
                        className="w-28"
                      />
                    ) : (
                      <span className="capitalize text-zinc-700 dark:text-zinc-300">{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{formatDate(m.joined_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canAct && (
                      <button
                        onClick={() => remove.mutate(m.project_id)}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Remove from project"
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddProjectsDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: allProjectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects'),
  });
  const allProjects = allProjectsRes?.data ?? [];

  const { data: membershipRes } = useQuery({
    queryKey: ['people', 'member', userId, 'projects'],
    queryFn: () => peopleApi.listMemberProjects(userId),
  });
  const currentMemberships = membershipRes?.data ?? [];
  const currentIds = useMemo(
    () => new Set(currentMemberships.map((m) => m.project_id)),
    [currentMemberships],
  );

  const availableProjects = useMemo(
    () => allProjects.filter((p) => !currentIds.has(p.id)),
    [allProjects, currentIds],
  );

  const [selections, setSelections] = useState<Record<string, ProjectMemberRole>>({});

  const toggle = (projectId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[projectId]) {
        delete next[projectId];
      } else {
        next[projectId] = 'member';
      }
      return next;
    });
  };

  const setRole = (projectId: string, role: ProjectMemberRole) => {
    setSelections((prev) => ({ ...prev, [projectId]: role }));
  };

  const add = useMutation({
    mutationFn: () =>
      peopleApi.addMemberToProjects(userId, {
        assignments: Object.entries(selections).map(([project_id, role]) => ({
          project_id,
          role,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', 'member', userId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['people', 'member', userId] });
      onClose();
    },
  });

  const selectedCount = Object.keys(selections).length;

  return (
    <Dialog
      open={true}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Add to project(s)"
      description="Pick one or more projects and a role per assignment."
    >
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {availableProjects.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">
            User is already on every project in this organization.
          </p>
        ) : (
          availableProjects.map((project) => {
            const isSelected = !!selections[project.id];
            return (
              <div
                key={project.id}
                className={
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ' +
                  (isSelected
                    ? 'border-primary-300 bg-primary-50 dark:bg-primary-950/30 dark:border-primary-800'
                    : 'border-zinc-200 dark:border-zinc-700')
                }
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(project.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700"
                  />
                  <span
                    className="flex items-center justify-center h-6 w-6 rounded text-xs font-medium text-white shrink-0"
                    style={{ backgroundColor: project.color ?? '#2563eb' }}
                  >
                    {project.icon ?? project.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {project.name}
                  </span>
                </label>
                {isSelected && (
                  <Select
                    options={PROJECT_ROLE_OPTIONS}
                    value={selections[project.id]}
                    onValueChange={(v) => setRole(project.id, v as ProjectMemberRole)}
                    className="w-28"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {add.isError && (
        <p className="text-sm text-red-600 mt-3">
          {(add.error as Error)?.message ?? 'Add failed'}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-xs text-zinc-500">{selectedCount} selected</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            <XIcon className="h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={() => add.mutate()}
            loading={add.isPending}
            disabled={selectedCount === 0}
          >
            Add selected
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
