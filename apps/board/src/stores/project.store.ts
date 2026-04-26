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
  /** The org id that activeProjectId belongs to. Used to detect a stale
   *  match when the user switches orgs without a full page reload. */
  knownOrgId: string | null;

  /** Set the active project for the given org. The org id is required so
   *  the persisted key never crosses orgs (the cross-org leak that
   *  produced misaligned project_id rows in the boards table). Pass
   *  projectId=null to clear the org's selection. */
  setActiveProject: (orgId: string, projectId: string | null) => void;

  /** Hydrate the active project from localStorage for the given org.
   *  Called by app.tsx once fetchMe resolves so we know the user's org. */
  hydrateForOrg: (orgId: string) => void;

  /** Clear the entire active-project state, both in memory and on disk
   *  for ALL orgs. Called by the org-switcher BEFORE the page reload so
   *  no stale id can leak forward into the next org's session. */
  clearAll: () => void;

  setProjects: (projects: BoardProject[]) => void;
}

const KEY_PREFIX = 'board_active_project_id';
const LEGACY_KEY = 'board_active_project_id';

function keyFor(orgId: string): string {
  return `${KEY_PREFIX}:${orgId}`;
}

function loadFor(orgId: string): string | null {
  try {
    const orgScoped = localStorage.getItem(keyFor(orgId));
    if (orgScoped) return orgScoped;
    // First-launch migration: the previous version of this store used a
    // single un-scoped key. If the legacy value happens to belong to a
    // different org, hydrating with it would re-create the cross-org
    // leak we are fixing — so we deliberately do NOT migrate the legacy
    // value into the new key. Instead we clear it once and start clean
    // on the org-scoped path.
    if (localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

function saveFor(orgId: string, projectId: string | null): void {
  try {
    if (projectId) {
      localStorage.setItem(keyFor(orgId), projectId);
    } else {
      localStorage.removeItem(keyFor(orgId));
    }
  } catch {
    // ignore — quota / sandboxed iframe / private mode
  }
}

function clearAllFromStorage(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k === LEGACY_KEY || k.startsWith(`${KEY_PREFIX}:`))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeProjectId: null,
  projects: [],
  knownOrgId: null,

  setActiveProject: (orgId, projectId) => {
    saveFor(orgId, projectId);
    set({ activeProjectId: projectId, knownOrgId: orgId });
  },

  hydrateForOrg: (orgId) => {
    const current = get();
    // If we are already hydrated for this org, leave the in-memory state
    // alone — a refresh from disk would clobber an unsaved selection.
    if (current.knownOrgId === orgId) return;
    const stored = loadFor(orgId);
    set({ activeProjectId: stored, knownOrgId: orgId });
  },

  clearAll: () => {
    clearAllFromStorage();
    set({ activeProjectId: null, knownOrgId: null });
  },

  setProjects: (projects) => {
    set({ projects });
  },
}));
