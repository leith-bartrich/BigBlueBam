import { PipelineBoard } from '@/components/pipeline/pipeline-board';

interface PipelineBoardPageProps {
  onNavigate: (path: string) => void;
  pipelineId?: string;
}

export function PipelineBoardPage({ onNavigate, pipelineId }: PipelineBoardPageProps) {
  return <PipelineBoard onNavigate={onNavigate} pipelineId={pipelineId} />;
}
