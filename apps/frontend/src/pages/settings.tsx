import { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, User, Bell, Users, Trash2, Plug, Copy, Check, Plus, Headset, Pencil, Lock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse, ApiResponse, Project } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ApiKeyData {
  id: string;
  name: string;
  key_prefix: string;
  key_hint: string;
  scope: string;
  project_ids: string[] | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  key?: string; // only present on creation
}

interface WebhookData {
  id: string;
  project_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SlackIntegrationData {
  id: string;
  project_id: string;
  webhook_url: string;
  notify_on_task_created: boolean;
  notify_on_task_completed: boolean;
  notify_on_sprint_started: boolean;
  notify_on_sprint_completed: boolean;
  slash_command_token: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const WEBHOOK_EVENT_TYPES = [
  'task.created',
  'task.updated',
  'task.deleted',
  'comment.created',
  'sprint.started',
  'sprint.completed',
];

interface SettingsPageProps {
  onNavigate: (path: string) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'members' | 'integrations' | 'helpdesk' | 'permissions'>('profile');
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('bbam-theme') as 'system' | 'light' | 'dark') ?? 'system';
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Integrations tab state
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState('read');
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [showAddWebhook, setShowAddWebhook] = useState<string | null>(null); // project id
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editWebhookUrl, setEditWebhookUrl] = useState('');
  const [editWebhookEvents, setEditWebhookEvents] = useState<string[]>([]);

  // Slack integration state (per project, editing one at a time)
  const [slackProjectId, setSlackProjectId] = useState<string>('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackToken, setSlackToken] = useState('');
  const [slackNotifyTaskCreated, setSlackNotifyTaskCreated] = useState(true);
  const [slackNotifyTaskCompleted, setSlackNotifyTaskCompleted] = useState(true);
  const [slackNotifySprintStarted, setSlackNotifySprintStarted] = useState(true);
  const [slackNotifySprintCompleted, setSlackNotifySprintCompleted] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [slackTestStatus, setSlackTestStatus] = useState<string | null>(null);

  // GitHub integration state (per project, editing one at a time)
  const [ghProjectId, setGhProjectId] = useState<string>('');
  const [ghRepoOwner, setGhRepoOwner] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghOpenPhaseId, setGhOpenPhaseId] = useState<string>('');
  const [ghMergedPhaseId, setGhMergedPhaseId] = useState<string>('');
  const [ghEnabled, setGhEnabled] = useState(true);
  const [ghRevealedSecret, setGhRevealedSecret] = useState<string | null>(null);

  // Helpdesk tab state
  const [helpdeskRequireVerification, setHelpdeskRequireVerification] = useState(false);
  const [helpdeskAllowedDomains, setHelpdeskAllowedDomains] = useState('');
  const [helpdeskDefaultProject, setHelpdeskDefaultProject] = useState('');
  const [helpdeskDefaultPhase, setHelpdeskDefaultPhase] = useState('');
  const [helpdeskWelcomeMessage, setHelpdeskWelcomeMessage] = useState('');
  const [helpdeskCategories, setHelpdeskCategories] = useState('');
  const [helpdeskNotifyOnStatus, setHelpdeskNotifyOnStatus] = useState(true);
  const [helpdeskNotifyOnReply, setHelpdeskNotifyOnReply] = useState(true);
  const [helpdeskSaving, setHelpdeskSaving] = useState(false);
  const [helpdeskSaved, setHelpdeskSaved] = useState(false);

  // Fetch projects for integrations
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects'),
    enabled: activeTab === 'integrations',
  });
  const projects = projectsRes?.data ?? [];

  // Fetch API keys
  const { data: apiKeysRes } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<{ data: ApiKeyData[] }>('/auth/api-keys'),
    enabled: activeTab === 'integrations',
  });
  const apiKeysData = apiKeysRes?.data ?? [];

  // Create API key mutation
  const createApiKey = useMutation({
    mutationFn: (data: { name: string; scope: string }) =>
      api.post<{ data: ApiKeyData }>('/auth/api-keys', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKeyValue(res.data.key ?? null);
      setNewKeyName('');
      setNewKeyScope('read');
      setShowCreateKey(false);
    },
  });

  // Revoke API key mutation
  const revokeApiKey = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Fetch webhooks per project (only for the integrations tab)
  const { data: webhooksData } = useQuery({
    queryKey: ['all-webhooks', projects.map((p) => p.id)],
    queryFn: async () => {
      const results: Record<string, WebhookData[]> = {};
      for (const project of projects) {
        const res = await api.get<{ data: WebhookData[] }>(`/projects/${project.id}/webhooks`);
        results[project.id] = res.data;
      }
      return results;
    },
    enabled: activeTab === 'integrations' && projects.length > 0,
  });

  // Create webhook mutation
  const createWebhook = useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { url: string; events: string[]; secret: string } }) =>
      api.post(`/projects/${projectId}/webhooks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-webhooks'] });
      setShowAddWebhook(null);
      setWebhookUrl('');
      setWebhookSecret('');
      setWebhookEvents([]);
    },
  });

  // Fetch helpdesk settings
  const { data: helpdeskSettingsRes } = useQuery({
    queryKey: ['helpdesk-settings'],
    queryFn: async () => {
      const res = await fetch('/helpdesk-api/helpdesk/settings', { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: activeTab === 'helpdesk',
  });

  // Fetch all projects for helpdesk default project picker
  const { data: helpdeskProjectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects'),
    enabled: activeTab === 'helpdesk' || activeTab === 'integrations',
  });
  const helpdeskProjects = helpdeskProjectsRes?.data ?? [];

  // Fetch phases for selected helpdesk default project
  const { data: helpdeskPhasesRes } = useQuery({
    queryKey: ['project-phases', helpdeskDefaultProject],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>(`/projects/${helpdeskDefaultProject}/phases`),
    enabled: !!helpdeskDefaultProject && activeTab === 'helpdesk',
  });
  const helpdeskPhases = helpdeskPhasesRes?.data ?? [];

  // Load helpdesk settings into state when fetched
  useEffect(() => {
    if (helpdeskSettingsRes) {
      setHelpdeskRequireVerification(helpdeskSettingsRes.require_email_verification ?? false);
      setHelpdeskAllowedDomains((helpdeskSettingsRes.allowed_email_domains ?? []).join(', '));
      setHelpdeskDefaultProject(helpdeskSettingsRes.default_project_id ?? '');
      setHelpdeskDefaultPhase(helpdeskSettingsRes.default_phase_id ?? '');
      setHelpdeskWelcomeMessage(helpdeskSettingsRes.welcome_message ?? '');
      setHelpdeskCategories((helpdeskSettingsRes.ticket_categories ?? []).join('\n'));
      setHelpdeskNotifyOnStatus(helpdeskSettingsRes.notify_client_on_status_change ?? true);
      setHelpdeskNotifyOnReply(helpdeskSettingsRes.notify_client_on_agent_reply ?? true);
    }
  }, [helpdeskSettingsRes]);

  const handleSaveHelpdeskSettings = async () => {
    setHelpdeskSaving(true);
    try {
      const csrfMatch = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
        : null;
      const csrfHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfMatch) csrfHeaders['X-CSRF-Token'] = decodeURIComponent(csrfMatch[1]!);
      await fetch('/helpdesk-api/helpdesk/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: csrfHeaders,
        body: JSON.stringify({
          require_email_verification: helpdeskRequireVerification,
          allowed_email_domains: helpdeskAllowedDomains.split(',').map((d) => d.trim()).filter(Boolean),
          default_project_id: helpdeskDefaultProject || null,
          default_phase_id: helpdeskDefaultPhase || null,
          welcome_message: helpdeskWelcomeMessage,
          ticket_categories: helpdeskCategories.split('\n').map((c) => c.trim()).filter(Boolean),
          notify_client_on_status_change: helpdeskNotifyOnStatus,
          notify_client_on_agent_reply: helpdeskNotifyOnReply,
        }),
      });
      setHelpdeskSaved(true);
      setTimeout(() => setHelpdeskSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['helpdesk-settings'] });
    } catch {
      // error handling
    } finally {
      setHelpdeskSaving(false);
    }
  };

  // Delete webhook mutation
  const deleteWebhook = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-webhooks'] });
    },
  });

  // Update webhook mutation
  const updateWebhook = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { url: string; events: string[] } }) =>
      api.patch(`/webhooks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-webhooks'] });
      setEditingWebhookId(null);
    },
  });

  // Slack integration: fetch current config for selected project
  const { data: slackIntegrationRes } = useQuery({
    queryKey: ['slack-integration', slackProjectId],
    queryFn: () => api.get<{ data: SlackIntegrationData | null }>(`/projects/${slackProjectId}/slack-integration`),
    enabled: activeTab === 'integrations' && !!slackProjectId,
  });

  // Load fetched slack config into form state when project changes
  useEffect(() => {
    if (!slackProjectId) return;
    const row = slackIntegrationRes?.data;
    if (row) {
      setSlackWebhookUrl(row.webhook_url);
      setSlackToken(row.slash_command_token ?? '');
      setSlackNotifyTaskCreated(row.notify_on_task_created);
      setSlackNotifyTaskCompleted(row.notify_on_task_completed);
      setSlackNotifySprintStarted(row.notify_on_sprint_started);
      setSlackNotifySprintCompleted(row.notify_on_sprint_completed);
      setSlackEnabled(row.enabled);
    } else {
      setSlackWebhookUrl('');
      setSlackToken('');
      setSlackNotifyTaskCreated(true);
      setSlackNotifyTaskCompleted(true);
      setSlackNotifySprintStarted(true);
      setSlackNotifySprintCompleted(true);
      setSlackEnabled(true);
    }
    setSlackTestStatus(null);
  }, [slackIntegrationRes, slackProjectId]);

  // Save Slack integration mutation (upsert)
  const saveSlack = useMutation({
    mutationFn: () =>
      api.put(`/projects/${slackProjectId}/slack-integration`, {
        webhook_url: slackWebhookUrl,
        slash_command_token: slackToken || null,
        notify_on_task_created: slackNotifyTaskCreated,
        notify_on_task_completed: slackNotifyTaskCompleted,
        notify_on_sprint_started: slackNotifySprintStarted,
        notify_on_sprint_completed: slackNotifySprintCompleted,
        enabled: slackEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-integration', slackProjectId] });
    },
  });

  // Delete Slack integration mutation
  const deleteSlack = useMutation({
    mutationFn: () => api.delete(`/projects/${slackProjectId}/slack-integration`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-integration', slackProjectId] });
    },
  });

  // Send test message mutation
  const testSlack = useMutation({
    mutationFn: () => api.post<{ data: { ok: boolean; status: number } }>(`/projects/${slackProjectId}/slack-integration/test`, {}),
    onSuccess: (res) => {
      setSlackTestStatus(res.data.ok ? `OK (${res.data.status})` : `Failed (${res.data.status})`);
    },
    onError: () => {
      setSlackTestStatus('Failed — see server logs');
    },
  });

  // GitHub integration: fetch current config + phases for selected project
  interface GithubIntegrationData {
    id: string;
    project_id: string;
    repo_owner: string;
    repo_name: string;
    transition_on_pr_open_phase_id: string | null;
    transition_on_pr_merged_phase_id: string | null;
    enabled: boolean;
    webhook_secret?: string | null;
  }
  const { data: ghIntegrationRes } = useQuery({
    queryKey: ['github-integration', ghProjectId],
    queryFn: () => api.get<{ data: GithubIntegrationData | null }>(`/projects/${ghProjectId}/github-integration`),
    enabled: activeTab === 'integrations' && !!ghProjectId,
  });
  const { data: ghPhasesRes } = useQuery({
    queryKey: ['project-phases', ghProjectId],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>(`/projects/${ghProjectId}/phases`),
    enabled: activeTab === 'integrations' && !!ghProjectId,
  });
  const ghPhases = ghPhasesRes?.data ?? [];

  useEffect(() => {
    if (!ghProjectId) return;
    const row = ghIntegrationRes?.data;
    if (row) {
      setGhRepoOwner(row.repo_owner);
      setGhRepoName(row.repo_name);
      setGhOpenPhaseId(row.transition_on_pr_open_phase_id ?? '');
      setGhMergedPhaseId(row.transition_on_pr_merged_phase_id ?? '');
      setGhEnabled(row.enabled);
    } else {
      setGhRepoOwner('');
      setGhRepoName('');
      setGhOpenPhaseId('');
      setGhMergedPhaseId('');
      setGhEnabled(true);
    }
    setGhRevealedSecret(null);
  }, [ghIntegrationRes, ghProjectId]);

  const saveGithub = useMutation({
    mutationFn: (opts: { regenerate?: boolean }) =>
      api.put<{ data: GithubIntegrationData & { webhook_secret: string | null } }>(
        `/projects/${ghProjectId}/github-integration`,
        {
          repo_owner: ghRepoOwner.trim(),
          repo_name: ghRepoName.trim(),
          transition_on_pr_open_phase_id: ghOpenPhaseId || null,
          transition_on_pr_merged_phase_id: ghMergedPhaseId || null,
          enabled: ghEnabled,
          regenerate_secret: opts.regenerate === true ? true : undefined,
        },
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['github-integration', ghProjectId] });
      if (res.data.webhook_secret) setGhRevealedSecret(res.data.webhook_secret);
    },
  });

  const deleteGithub = useMutation({
    mutationFn: () => api.delete(`/projects/${ghProjectId}/github-integration`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-integration', ghProjectId] });
      setGhRevealedSecret(null);
    },
  });

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  // Permissions tab state
  interface OrgPermissions {
    members_can_create_projects: boolean;
    members_can_delete_own_projects: boolean;
    members_can_create_channels: boolean;
    members_can_create_private_channels: boolean;
    members_can_create_group_dms: boolean;
    max_file_upload_mb: number;
    members_can_invite_members: boolean;
    members_can_create_api_keys: boolean;
    allowed_api_key_scopes: string[];
  }
  const DEFAULT_PERMS: OrgPermissions = {
    members_can_create_projects: true,
    members_can_delete_own_projects: false,
    members_can_create_channels: true,
    members_can_create_private_channels: true,
    members_can_create_group_dms: true,
    max_file_upload_mb: 25,
    members_can_invite_members: false,
    members_can_create_api_keys: true,
    allowed_api_key_scopes: ['read', 'read_write'],
  };
  const [permissions, setPermissions] = useState<OrgPermissions>(DEFAULT_PERMS);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsSaved, setPermissionsSaved] = useState(false);

  interface OrgData {
    id: string;
    name: string;
    slug: string;
    settings: { permissions?: Partial<OrgPermissions>; [key: string]: unknown } | null;
  }
  const { data: orgRes } = useQuery({
    queryKey: ['org'],
    queryFn: () => api.get<ApiResponse<OrgData>>('/org'),
    enabled: activeTab === 'permissions',
  });

  useEffect(() => {
    if (orgRes?.data) {
      const existing = orgRes.data.settings?.permissions ?? {};
      setPermissions({ ...DEFAULT_PERMS, ...existing });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgRes]);

  const canEditPermissions = user?.role === 'admin' || user?.role === 'owner';

  const updatePermissions = useMutation({
    mutationFn: (perms: OrgPermissions) => {
      const existingSettings = (orgRes?.data?.settings ?? {}) as Record<string, unknown>;
      return api.patch<ApiResponse<OrgData>>('/org', {
        settings: { ...existingSettings, permissions: perms },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org'] });
      setPermissionsSaved(true);
      setTimeout(() => setPermissionsSaved(false), 2000);
    },
    onSettled: () => setPermissionsSaving(false),
  });

  const handleSavePermissions = () => {
    setPermissionsSaving(true);
    updatePermissions.mutate(permissions);
  };

  const toggleApiKeyScope = (scope: string) => {
    setPermissions((p) => ({
      ...p,
      allowed_api_key_scopes: p.allowed_api_key_scopes.includes(scope)
        ? p.allowed_api_key_scopes.filter((s) => s !== scope)
        : [...p.allowed_api_key_scopes, scope],
    }));
  };

  const applyTheme = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('bbam-theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('dark');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/me', { display_name: displayName, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'appearance' as const, label: 'Appearance', icon: Sun },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'members' as const, label: 'Members', icon: Users },
    { id: 'permissions' as const, label: 'Permissions', icon: Lock },
    { id: 'integrations' as const, label: 'Integrations', icon: Plug },
    { id: 'helpdesk' as const, label: 'Helpdesk', icon: Headset },
  ];

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Settings' }]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Settings</h1>

        <div className="flex gap-6">
          <nav className="w-48 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 dark:bg-zinc-800 dark:text-primary-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Profile</h2>
                  <p className="text-sm text-zinc-500">Update your personal information.</p>
                </div>
                <Input
                  id="display-name"
                  label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Input
                  id="email"
                  label="Email"
                  value={user?.email ?? ''}
                  disabled
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                  >
                    {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
                  {saved && <span className="text-sm text-green-600">Saved!</span>}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Appearance</h2>
                  <p className="text-sm text-zinc-500">Customize how BigBlueBam looks.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 block">Theme</label>
                  <div className="flex gap-3">
                    {([
                      { value: 'system' as const, label: 'System', icon: Monitor },
                      { value: 'light' as const, label: 'Light', icon: Sun },
                      { value: 'dark' as const, label: 'Dark', icon: Moon },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => applyTheme(opt.value)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                          theme === opt.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-zinc-800 dark:text-primary-400'
                            : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400'
                        }`}
                      >
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Notifications</h2>
                  <p className="text-sm text-zinc-500">Configure how you receive notifications.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Task assigned to me', key: 'assigned' },
                    { label: 'Mentioned in comments', key: 'mentioned' },
                    { label: 'Task state changed', key: 'state_changed' },
                    { label: 'Sprint started/completed', key: 'sprint' },
                    { label: 'Due date approaching', key: 'due_date' },
                  ].map((pref) => (
                    <label key={pref.key} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{pref.label}</span>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-3">
                <Users className="h-10 w-10 text-zinc-400 mx-auto" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Member management has moved</h2>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  Invite, edit, and manage members on the dedicated People page.
                </p>
                <Button onClick={() => onNavigate('/people')}>Go to People</Button>
              </div>
            )}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* Calendar Feeds */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Calendar Feeds</h2>
                    <p className="text-sm text-zinc-500">
                      Subscribe to these URLs in Google Calendar, Outlook, or Apple Calendar to see task due dates.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Personal calendar */}
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">My Tasks (Personal)</p>
                        <p className="text-xs text-zinc-400 truncate font-mono">
                          {window.location.origin}/b3/api/me/calendar.ics?token=API_KEY
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyUrl(`${window.location.origin}/b3/api/me/calendar.ics?token=API_KEY`)}
                        className="shrink-0 rounded-md p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Copy URL"
                      >
                        {copiedUrl === `${window.location.origin}/b3/api/me/calendar.ics?token=API_KEY` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 -mt-1 ml-1">
                      Replace API_KEY with an actual API key from the section below.
                    </p>

                    {/* Per-project calendars */}
                    {projects.map((project) => {
                      const url = `${window.location.origin}/b3/api/projects/${project.id}/calendar.ics`;
                      return (
                        <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{project.name}</p>
                            <p className="text-xs text-zinc-400 truncate font-mono">{url}</p>
                          </div>
                          <button
                            onClick={() => handleCopyUrl(url)}
                            className="shrink-0 rounded-md p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl === url ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                    {projects.length === 0 && (
                      <p className="text-sm text-zinc-400">No projects found.</p>
                    )}
                  </div>
                </div>

                {/* API Keys */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">API Keys</h2>
                      <p className="text-sm text-zinc-500">
                        Use API keys to authenticate with the MCP server or REST API.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setShowCreateKey((v) => !v)}>
                      <Plus className="h-4 w-4" />
                      Create API Key
                    </Button>
                  </div>

                  {createdKeyValue && (
                    <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 space-y-2">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        API key created! Copy it now -- it will not be shown again.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white dark:bg-zinc-900 rounded px-3 py-2 font-mono border border-green-200 dark:border-green-800 break-all">
                          {createdKeyValue}
                        </code>
                        <button
                          onClick={() => handleCopyUrl(createdKeyValue)}
                          className="shrink-0 rounded-md p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {copiedUrl === createdKeyValue ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={() => setCreatedKeyValue(null)}
                        className="text-xs text-green-700 dark:text-green-300 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {showCreateKey && (
                    <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-3">
                      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Create a new API key</h3>
                      <div className="flex gap-3 items-end flex-wrap">
                        <Input
                          id="key-name"
                          label="Name"
                          placeholder="e.g. MCP Server"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          className="w-56"
                        />
                        <div
                          title={
                            user?.role === 'owner' || user?.is_superuser === true
                              ? undefined
                              : 'Admin-scope keys can only be created by an organization owner.'
                          }
                        >
                          <Select
                            label="Scope"
                            options={[
                              { value: 'read', label: 'Read' },
                              { value: 'read_write', label: 'Read / Write' },
                              ...(user?.role === 'owner' || user?.is_superuser === true
                                ? [{ value: 'admin', label: 'Admin' }]
                                : []),
                            ]}
                            value={newKeyScope}
                            onValueChange={setNewKeyScope}
                            className="w-32"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => createApiKey.mutate({ name: newKeyName, scope: newKeyScope })}
                          loading={createApiKey.isPending}
                          disabled={!newKeyName.trim()}
                        >
                          Create
                        </Button>
                      </div>
                      {user?.role !== 'owner' && user?.is_superuser !== true && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Admin-scope keys can only be created by an organization owner.
                        </p>
                      )}
                    </div>
                  )}

                  {apiKeysData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                            <th className="pb-2 font-medium text-zinc-500">Name</th>
                            <th className="pb-2 font-medium text-zinc-500">Key</th>
                            <th className="pb-2 font-medium text-zinc-500">Scope</th>
                            <th className="pb-2 font-medium text-zinc-500">Created</th>
                            <th className="pb-2 font-medium text-zinc-500 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeysData.map((key) => (
                            <tr key={key.id} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-3 text-zinc-900 dark:text-zinc-100">{key.name}</td>
                              <td className="py-3 text-zinc-500 font-mono text-xs">{key.key_hint}</td>
                              <td className="py-3 text-zinc-600 dark:text-zinc-400 capitalize">{key.scope}</td>
                              <td className="py-3 text-zinc-500">{formatDate(key.created_at)}</td>
                              <td className="py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => revokeApiKey.mutate(key.id)}
                                  loading={revokeApiKey.isPending}
                                >
                                  Revoke
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">No API keys created yet.</p>
                  )}
                </div>

                {/* Webhooks */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Webhooks</h2>
                    <p className="text-sm text-zinc-500">
                      Receive HTTP POST notifications when events occur. Configure webhooks per project.
                    </p>
                  </div>

                  {projects.map((project) => {
                    const projectWebhooks = webhooksData?.[project.id] ?? [];
                    return (
                      <div key={project.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{project.name}</h3>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowAddWebhook(showAddWebhook === project.id ? null : project.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Webhook
                          </Button>
                        </div>

                        {showAddWebhook === project.id && (
                          <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-3">
                            <Input
                              id={`webhook-url-${project.id}`}
                              label="URL"
                              placeholder="https://example.com/webhook"
                              value={webhookUrl}
                              onChange={(e) => setWebhookUrl(e.target.value)}
                            />
                            <Input
                              id={`webhook-secret-${project.id}`}
                              label="Secret (min 16 characters)"
                              placeholder="your-webhook-secret"
                              value={webhookSecret}
                              onChange={(e) => setWebhookSecret(e.target.value)}
                            />
                            <div>
                              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Events</label>
                              <div className="flex flex-wrap gap-2">
                                {WEBHOOK_EVENT_TYPES.map((evt) => (
                                  <label key={evt} className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                    <input
                                      type="checkbox"
                                      checked={webhookEvents.includes(evt)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setWebhookEvents((prev) => [...prev, evt]);
                                        } else {
                                          setWebhookEvents((prev) => prev.filter((x) => x !== evt));
                                        }
                                      }}
                                      className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    {evt}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() =>
                                createWebhook.mutate({
                                  projectId: project.id,
                                  data: { url: webhookUrl, events: webhookEvents, secret: webhookSecret },
                                })
                              }
                              loading={createWebhook.isPending}
                              disabled={!webhookUrl.trim() || webhookSecret.length < 16 || webhookEvents.length === 0}
                            >
                              Save Webhook
                            </Button>
                          </div>
                        )}

                        {projectWebhooks.length > 0 ? (
                          <div className="space-y-2">
                            {projectWebhooks.map((wh) => (
                              <div key={wh.id}>
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate">{wh.url}</p>
                                    <p className="text-xs text-zinc-400">
                                      {wh.events.join(', ')} &middot; {wh.is_active ? 'Active' : 'Inactive'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingWebhookId(editingWebhookId === wh.id ? null : wh.id);
                                        setEditWebhookUrl(wh.url);
                                        setEditWebhookEvents([...wh.events]);
                                      }}
                                      className="p-1.5 rounded-md text-zinc-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
                                      title="Edit webhook"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteWebhook.mutate(wh.id)}
                                      className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                      title="Delete webhook"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                {editingWebhookId === wh.id && (
                                  <div className="mt-2 p-4 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-3">
                                    <Input
                                      id={`edit-webhook-url-${wh.id}`}
                                      label="URL"
                                      value={editWebhookUrl}
                                      onChange={(e) => setEditWebhookUrl(e.target.value)}
                                    />
                                    <div>
                                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Events</label>
                                      <div className="flex flex-wrap gap-2">
                                        {WEBHOOK_EVENT_TYPES.map((evt) => (
                                          <label key={evt} className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                            <input
                                              type="checkbox"
                                              checked={editWebhookEvents.includes(evt)}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setEditWebhookEvents((prev) => [...prev, evt]);
                                                } else {
                                                  setEditWebhookEvents((prev) => prev.filter((x) => x !== evt));
                                                }
                                              }}
                                              className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            {evt}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateWebhook.mutate({
                                            id: wh.id,
                                            data: { url: editWebhookUrl, events: editWebhookEvents },
                                          })
                                        }
                                        loading={updateWebhook.isPending}
                                        disabled={!editWebhookUrl.trim() || editWebhookEvents.length === 0}
                                      >
                                        Save Changes
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingWebhookId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400 ml-1">No webhooks configured.</p>
                        )}
                      </div>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="text-sm text-zinc-400">No projects found.</p>
                  )}
                </div>

                {/* Slack Integration */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Slack</h2>
                    <p className="text-sm text-zinc-500">
                      Send task and sprint events to a Slack channel via an incoming webhook URL.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Project</label>
                    <Select
                      value={slackProjectId}
                      onChange={(e) => setSlackProjectId(e.target.value)}
                    >
                      <option value="">Select a project…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>

                  {slackProjectId && (
                    <>
                      <Input
                        id="slack-webhook-url"
                        label="Incoming webhook URL"
                        type="password"
                        placeholder="https://hooks.slack.com/services/T00/B00/XXX"
                        value={slackWebhookUrl}
                        onChange={(e) => setSlackWebhookUrl(e.target.value)}
                      />
                      <Input
                        id="slack-token"
                        label="Slash command verification token (optional)"
                        type="password"
                        placeholder="Leave blank if not using /bbb"
                        value={slackToken}
                        onChange={(e) => setSlackToken(e.target.value)}
                      />

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notify on</label>
                        {[
                          ['task.created', slackNotifyTaskCreated, setSlackNotifyTaskCreated] as const,
                          ['task.completed', slackNotifyTaskCompleted, setSlackNotifyTaskCompleted] as const,
                          ['sprint.started', slackNotifySprintStarted, setSlackNotifySprintStarted] as const,
                          ['sprint.completed', slackNotifySprintCompleted, setSlackNotifySprintCompleted] as const,
                        ].map(([label, val, setter]) => (
                          <label key={label} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={val}
                              onChange={(e) => setter(e.target.checked)}
                              className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                            />
                            {label}
                          </label>
                        ))}
                        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <input
                            type="checkbox"
                            checked={slackEnabled}
                            onChange={(e) => setSlackEnabled(e.target.checked)}
                            className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                          />
                          Integration enabled
                        </label>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => saveSlack.mutate()}
                          loading={saveSlack.isPending}
                          disabled={!slackWebhookUrl.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => testSlack.mutate()}
                          loading={testSlack.isPending}
                          disabled={!slackIntegrationRes?.data}
                        >
                          Send test message
                        </Button>
                        {slackIntegrationRes?.data && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSlack.mutate()}
                            loading={deleteSlack.isPending}
                          >
                            Disconnect
                          </Button>
                        )}
                        {slackTestStatus && (
                          <span className="text-xs text-zinc-500">Test: {slackTestStatus}</span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="text-xs text-zinc-500 space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>Incoming webhook:</strong> In your Slack workspace → Apps → Incoming Webhooks →
                      Add to channel → copy URL here.
                    </p>
                    <p>
                      <strong>Slash command:</strong> Apps → Create App → Slash Commands → add <code className="font-mono">/bbb</code>
                      {' '}with request URL <code className="font-mono">/b3/api/webhooks/slack/command</code>.
                    </p>
                  </div>
                </div>

                {/* GitHub Integration */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GitHub</h2>
                    <p className="text-sm text-zinc-500">
                      Auto-link commits and pull requests that mention a task (e.g. <code className="font-mono text-xs">MAGE-38</code>), and optionally transition tasks when PRs open or merge.
                    </p>
                  </div>

                  <Select
                    label="Project"
                    options={[
                      { value: '', label: 'Select a project…' },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    value={ghProjectId}
                    onValueChange={setGhProjectId}
                  />

                  {ghProjectId && (
                    <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          id="gh-repo-owner"
                          label="Repo Owner"
                          placeholder="octocat"
                          value={ghRepoOwner}
                          onChange={(e) => setGhRepoOwner(e.target.value)}
                        />
                        <Input
                          id="gh-repo-name"
                          label="Repo Name"
                          placeholder="hello-world"
                          value={ghRepoName}
                          onChange={(e) => setGhRepoName(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                          label="Move to phase when PR opens"
                          options={[
                            { value: '', label: '— none —' },
                            ...ghPhases.map((p) => ({ value: p.id, label: p.name })),
                          ]}
                          value={ghOpenPhaseId}
                          onValueChange={setGhOpenPhaseId}
                        />
                        <Select
                          label="Move to phase when PR merges"
                          options={[
                            { value: '', label: '— none —' },
                            ...ghPhases.map((p) => ({ value: p.id, label: p.name })),
                          ]}
                          value={ghMergedPhaseId}
                          onValueChange={setGhMergedPhaseId}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={ghEnabled}
                          onChange={(e) => setGhEnabled(e.target.checked)}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                        Enabled
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveGithub.mutate({})}
                          loading={saveGithub.isPending}
                          disabled={!ghRepoOwner.trim() || !ghRepoName.trim()}
                        >
                          {ghIntegrationRes?.data ? 'Save Changes' : 'Connect GitHub'}
                        </Button>
                        {ghIntegrationRes?.data && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => saveGithub.mutate({ regenerate: true })}
                              loading={saveGithub.isPending}
                            >
                              Regenerate Secret
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => deleteGithub.mutate()}
                              loading={deleteGithub.isPending}
                            >
                              Disconnect
                            </Button>
                          </>
                        )}
                      </div>

                      {ghRevealedSecret && (
                        <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 space-y-3">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Webhook secret generated. Copy it now — it will not be shown again.
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white dark:bg-zinc-900 rounded px-3 py-2 font-mono border border-green-200 dark:border-green-800 break-all">
                              {ghRevealedSecret}
                            </code>
                            <button
                              onClick={() => handleCopyUrl(ghRevealedSecret)}
                              className="shrink-0 rounded-md p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              {copiedUrl === ghRevealedSecret ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs text-green-900 dark:text-green-100 space-y-1.5">
                            <p className="font-semibold">Setup instructions</p>
                            <p>In your GitHub repo → <strong>Settings</strong> → <strong>Webhooks</strong> → <strong>Add webhook</strong>:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-1">
                              <li>
                                <strong>Payload URL:</strong>{' '}
                                <code className="font-mono bg-white/60 dark:bg-zinc-900/60 px-1 rounded">
                                  {window.location.origin}/b3/api/webhooks/github
                                </code>
                              </li>
                              <li><strong>Content type:</strong> <code className="font-mono">application/json</code></li>
                              <li><strong>Secret:</strong> (the value above)</li>
                              <li><strong>Events:</strong> check "Pushes" and "Pull requests"</li>
                              <li><strong>Active:</strong> checked</li>
                            </ul>
                          </div>
                          <button
                            onClick={() => setGhRevealedSecret(null)}
                            className="text-xs text-green-700 dark:text-green-300 underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {ghIntegrationRes?.data && !ghRevealedSecret && (
                        <div className="text-xs text-zinc-500 space-y-1">
                          <p>
                            <strong>Payload URL:</strong>{' '}
                            <code className="font-mono">{window.location.origin}/b3/api/webhooks/github</code>
                          </p>
                          <p>Secret is set. Use "Regenerate Secret" if you need to rotate it.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Email Configuration */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Email Notifications</h2>
                    <p className="text-sm text-zinc-500">
                      Email notifications require SMTP configuration in the server's environment variables
                      (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
                    </p>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Contact your server administrator to configure email delivery.
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'permissions' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Organization Permissions</h2>
                  <p className="text-sm text-zinc-500">
                    Control what regular members can do within your organization. Admins and owners are not affected by these settings.
                  </p>
                  {!canEditPermissions && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      You need the admin or owner role to modify these settings.
                    </p>
                  )}
                </div>

                <fieldset disabled={!canEditPermissions} className="space-y-6 disabled:opacity-60">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Projects</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can create projects</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_create_projects}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_create_projects: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can delete projects they own</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_delete_own_projects}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_delete_own_projects: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Banter</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can create channels</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_create_channels}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_create_channels: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can create private channels</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_create_private_channels}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_create_private_channels: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can create group DMs</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_create_group_dms}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_create_group_dms: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Files</h3>
                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Max file upload size (MB)</span>
                      <Input
                        id="max-file-upload-mb"
                        type="number"
                        min={1}
                        max={1024}
                        value={permissions.max_file_upload_mb}
                        onChange={(e) => setPermissions((p) => ({ ...p, max_file_upload_mb: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                        className="w-24"
                      />
                    </label>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Invitations</h3>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can invite new members</span>
                      <input
                        type="checkbox"
                        checked={permissions.members_can_invite_members}
                        onChange={(e) => setPermissions((p) => ({ ...p, members_can_invite_members: e.target.checked }))}
                        className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                      />
                    </label>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">API Keys</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Members can create API keys</span>
                        <input
                          type="checkbox"
                          checked={permissions.members_can_create_api_keys}
                          onChange={(e) => setPermissions((p) => ({ ...p, members_can_create_api_keys: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                      <div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">Allowed API key scopes for members</p>
                        <div className="flex flex-wrap gap-3">
                          {['read', 'read_write', 'admin'].map((scope) => (
                            <label key={scope} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={permissions.allowed_api_key_scopes.includes(scope)}
                                onChange={() => toggleApiKeyScope(scope)}
                                className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span>{scope}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {canEditPermissions && (
                  <div className="flex items-center gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <Button onClick={handleSavePermissions} loading={permissionsSaving}>Save Permissions</Button>
                    {permissionsSaved && <span className="text-sm text-green-600">Saved!</span>}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'helpdesk' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Helpdesk Settings</h2>
                  <p className="text-sm text-zinc-500">Configure the client-facing helpdesk portal.</p>
                </div>

                {/* Require email verification */}
                <label className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Require email verification for helpdesk signups</span>
                  <input
                    type="checkbox"
                    checked={helpdeskRequireVerification}
                    onChange={(e) => setHelpdeskRequireVerification(e.target.checked)}
                    className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  />
                </label>

                {/* Allowed email domains */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Allowed email domains</label>
                  <input
                    type="text"
                    placeholder="example.com, acme.org"
                    value={helpdeskAllowedDomains}
                    onChange={(e) => setHelpdeskAllowedDomains(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                  />
                  <p className="text-xs text-zinc-400">Comma-separated. Leave blank to allow all domains.</p>
                </div>

                {/* Default project */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Default project for new tickets</label>
                  <select
                    value={helpdeskDefaultProject}
                    onChange={(e) => {
                      setHelpdeskDefaultProject(e.target.value);
                      setHelpdeskDefaultPhase('');
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                  >
                    <option value="">-- Select Project --</option>
                    {helpdeskProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Default phase */}
                {helpdeskDefaultProject && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Default phase for new tickets</label>
                    <select
                      value={helpdeskDefaultPhase}
                      onChange={(e) => setHelpdeskDefaultPhase(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                    >
                      <option value="">-- Select Phase --</option>
                      {helpdeskPhases.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Welcome message */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Welcome message</label>
                  <textarea
                    placeholder="Welcome to our helpdesk! How can we help you today?"
                    value={helpdeskWelcomeMessage}
                    onChange={(e) => setHelpdeskWelcomeMessage(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 resize-y"
                  />
                  <p className="text-xs text-zinc-400">Shown on the helpdesk portal landing page.</p>
                </div>

                {/* Ticket categories */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ticket categories</label>
                  <textarea
                    placeholder={"Bug Report\nFeature Request\nBilling\nGeneral Inquiry"}
                    value={helpdeskCategories}
                    onChange={(e) => setHelpdeskCategories(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 resize-y"
                  />
                  <p className="text-xs text-zinc-400">One category per line.</p>
                </div>

                {/* Notification toggles */}
                <label className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Notify client on status change</span>
                  <input
                    type="checkbox"
                    checked={helpdeskNotifyOnStatus}
                    onChange={(e) => setHelpdeskNotifyOnStatus(e.target.checked)}
                    className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Notify client on agent reply</span>
                  <input
                    type="checkbox"
                    checked={helpdeskNotifyOnReply}
                    onChange={(e) => setHelpdeskNotifyOnReply(e.target.checked)}
                    className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  />
                </label>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveHelpdeskSettings} loading={helpdeskSaving}>Save Settings</Button>
                  {helpdeskSaved && <span className="text-sm text-green-600">Saved!</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
