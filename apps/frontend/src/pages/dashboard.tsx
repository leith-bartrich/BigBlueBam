import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';
import { createProjectSchema } from '@bigbluebam/shared';
import type { CreateProjectInput } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Dialog } from '@/components/common/dialog';
import { useProjects, useCreateProject } from '@/hooks/use-projects';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: projectsResponse, isLoading } = useProjects();
  const createProject = useCreateProject();

  const projects = projectsResponse?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', task_id_prefix: '', description: '' },
  });

  const onCreateProject = async (data: CreateProjectInput) => {
    try {
      const res = await createProject.mutateAsync(data);
      setShowCreateDialog(false);
      reset();
      onNavigate(`/projects/${res.data.id}/board`);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Dashboard' }]}
      onNavigate={onNavigate}
      onCreateProject={() => setShowCreateDialog(true)}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Projects</h1>
            <p className="text-sm text-zinc-500 mt-1">Manage your team&apos;s projects and boards</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="h-12 w-12 text-zinc-300 mb-4" />
            <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No projects yet</h2>
            <p className="text-sm text-zinc-500 mt-1 mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onNavigate(`/projects/${project.id}/board`)}
                className="group text-left bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="flex items-center justify-center h-10 w-10 rounded-lg text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: project.color ?? '#2563eb' }}
                  >
                    {project.icon ?? project.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">{project.task_id_prefix}</p>
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-zinc-500 line-clamp-2">{project.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="New Project"
        description="Set up a new project board for your team."
      >
        <form onSubmit={handleSubmit(onCreateProject)} className="space-y-4">
          <Input
            id="project-name"
            label="Project Name"
            placeholder="My Awesome Project"
            error={errors.name?.message}
            {...register('name')}
            autoFocus
          />
          <Input
            id="task-prefix"
            label="Task ID Prefix"
            placeholder="PRJ"
            error={errors.task_id_prefix?.message}
            {...register('task_id_prefix')}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-desc" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              id="project-desc"
              rows={2}
              placeholder="What is this project about?"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 resize-y"
              {...register('description')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createProject.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Dialog>
    </AppLayout>
  );
}
