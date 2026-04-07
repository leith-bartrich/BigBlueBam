import { useState } from 'react';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import type { BeaconStatus } from '@/hooks/use-beacons';
import {
  usePublishBeacon,
  useVerifyBeacon,
  useChallengeBeacon,
  useRetireBeacon,
  useRestoreBeacon,
} from '@/hooks/use-beacons';

interface LifecycleActionsProps {
  beaconId: string;
  status: BeaconStatus;
  onSuccess?: () => void;
}

type ActionKind = 'publish' | 'verify' | 'challenge' | 'retire' | 'restore';

const actionMeta: Record<ActionKind, { label: string; description: string; variant: 'primary' | 'secondary' | 'danger' }> = {
  publish: { label: 'Publish', description: 'This will make the beacon visible to others based on its visibility setting.', variant: 'primary' },
  verify: { label: 'Verify', description: 'Confirm this beacon is still accurate and up to date.', variant: 'primary' },
  challenge: { label: 'Challenge', description: 'Flag this beacon for review. It will move to Pending Review status.', variant: 'secondary' },
  retire: { label: 'Retire', description: 'Retire this beacon. It will no longer appear in active listings.', variant: 'danger' },
  restore: { label: 'Restore', description: 'Restore this beacon to Active status.', variant: 'primary' },
};

function actionsForStatus(status: BeaconStatus): ActionKind[] {
  switch (status) {
    case 'Draft':
      return ['publish'];
    case 'Active':
      return ['verify', 'challenge', 'retire'];
    case 'PendingReview':
      return ['publish', 'retire'];
    case 'Archived':
      return ['restore', 'retire'];
    case 'Retired':
      return ['restore'];
    default:
      return [];
  }
}

export function LifecycleActions({ beaconId, status, onSuccess }: LifecycleActionsProps) {
  const [confirmAction, setConfirmAction] = useState<ActionKind | null>(null);

  const publish = usePublishBeacon();
  const verify = useVerifyBeacon();
  const challenge = useChallengeBeacon();
  const retire = useRetireBeacon();
  const restore = useRestoreBeacon();

  const actions = actionsForStatus(status);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction) {
        case 'publish':
          await publish.mutateAsync(beaconId);
          break;
        case 'verify':
          await verify.mutateAsync(beaconId);
          break;
        case 'challenge':
          await challenge.mutateAsync(beaconId);
          break;
        case 'retire':
          await retire.mutateAsync(beaconId);
          break;
        case 'restore':
          await restore.mutateAsync(beaconId);
          break;
      }
      onSuccess?.();
    } finally {
      setConfirmAction(null);
    }
  };

  const isPending = publish.isPending || verify.isPending || challenge.isPending || retire.isPending || restore.isPending;

  if (actions.length === 0) return null;

  const meta = confirmAction ? actionMeta[confirmAction] : null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => {
          const m = actionMeta[action];
          return (
            <Button
              key={action}
              variant={m.variant}
              size="sm"
              onClick={() => setConfirmAction(action)}
              disabled={isPending}
            >
              {m.label}
            </Button>
          );
        })}
      </div>

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={meta ? `${meta.label} Beacon` : ''}
        description={meta?.description}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
            Cancel
          </Button>
          <Button
            variant={meta?.variant ?? 'primary'}
            size="sm"
            onClick={handleConfirm}
            loading={isPending}
          >
            {meta?.label}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
