import { create } from 'zustand';

export interface BeaconProject {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProjectState {
  /** null = org-wide (all projects) */
  activeProjectId: string | null;
  projects: BeaconProject[];

  setActiveProject: (id: string | null) => void;
  setProjects: (projects: BeaconProject[]) => void;
}

// Persist the active project selection to localStorage
function loadActiveProjectId(): string | null {
  try {
    return localStorage.getItem('beacon_active_project_id') || null;
  } catch {
    return null;
  }
}

function saveActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem('beacon_active_project_id', id);
    } else {
      localStorage.removeItem('beacon_active_project_id');
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
