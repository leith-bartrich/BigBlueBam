import { useState } from 'react';
import { Link2, Plus, X, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Dialog } from '@/components/common/dialog';
import { ProjectPicker } from '@/components/links/ProjectPicker';
import { useKrLinks, useAddKrLink, useRemoveKrLink, type KrLink } from '@/hooks/useKeyResults';
import { cn } from '@/lib/utils';

interface LinkEditorProps {
  keyResultId: string;
}

type LinkType = KrLink['link_type'];

const linkTypeLabels: Record<LinkType, string> = {
  project: 'Project',
  epic: 'Epic',
  task_query: 'Task Query',
};

const linkTypeColors: Record<LinkType, string> = {
  project: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  task_query: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function LinkEditor({ keyResultId }: LinkEditorProps) {
  const { data, isLoading } = useKrLinks(keyResultId);
  const links = data?.data ?? [];
  const addMutation = useAddKrLink();
  const removeMutation = useRemoveKrLink();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkType, setLinkType] = useState<LinkType>('project');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkId, setLinkId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const resetForm = () => {
    setLinkType('project');
    setLinkTitle('');
    setLinkId('');
    setLinkUrl('');
  };

  const handleAdd = () => {
    if (!linkTitle.trim() || !linkId.trim()) return;
    addMutation.mutate(
      {
        keyResultId,
        link_type: linkType,
        link_id: linkId.trim(),
        link_title: linkTitle.trim(),
        link_url: linkUrl.trim() || undefined,
      },
      { onSuccess: () => { setDialogOpen(false); resetForm(); } },
    );
  };

  const handleRemove = (linkIdToRemove: string) => {
    removeMutation.mutate({ keyResultId, linkId: linkIdToRemove });
  };

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setLinkId(projectId);
    setLinkTitle(projectName);
    setLinkUrl(`/b3/projects/${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Link2 className="h-4 w-4" />
          Links ({links.length})
        </h4>
        <Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-zinc-400">No linked items</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 px-3 py-2 group"
            >
              <span className={cn('text-[10px] font-medium rounded px-1.5 py-0.5', linkTypeColors[link.link_type])}>
                {linkTypeLabels[link.link_type]}
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">{link.link_title}</span>
              {link.link_url && (
                <a
                  href={link.link_url}
                  className="text-zinc-400 hover:text-primary-500 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => handleRemove(link.id)}
                className="hidden group-hover:flex items-center justify-center h-5 w-5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title="Link to Item"
        description="Connect this key result to a project, epic, or task query."
      >
        <div className="space-y-4">
          {/* Link type selector */}
          <div className="flex gap-2">
            {(Object.keys(linkTypeLabels) as LinkType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setLinkType(type); setLinkId(''); setLinkTitle(''); setLinkUrl(''); }}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  linkType === type
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300',
                )}
              >
                {linkTypeLabels[type]}
              </button>
            ))}
          </div>

          {/* Project picker or manual input */}
          {linkType === 'project' ? (
            <ProjectPicker onSelect={handleProjectSelect} selectedId={linkId} />
          ) : (
            <>
              <Input
                label="Title"
                placeholder="Link name"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
              <Input
                label="ID"
                placeholder="Item ID"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
              />
              <Input
                label="URL (optional)"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleAdd} loading={addMutation.isPending} disabled={!linkTitle.trim() || !linkId.trim()}>
              Add Link
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
