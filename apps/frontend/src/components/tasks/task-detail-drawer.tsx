import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Calendar,
  User,
  Tag,
  Hash,
  MessageSquare,
  CheckSquare,
  Square,
  Plus,
  Send,
  Copy,
  Check,
  Clock,
  Activity,
  Target,
  Flag,
  Layers,
  CopyPlus,
  Trash2,
  Zap,
} from 'lucide-react';
import type { Task, Priority, ApiResponse, PaginatedResponse } from '@bigbluebam/shared';
import { PRIORITIES } from '@bigbluebam/shared';
import { cn, formatDate, formatRelativeTime, isOverdue, priorityColor } from '@/lib/utils';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Avatar } from '@/components/common/avatar';
import { Select } from '@/components/common/select';
import { api } from '@/lib/api';
import { DatePicker } from '@/components/common/date-picker';

interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

interface CommentReaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface CommentData {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: { display_name: string; avatar_url: string | null };
  reactions?: CommentReaction[];
}

const REACTION_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE80', '\uD83D\uDC40', '\uD83C\uDF89'];

interface ActivityEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: { display_name: string };
}

interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: (Task & {
    human_id?: string;
    labels?: { id: string; name: string; color: string }[];
    assignee?: { display_name: string; avatar_url: string | null } | null;
    reporter?: { display_name: string; avatar_url: string | null } | null;
    subtasks?: { id: string; title: string; human_id?: string; state_id: string | null; completed_at: string | null }[];
    state_name?: string;
    phase_name?: string;
  }) | null;
  onUpdate?: (taskId: string, data: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  phases?: { id: string; name: string }[];
  projectId?: string;
  states?: { id: string; name: string; category: string }[];
  sprints?: { id: string; name: string }[];
}

export function TaskDetailDrawer({
  open,
  onOpenChange,
  task,
  onUpdate,
  onDelete,
  phases = [],
  projectId,
  states = [],
  sprints = [],
}: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [description, setDescription] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [copiedId, setCopiedId] = useState(false);

  const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch members for assignee picker
  const { data: membersRes } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get<PaginatedResponse<Member>>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
  const members = membersRes?.data ?? [];

  // Fetch epics for epic picker
  const { data: epicsRes } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => api.get<PaginatedResponse<{ id: string; name: string; color: string | null }>>(`/projects/${projectId}/epics`),
    enabled: !!projectId && open,
  });
  const epics = epicsRes?.data ?? [];

  const epicOptions = [
    { value: '__none__', label: 'No Epic' },
    ...epics.map((e) => ({ value: e.id, label: e.name })),
  ];

  // Fetch comments
  const { data: commentsRes } = useQuery({
    queryKey: ['task-comments', task?.id],
    queryFn: () => api.get<PaginatedResponse<CommentData>>(`/tasks/${task!.id}/comments`),
    enabled: !!task?.id && open,
  });
  const comments = commentsRes?.data ?? [];

  // Fetch activity
  const { data: activityRes } = useQuery({
    queryKey: ['task-activity', task?.id],
    queryFn: () => api.get<PaginatedResponse<ActivityEntry>>(`/tasks/${task!.id}/activity`),
    enabled: !!task?.id && open && activeTab === 'activity',
  });
  const activities = activityRes?.data ?? [];

  // Post comment mutation
  const postComment = useMutation({
    mutationFn: (body: string) =>
      api.post<ApiResponse<CommentData>>(`/tasks/${task!.id}/comments`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task?.id] });
      setNewComment('');
    },
  });

  // Create subtask mutation
  const createSubtask = useMutation({
    mutationFn: (title: string) =>
      api.post<ApiResponse<Task>>(`/projects/${projectId}/tasks`, {
        title,
        parent_task_id: task!.id,
        phase_id: task!.phase_id,
        priority: 'medium' as Priority,
        sprint_id: task!.sprint_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
      setNewSubtaskTitle('');
    },
  });

  // Duplicate task mutation
  const duplicateTask = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Task>>(`/tasks/${task!.id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Toggle reaction mutation
  const toggleReaction = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      api.post(`/comments/${commentId}/reactions`, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task?.id] });
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && task) {
      setTitleValue(task.title);
      setDescription(task.description ?? '');
      setActiveTab('details');
    }
    onOpenChange(isOpen);
  };

  useEffect(() => {
    if (task && open) {
      setTitleValue(task.title);
      setDescription(task.description ?? '');
    }
  }, [task?.id, open]);

  const handleTitleSave = () => {
    if (task && titleValue.trim() && titleValue !== task.title) {
      onUpdate?.(task.id, { title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleValue(task?.title ?? '');
      setEditingTitle(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (descriptionTimerRef.current) {
      clearTimeout(descriptionTimerRef.current);
    }
    descriptionTimerRef.current = setTimeout(() => {
      if (task && value !== (task.description ?? '')) {
        onUpdate?.(task.id, { description: value });
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (descriptionTimerRef.current) {
        clearTimeout(descriptionTimerRef.current);
      }
    };
  }, []);

  const handleCopyHumanId = useCallback(() => {
    if (!task) return;
    const humanId = task.human_id ?? `#${(task as Task & { task_number?: number }).task_number ?? ''}`;
    navigator.clipboard.writeText(humanId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    });
  }, [task]);

  const handlePostComment = () => {
    if (!newComment.trim() || !task) return;
    postComment.mutate(newComment.trim());
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim() || !task || !projectId) return;
    createSubtask.mutate(newSubtaskTitle.trim());
  };

  const handleToggleSubtask = (subtask: { id: string; completed_at: string | null }) => {
    // Toggle between done state and re-opening
    const doneState = states.find((s) => s.category === 'done');
    const todoState = states.find((s) => s.category === 'todo');
    if (subtask.completed_at) {
      // Re-open: set to todo state
      if (todoState) {
        onUpdate?.(subtask.id, { state_id: todoState.id } as Partial<Task>);
      }
    } else {
      // Mark done
      if (doneState) {
        onUpdate?.(subtask.id, { state_id: doneState.id } as Partial<Task>);
      }
    }
  };

  const priorityOptions = PRIORITIES.map((p) => ({
    value: p,
    label: p.charAt(0).toUpperCase() + p.slice(1),
  }));

  const phaseOptions = phases.map((p) => ({ value: p.id, label: p.name }));

  const stateOptions = states.map((s) => ({ value: s.id, label: s.name }));

  const sprintOptions = [
    { value: '__none__', label: 'No Sprint' },
    ...sprints.map((s) => ({ value: s.id, label: s.name })),
  ];

  const memberOptions = [
    { value: '__none__', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.id, label: m.display_name })),
  ];

  if (!task) return null;

  const humanId = task.human_id ?? `#${(task as Task & { task_number?: number }).task_number ?? ''}`;
  const overdue = isOverdue(task.due_date);

  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.completed_at != null);
  const subtaskProgress = subtasks.length > 0 ? Math.round((doneSubtasks.length / subtasks.length) * 100) : 0;

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/30 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                className="fixed top-0 right-0 h-full w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCopyHumanId}
                      className="flex items-center gap-1.5 text-sm font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      title="Copy task ID"
                    >
                      {humanId}
                      {copiedId ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {stateOptions.length > 0 ? (
                      <Select
                        options={stateOptions}
                        value={task.state_id ?? undefined}
                        onValueChange={(val) => onUpdate?.(task.id, { state_id: val })}
                        placeholder="State"
                        className="w-36"
                      />
                    ) : (
                      <Badge variant="default">{task.state_name ?? 'Unknown'}</Badge>
                    )}
                    <Select
                      options={priorityOptions}
                      value={task.priority}
                      onValueChange={(val) => onUpdate?.(task.id, { priority: val as Priority })}
                      placeholder="Priority"
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => duplicateTask.mutate()}
                      disabled={duplicateTask.isPending}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Duplicate task"
                    >
                      <CopyPlus className="h-4.5 w-4.5" />
                    </button>
                    <RadixDialog.Close className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <X className="h-5 w-5" />
                    </RadixDialog.Close>
                  </div>
                </div>

                <RadixDialog.Title className="sr-only">{task.title}</RadixDialog.Title>
                <RadixDialog.Description className="sr-only">Task detail view for {humanId}</RadixDialog.Description>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex gap-6 p-6">
                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-6">
                      {/* Inline editable title */}
                      {editingTitle ? (
                        <input
                          className="w-full text-xl font-semibold bg-transparent border-b-2 border-primary-500 outline-none text-zinc-900 dark:text-zinc-100"
                          value={titleValue}
                          onChange={(e) => setTitleValue(e.target.value)}
                          onBlur={handleTitleSave}
                          onKeyDown={handleTitleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <h2
                          className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer hover:text-primary-600 transition-colors"
                          onClick={() => {
                            setTitleValue(task.title);
                            setEditingTitle(true);
                          }}
                        >
                          {task.title}
                        </h2>
                      )}

                      {/* Tabs */}
                      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
                        {(['details', 'comments', 'activity'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                              'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
                              activeTab === tab
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700',
                            )}
                          >
                            {tab === 'details' && <Layers className="h-3.5 w-3.5" />}
                            {tab === 'comments' && <MessageSquare className="h-3.5 w-3.5" />}
                            {tab === 'activity' && <Activity className="h-3.5 w-3.5" />}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab === 'comments' && comments.length > 0 && (
                              <span className="text-xs bg-zinc-200 dark:bg-zinc-700 rounded-full px-1.5">
                                {comments.length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Details Tab */}
                      {activeTab === 'details' && (
                        <div className="space-y-5">
                          {/* Description */}
                          <div>
                            <label className="text-sm font-medium text-zinc-500 mb-1.5 block">Description</label>
                            <textarea
                              className="w-full min-h-[120px] rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 resize-y"
                              placeholder="Add a description..."
                              value={description}
                              onChange={(e) => handleDescriptionChange(e.target.value)}
                            />
                          </div>

                          {/* Subtasks */}
                          <div>
                            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                              <CheckSquare className="h-4 w-4" />
                              Subtasks
                              {subtasks.length > 0 && (
                                <span className="text-zinc-400">
                                  ({doneSubtasks.length}/{subtasks.length})
                                </span>
                              )}
                            </h3>

                            {subtasks.length > 0 && (
                              <>
                                <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mb-3">
                                  <div
                                    className="h-full rounded-full bg-primary-500 transition-all duration-300"
                                    style={{ width: `${subtaskProgress}%` }}
                                  />
                                </div>
                                <div className="space-y-1 mb-3">
                                  {subtasks.map((sub) => {
                                    const isDone = sub.completed_at != null;
                                    return (
                                      <div
                                        key={sub.id}
                                        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                                        onClick={() => handleToggleSubtask(sub)}
                                      >
                                        {isDone ? (
                                          <CheckSquare className="h-4 w-4 text-primary-600 shrink-0" />
                                        ) : (
                                          <Square className="h-4 w-4 text-zinc-400 shrink-0" />
                                        )}
                                        <span className={cn('text-sm flex-1', isDone && 'line-through text-zinc-400')}>
                                          {sub.human_id && (
                                            <span className="font-mono text-xs text-zinc-400 mr-1.5">{sub.human_id}</span>
                                          )}
                                          {sub.title}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}

                            {/* Add subtask input */}
                            {projectId && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Add a subtask..."
                                  value={newSubtaskTitle}
                                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddSubtask();
                                  }}
                                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!newSubtaskTitle.trim()}
                                  loading={createSubtask.isPending}
                                  onClick={handleAddSubtask}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Labels */}
                          {task.labels && (task.labels as unknown as { id: string; name: string; color: string }[]).length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-zinc-500 mb-1.5">Labels</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {(task.labels as unknown as { id: string; name: string; color: string }[]).map((label) => (
                                  <Badge key={label.id} variant="custom" color={label.color}>
                                    {label.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Comments Tab */}
                      {activeTab === 'comments' && (
                        <div className="space-y-4">
                          {comments.length > 0 ? (
                            comments.map((comment) => (
                              <div key={comment.id} className="group flex gap-3">
                                <Avatar
                                  src={comment.author?.avatar_url}
                                  name={comment.author?.display_name}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                      {comment.author?.display_name ?? 'Unknown'}
                                    </span>
                                    <span className="text-xs text-zinc-400">
                                      {formatRelativeTime(comment.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    {comment.body}
                                  </p>
                                  {/* Reactions */}
                                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    {(comment.reactions ?? []).map((r) => (
                                      <button
                                        key={r.emoji}
                                        onClick={() =>
                                          toggleReaction.mutate({ commentId: comment.id, emoji: r.emoji })
                                        }
                                        className={cn(
                                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors',
                                          r.reacted
                                            ? 'bg-primary-50 border-primary-200 dark:bg-primary-950 dark:border-primary-800'
                                            : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700',
                                        )}
                                      >
                                        <span>{r.emoji}</span>
                                        <span className="text-zinc-600 dark:text-zinc-400">{r.count}</span>
                                      </button>
                                    ))}
                                    {/* Add reaction buttons */}
                                    <div className="flex items-center gap-0.5 ml-1">
                                      {REACTION_EMOJIS.filter(
                                        (e) => !(comment.reactions ?? []).some((r) => r.emoji === e),
                                      ).map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() =>
                                            toggleReaction.mutate({ commentId: comment.id, emoji })
                                          }
                                          className="opacity-40 hover:opacity-100 rounded p-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                                          title={`React with ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-zinc-400 py-4">No comments yet. Start a conversation.</p>
                          )}

                          <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                            <textarea
                              placeholder="Write a comment..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  handlePostComment();
                                }
                              }}
                              rows={3}
                              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 resize-y"
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              disabled={!newComment.trim()}
                              loading={postComment.isPending}
                              onClick={handlePostComment}
                            >
                              <Send className="h-4 w-4" />
                              Comment
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Activity Tab */}
                      {activeTab === 'activity' && (
                        <div className="space-y-3">
                          {activities.length > 0 ? (
                            activities.map((entry) => (
                              <div key={entry.id} className="flex items-start gap-3 py-2">
                                <div className="mt-0.5 h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                  <Activity className="h-3 w-3 text-zinc-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                    <span className="font-medium">
                                      {entry.actor?.display_name ?? 'Someone'}
                                    </span>{' '}
                                    {entry.action}
                                  </p>
                                  <span className="text-xs text-zinc-400">
                                    {formatRelativeTime(entry.created_at)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-zinc-400 py-4">No activity recorded yet.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata sidebar */}
                    <div className="w-56 shrink-0 space-y-4">
                      {/* Assignee */}
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <User className="h-3 w-3" /> Assignee
                        </label>
                        {memberOptions.length > 1 ? (
                          <Select
                            options={memberOptions}
                            value={task.assignee_id ?? '__none__'}
                            onValueChange={(val) =>
                              onUpdate?.(task.id, { assignee_id: val === '__none__' ? null : val } as Partial<Task>)
                            }
                            className="w-full"
                          />
                        ) : task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar src={task.assignee.avatar_url} name={task.assignee.display_name} size="sm" />
                            <span className="text-sm">{task.assignee.display_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">Unassigned</span>
                        )}
                      </div>

                      {/* Reporter */}
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <Flag className="h-3 w-3" /> Reporter
                        </label>
                        {task.reporter ? (
                          <div className="flex items-center gap-2">
                            <Avatar src={task.reporter.avatar_url} name={task.reporter.display_name} size="sm" />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{task.reporter.display_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">Unknown</span>
                        )}
                      </div>

                      {/* Sprint */}
                      {sprintOptions.length > 1 && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                            <Target className="h-3 w-3" /> Sprint
                          </label>
                          <Select
                            options={sprintOptions}
                            value={task.sprint_id ?? '__none__'}
                            onValueChange={(val) =>
                              onUpdate?.(task.id, { sprint_id: val === '__none__' ? null : val } as Partial<Task>)
                            }
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Phase */}
                      {phaseOptions.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                            <Layers className="h-3 w-3" /> Phase
                          </label>
                          <Select
                            options={phaseOptions}
                            value={task.phase_id}
                            onValueChange={(val) => onUpdate?.(task.id, { phase_id: val })}
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Epic */}
                      {epicOptions.length > 1 && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Epic
                          </label>
                          <Select
                            options={epicOptions}
                            value={(task as Task & { epic_id?: string | null }).epic_id ?? '__none__'}
                            onValueChange={(val) =>
                              onUpdate?.(task.id, { epic_id: val === '__none__' ? null : val } as Partial<Task>)
                            }
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Story Points */}
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <Hash className="h-3 w-3" /> Story Points
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={task.story_points ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            onUpdate?.(task.id, { story_points: val } as Partial<Task>);
                          }}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                          placeholder="0"
                        />
                      </div>

                      {/* Start Date */}
                      <div>
                        <DatePicker
                          label="Start Date"
                          value={task.start_date?.split('T')[0] ?? ''}
                          onChange={(val) =>
                            onUpdate?.(task.id, {
                              start_date: val || null,
                            } as Partial<Task>)
                          }
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <DatePicker
                          label="Due Date"
                          value={task.due_date?.split('T')[0] ?? ''}
                          onChange={(val) =>
                            onUpdate?.(task.id, {
                              due_date: val || null,
                            } as Partial<Task>)
                          }
                          className={cn(
                            overdue && 'border-red-300 text-red-600',
                          )}
                        />
                      </div>

                      {/* Labels */}
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <Tag className="h-3 w-3" /> Labels
                        </label>
                        {task.labels && (task.labels as unknown as { id: string; name: string; color: string }[]).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(task.labels as unknown as { id: string; name: string; color: string }[]).map((l) => (
                              <Badge key={l.id} variant="custom" color={l.color}>
                                {l.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">None</span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 space-y-1">
                        <p>Created {formatDate(task.created_at)}</p>
                        <p>Updated {formatDate(task.updated_at)}</p>
                      </div>

                      {/* Delete task */}
                      {onDelete && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
                                onDelete(task.id);
                              }
                            }}
                            className="flex items-center gap-1.5 w-full rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Task
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
