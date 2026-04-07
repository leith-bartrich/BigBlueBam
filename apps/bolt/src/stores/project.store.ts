import { create } from 'zustand';

export interface BoltProject {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProjectState {
  /** null = org-wide (all projects) */
  activeProjectId: string | null;
  projects: BoltProject[];

  setActiveProject: (id: string | null) => void;
  setProjects: (projects: BoltProject[]) => void;
}

// Persist the active project selection to localStorage
function loadActiveProjectId(): string | null {
  try {
    return localStorage.getItem('bolt_active_project_id') || null;
  } catch {
    return null;
  }
}

function saveActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem('bolt_active_project_id', id);
    } else {
      localStorage.removeItem('bolt_active_project_id');
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
