import { create } from 'zustand';

export interface BoardProject {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProjectState {
  /** null = org-wide (all projects) */
  activeProjectId: string | null;
  projects: BoardProject[];

  setActiveProject: (id: string | null) => void;
  setProjects: (projects: BoardProject[]) => void;
}

function loadActiveProjectId(): string | null {
  try {
    return localStorage.getItem('board_active_project_id') || null;
  } catch {
    return null;
  }
}

function saveActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem('board_active_project_id', id);
    } else {
      localStorage.removeItem('board_active_project_id');
    }
  } catch {
    // ignore
  }
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: loadActiveProjectId(),
  projects: [],

  setActiveProject: (id) => {
    saveActiveProjectId(id);
    set({ activeProjectId: id });
  },

  setProjects: (projects) => {
    set({ projects });
  },
}));
