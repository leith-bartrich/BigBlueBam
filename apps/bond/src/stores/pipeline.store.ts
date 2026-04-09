import { create } from 'zustand';

interface PipelineState {
  /** Currently selected pipeline ID. Null = use the default pipeline. */
  activePipelineId: string | null;
  setActivePipeline: (id: string | null) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  activePipelineId: null,
  setActivePipeline: (id) => set({ activePipelineId: id }),
}));
