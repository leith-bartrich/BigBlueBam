import type { DocumentStatus } from '@/hooks/use-documents';
import { Badge } from '@/components/common/badge';

interface StatusBadgeProps {
  status: DocumentStatus;
}

const statusConfig: Record<DocumentStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  in_review: { label: 'In Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  archived: { label: 'Archived', variant: 'danger' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
