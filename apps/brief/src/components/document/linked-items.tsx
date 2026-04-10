import { ExternalLink, FileText, BookOpen } from 'lucide-react';
import { useLinks } from '@/hooks/use-links';

interface LinkedItemsProps {
  documentId: string;
}

function linkTypeLabel(linkType: string): string {
  const labels: Record<string, string> = {
    reference: 'Reference',
    spec: 'Specification',
    notes: 'Notes',
    postmortem: 'Post-mortem',
    source: 'Source',
    related: 'Related',
  };
  return labels[linkType] ?? linkType;
}

export function LinkedItems({ documentId }: LinkedItemsProps) {
  const { data: links, isLoading } = useLinks(documentId);

  if (isLoading) {
    return (
      <div className="text-xs text-zinc-400 dark:text-zinc-500">Loading links...</div>
    );
  }

  const taskLinks = links?.task_links ?? [];
  const beaconLinks = links?.beacon_links ?? [];

  if (taskLinks.length === 0 && beaconLinks.length === 0) {
    return (
      <div className="text-xs text-zinc-400 dark:text-zinc-500 italic">
        No linked items yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {taskLinks.map((link) => (
        <a
          key={link.id}
          href={`/b3/tasks/${link.task_id}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors group"
        >
          <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="truncate flex-1">Task</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {linkTypeLabel(link.link_type)}
          </span>
          <ExternalLink className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      ))}

      {beaconLinks.map((link) => (
        <a
          key={link.id}
          href={`/beacon/${link.beacon_id}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors group"
        >
          <BookOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="truncate flex-1">Beacon Article</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {linkTypeLabel(link.link_type)}
          </span>
          <ExternalLink className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      ))}
    </div>
  );
}
