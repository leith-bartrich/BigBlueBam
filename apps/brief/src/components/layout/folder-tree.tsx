import { useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project.store';
import {
  useFolders,
  useCreateFolder,
  buildFolderTree,
  type FolderTreeNode,
} from '@/hooks/use-folders';

interface FolderTreeProps {
  onNavigate: (path: string) => void;
  activeFolderId?: string | null;
}

/**
 * Minimal folder tree for the Brief sidebar. Reads the active project scope
 * from the project store so folders follow the same filter as documents.
 * Clicking a folder navigates to `/documents?folder=<id>` which the list
 * page can honor. Creation happens via a single inline prompt under the root
 * so admins can bootstrap a tree without leaving the sidebar. Rename and
 * delete are intentionally out of scope for this pass.
 */
export function FolderTree({ onNavigate, activeFolderId }: FolderTreeProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data: folders, isLoading, error } = useFolders(activeProjectId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const createMutation = useCreateFolder();
  const [creatingName, setCreatingName] = useState<string | null>(null);

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);

  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  const handleCreateRoot = () => {
    const name = (creatingName ?? '').trim();
    if (!name) {
      setCreatingName(null);
      return;
    }
    createMutation.mutate(
      { name, project_id: activeProjectId ?? null, parent_id: null },
      {
        onSuccess: () => setCreatingName(null),
        onError: () => setCreatingName(null),
      },
    );
  };

  return (
    <div className="px-2 mt-3">
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Folders
        </span>
        <button
          type="button"
          onClick={() => setCreatingName('')}
          className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-sidebar-hover"
          title="New folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </div>
      )}
      {error && (
        <p className="px-3 py-1.5 text-xs text-red-400">Failed to load folders.</p>
      )}

      {creatingName !== null && (
        <div className="px-3 py-1.5">
          <input
            autoFocus
            value={creatingName}
            onChange={(e) => setCreatingName(e.target.value)}
            onBlur={handleCreateRoot}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateRoot();
              if (e.key === 'Escape') setCreatingName(null);
            }}
            placeholder="Folder name"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}

      {tree.length === 0 && !isLoading && creatingName === null && (
        <p className="px-3 py-1.5 text-xs text-zinc-500 italic">No folders yet.</p>
      )}

      <ul className="space-y-0.5">
        {tree.map((node) => (
          <FolderNodeView
            key={node.id}
            node={node}
            depth={0}
            activeFolderId={activeFolderId}
            expanded={expanded}
            onToggle={toggle}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}

interface FolderNodeViewProps {
  node: FolderTreeNode;
  depth: number;
  activeFolderId?: string | null;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: (path: string) => void;
}

function FolderNodeView({
  node,
  depth,
  activeFolderId,
  expanded,
  onToggle,
  onNavigate,
}: FolderNodeViewProps) {
  const isActive = activeFolderId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.id] ?? depth === 0;

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors',
          isActive ? 'bg-sidebar-active text-white' : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'shrink-0 rounded hover:bg-zinc-700/50',
            hasChildren ? 'text-zinc-400' : 'text-transparent pointer-events-none',
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate(`/documents?folder=${node.id}`)}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        >
          <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {isExpanded && hasChildren && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
