import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { useBoardIntegrity, useRemediateBoard } from '@/hooks/use-boards';
import { useProjects } from '@/hooks/use-projects';

interface BoardIntegrityBannerProps {
  boardId: string;
}

/**
 * Amber bar that appears at the top of the canvas page when the board
 * has detected integrity issues (e.g. PROJECT_ORG_MISMATCH from the
 * pre-trigger era). Surfaces two remediation actions:
 *   - Detach: clears project_id. Always available, no extra inputs.
 *   - Reassign: opens a dialog with a Select populated from the user's
 *     current org's projects, then PATCHes via /boards/:id/remediate.
 *
 * The component is self-fetching so the canvas page can drop it in
 * without threading integrity data through props. When the board has no
 * issues the hook is `enabled: false` so this is a no-op render +
 * zero round-trips for healthy boards.
 */
export function BoardIntegrityBanner({ boardId }: BoardIntegrityBannerProps) {
  const { data, isLoading } = useBoardIntegrity(boardId);
  const remediate = useRemediateBoard();
  const { projects } = useProjects();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issues = data?.data?.issues ?? [];
  if (isLoading || issues.length === 0) return null;

  const primary = issues[0]!;

  const handleDetach = () => {
    setError(null);
    remediate.mutate(
      { id: boardId, action: { action: 'detach' } },
      {
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  const handleReassign = () => {
    if (!selectedProjectId) {
      setError('Pick a project first.');
      return;
    }
    setError(null);
    remediate.mutate(
      { id: boardId, action: { action: 'reassign', project_id: selectedProjectId } },
      {
        onSuccess: () => {
          setReassignOpen(false);
          setSelectedProjectId(null);
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <>
      <div className="flex items-start gap-3 border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-amber-900 dark:text-amber-100">
            This board has {issues.length === 1 ? 'a configuration issue' : `${issues.length} configuration issues`} that need attention
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            {primary.message}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDetach}
            loading={remediate.isPending && remediate.variables?.action.action === 'detach'}
          >
            Detach from project
          </Button>
          <Button
            size="sm"
            onClick={() => setReassignOpen(true)}
            disabled={remediate.isPending}
          >
            Reassign to a project here
          </Button>
        </div>
      </div>

      <Dialog
        open={reassignOpen}
        onOpenChange={(open) => {
          setReassignOpen(open);
          if (!open) {
            setSelectedProjectId(null);
            setError(null);
          }
        }}
        title="Reassign to a project"
        description="Pick a project in your current organization. The list only shows projects you can currently access."
      >
        <div className="flex flex-col gap-3 mt-2">
          {projects.length === 0 ? (
            <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-3 text-sm text-zinc-600 dark:text-zinc-300">
              You don't have any projects in this organization. Detach the board instead, or create a project in Bam first.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
              {projects.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0"
                >
                  <input
                    type="radio"
                    name="project"
                    checked={selectedProjectId === p.id}
                    onChange={() => setSelectedProjectId(p.id)}
                    className="text-primary-600"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{p.name}</span>
                </label>
              ))}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReassignOpen(false)} disabled={remediate.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={!selectedProjectId || remediate.isPending}
              loading={remediate.isPending && remediate.variables?.action.action === 'reassign'}
            >
              {remediate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reassign
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
