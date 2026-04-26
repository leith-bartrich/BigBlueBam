import { useQuery } from '@tanstack/react-query';
import { bbbGet } from '@/lib/bbb-api';
import { useProjectStore, type BoardProject } from '@/stores/project.store';
import { useEffect } from 'react';

interface ProjectFromApi {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProjectsResponse {
  data: ProjectFromApi[];
}

/**
 * Fetches the current org's projects from the Bam API and syncs them
 * into the project Zustand store.
 */
export function useProjects() {
  const setProjects = useProjectStore((s) => s.setProjects);

  const query = useQuery({
    queryKey: ['bbb', 'projects'],
    queryFn: () => bbbGet<ProjectsResponse>('/projects'),
    staleTime: 60_000,
  });

  const projects: BoardProject[] = (query.data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
  }));

  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const knownOrgId = useProjectStore((s) => s.knownOrgId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  useEffect(() => {
    if (projects.length > 0) {
      setProjects(projects);
    }
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Self-heal a stale activeProjectId. If the user has a non-null
  // selection from a previous session, an org switch, or hand-edited
  // localStorage, and the projects fetch comes back successful with a
  // list that does not contain it, the All Boards listing will silently
  // filter to a project the user can't see and look empty. Better to
  // fall back to "All Projects" so SOMETHING shows up. We only do this
  // once we have a successful fetch (query.isSuccess) — without that
  // guard a transient network error would wipe a perfectly valid
  // selection. We also require knownOrgId to be set so the project
  // store knows which org to write the cleared key to.
  useEffect(() => {
    if (!query.isSuccess) return;
    if (!knownOrgId) return;
    if (activeProjectId === null) return;
    if (projects.some((p) => p.id === activeProjectId)) return;
    setActiveProject(knownOrgId, null);
  }, [query.isSuccess, activeProjectId, knownOrgId, projects, setActiveProject]);

  return { ...query, projects };
}

/**
 * Returns the project name for a given ID from the store, or undefined.
 */
export function useProjectName(projectId: string | null | undefined): string | undefined {
  const projects = useProjectStore((s) => s.projects);
  if (!projectId) return undefined;
  return projects.find((p) => p.id === projectId)?.name;
}
