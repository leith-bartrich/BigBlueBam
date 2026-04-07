import { useQuery } from '@tanstack/react-query';
import { bbbGet } from '@/lib/bbb-api';
import { useProjectStore, type BeaconProject } from '@/stores/project.store';
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

interface SingleProjectResponse {
  data: ProjectFromApi;
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

  const projects: BeaconProject[] = (query.data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
  }));

  useEffect(() => {
    if (projects.length > 0) {
      setProjects(projects);
    }
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...query, projects };
}

/**
 * Fetches a single project's details from the Bam API.
 */
export function useProject(id: string | null | undefined) {
  return useQuery({
    queryKey: ['bbb', 'projects', id],
    queryFn: () => bbbGet<SingleProjectResponse>(`/projects/${id}`),
    enabled: !!id,
    staleTime: 60_000,
    select: (res) => res.data,
  });
}

/**
 * Returns the project name for a given ID from the store, or undefined.
 */
export function useProjectName(projectId: string | null | undefined): string | undefined {
  const projects = useProjectStore((s) => s.projects);
  if (!projectId) return undefined;
  return projects.find((p) => p.id === projectId)?.name;
}
