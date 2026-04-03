import { useState, useEffect } from 'react';
import {
  X,
  Settings,
  UserPlus,
  UserMinus,
  Bot,
  Headphones,
  Loader2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChannelMembers, type Channel, type ChannelMember } from '@/hooks/use-channels';
import { cn, generateAvatarInitials, presenceColor } from '@/lib/utils';

interface ChannelSettingsProps {
  channel: Channel;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export function ChannelSettings({ channel, onClose, onNavigate }: ChannelSettingsProps) {
  const queryClient = useQueryClient();
  const { data: members, isLoading: membersLoading } = useChannelMembers(channel.id);

  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [description, setDescription] = useState(channel.description ?? '');
  const [allowBots, setAllowBots] = useState(true);
  const [allowHuddles, setAllowHuddles] = useState(true);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset form when channel changes
  useEffect(() => {
    setName(channel.name);
    setTopic(channel.topic ?? '');
    setDescription(channel.description ?? '');
  }, [channel]);

  const updateChannel = useMutation({
    mutationFn: (data: {
      name?: string;
      topic?: string;
      description?: string;
      allow_bots?: boolean;
      allow_huddles?: boolean;
    }) => api.patch<{ data: Channel }>(`/channels/${channel.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels', channel.slug] });
      queryClient.invalidateQueries({ queryKey: ['channels', channel.id] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/channels/${channel.id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', channel.id, 'members'] });
    },
  });

  const addMember = useMutation({
    mutationFn: (identifier: string) =>
      api.post(`/channels/${channel.id}/members`, { identifier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', channel.id, 'members'] });
      setAddMemberEmail('');
    },
  });

  const deleteChannel = useMutation({
    mutationFn: () => api.delete(`/channels/${channel.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      onClose();
      onNavigate?.('/channels/general');
    },
    onError: (err: any) => {
      setDeleteError(err?.message ?? 'Failed to delete channel');
    },
  });

  const handleSave = () => {
    updateChannel.mutate({
      name: name.trim(),
      topic: topic.trim() || undefined,
      description: description.trim() || undefined,
      allow_bots: allowBots,
      allow_huddles: allowHuddles,
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addMemberEmail.trim();
    if (trimmed) {
      addMember.mutate(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Channel Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Channel name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Channel name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
              placeholder="e.g. general"
            />
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
              placeholder="What is this channel about?"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors resize-none"
              placeholder="Describe the purpose of this channel"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <ToggleRow
              icon={<Bot className="h-4 w-4" />}
              label="Allow bots"
              description="Allow bot integrations to post in this channel"
              checked={allowBots}
              onChange={setAllowBots}
            />
            <ToggleRow
              icon={<Headphones className="h-4 w-4" />}
              label="Allow huddles"
              description="Allow members to start huddles in this channel"
              checked={allowHuddles}
              onChange={setAllowHuddles}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={updateChannel.isPending || !name.trim()}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
              'bg-primary-600 text-white hover:bg-primary-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {updateChannel.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : updateChannel.isSuccess ? (
              'Saved!'
            ) : (
              'Save Changes'
            )}
          </button>

          {/* Members section */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Members ({members?.length ?? 0})
            </h3>

            {/* Add member */}
            <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
              <input
                type="text"
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                placeholder="Email or username"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
              />
              <button
                type="submit"
                disabled={addMember.isPending || !addMemberEmail.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Add
              </button>
            </form>

            {/* Member list */}
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                {members?.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onRemove={() => removeMember.mutate(member.user_id)}
                    isRemoving={removeMember.isPending}
                  />
                ))}
                {members?.length === 0 && (
                  <p className="text-sm text-zinc-500 py-2">No members</p>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          {!channel.is_default && (
            <div className="border-t border-red-200 dark:border-red-900/50 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </h3>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Channel
                </button>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Are you sure you want to delete <strong>#{channel.name}</strong>? This will archive the channel and all its messages. This action cannot be undone.
                  </p>
                  {deleteError && (
                    <p className="text-sm text-red-600 font-medium">{deleteError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setDeleteError(null); deleteChannel.mutate(); }}
                      disabled={deleteChannel.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleteChannel.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Yes, delete channel
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">{icon}</span>
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 items-center rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

function MemberRow({
  member,
  onRemove,
  isRemoving,
}: {
  member: ChannelMember;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group">
      <div className="relative flex-shrink-0">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.display_name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-primary-300">
            {generateAvatarInitials(member.display_name)}
          </div>
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900',
            presenceColor(member.presence),
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {member.display_name}
        </p>
        <p className="text-xs text-zinc-500 capitalize">{member.role}</p>
      </div>

      {member.role !== 'owner' && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Remove member"
        >
          <UserMinus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
