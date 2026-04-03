import { create } from 'zustand';
import type { Phase, Task, Sprint, BoardResponse } from '@bigbluebam/shared';
import { api } from '@/lib/api';

interface BoardState {
  phases: (Phase & { tasks: Task[] })[];
  activeSprint: Sprint | null;
  isLoading: boolean;
  error: string | null;
  fetchBoard: (projectId: string, sprintId?: string) => Promise<void>;
  moveTask: (taskId: string, toPhaseId: string, position: number) => void;
  addTaskToPhase: (phaseId: string, task: Task) => void;
  updateTaskInBoard: (taskId: string, updates: Partial<Task>) => void;
  removeTaskFromBoard: (taskId: string) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  phases: [],
  activeSprint: null,
  isLoading: false,
  error: null,

  fetchBoard: async (projectId, sprintId) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (sprintId) params['sprint_id'] = sprintId;
      const res = await api.get<{ data: BoardResponse }>(`/projects/${projectId}/board`, params);
      set({
        phases: res.data.phases,
        activeSprint: res.data.sprint,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load board' });
    }
  },

  moveTask: (taskId, toPhaseId, position) => {
    const { phases } = get();

    let movedTask: Task | undefined;
    const updatedPhases = phases.map((phase) => {
      const taskIndex = phase.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        movedTask = phase.tasks[taskIndex];
        return {
          ...phase,
          tasks: phase.tasks.filter((t) => t.id !== taskId),
        };
      }
      return phase;
    });

    if (!movedTask) return;

    const taskWithNewPhase = { ...movedTask, phase_id: toPhaseId, position };

    const finalPhases = updatedPhases.map((phase) => {
      if (phase.id === toPhaseId) {
        const newTasks = [...phase.tasks];
        newTasks.splice(position, 0, taskWithNewPhase);
        return {
          ...phase,
          tasks: newTasks.map((t, idx) => ({ ...t, position: idx })),
        };
      }
      return phase;
    });

    set({ phases: finalPhases });
  },

  addTaskToPhase: (phaseId, task) => {
    const { phases } = get();
    set({
      phases: phases.map((phase) => {
        if (phase.id === phaseId) {
          return { ...phase, tasks: [...phase.tasks, task] };
        }
        return phase;
      }),
    });
  },

  updateTaskInBoard: (taskId, updates) => {
    const { phases } = get();
    set({
      phases: phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      })),
    });
  },

  removeTaskFromBoard: (taskId) => {
    const { phases } = get();
    set({
      phases: phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.filter((t) => t.id !== taskId),
      })),
    });
  },
}));
