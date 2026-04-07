import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import {
  useDocument,
  useCreateDocument,
  useUpdateDocument,
  type DocumentVisibility,
  type DocumentStatus,
} from '@/hooks/use-documents';
import { useTemplates } from '@/hooks/use-templates';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { useProjectStore } from '@/stores/project.store';
import { useProjects } from '@/hooks/use-projects';

interface DocumentEditorPageProps {
  idOrSlug?: string;
  onNavigate: (path: string) => void;
}

const VISIBILITY_OPTIONS: { value: DocumentVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'organization', label: 'Organization' },
  { value: 'project', label: 'Project' },
  { value: 'private', label: 'Private' },
];

export function DocumentEditorPage({ idOrSlug, onNavigate }: DocumentEditorPageProps) {
  const isEditMode = !!idOrSlug;
  const { data: existing, isLoading: loadingExisting } = useDocument(idOrSlug);
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const { projects } = useProjects();
  const { data: templates } = useTemplates();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [iconEmoji, setIconEmoji] = useState('');
  const [projectId, setProjectId] = useState('');
  const [visibility, setVisibility] = useState<DocumentVisibility>('organization');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-select the active project from the store when creating
  useEffect(() => {
    if (!isEditMode && activeProjectId && !projectId) {
      setProjectId(activeProjectId);
    }
  }, [isEditMode, activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body_markdown ?? '');
      setSummary(existing.summary ?? '');
      setIconEmoji(existing.icon_emoji ?? '');
      setProjectId(existing.project_id ?? '');
      setVisibility(existing.visibility ?? 'organization');
    }
  }, [existing]);

  // Apply template content when a template is selected (new documents only)
  useEffect(() => {
    if (!isEditMode && selectedTemplateId && templates) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        if (!title) setTitle(template.name);
        setBody(template.body_markdown);
        setIconEmoji(template.icon_emoji ?? '');
      }
    }
  }, [selectedTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isEditMode && loadingExisting) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  const handleSaveDraft = async () => {
    setSaveError(null);
    try {
      if (isEditMode && existing) {
        await updateDocument.mutateAsync({
          id: existing.id,
          data: {
            title,
            body_markdown: body,
            summary: summary || undefined,
            icon_emoji: iconEmoji || undefined,
            visibility,
            status: 'draft' as DocumentStatus,
          },
        });
        onNavigate(`/documents/${idOrSlug}`);
      } else {
        const res = await createDocument.mutateAsync({
          title,
          body_markdown: body,
          summary: summary || undefined,
          icon_emoji: iconEmoji || undefined,
          project_id: projectId || undefined,
          template_id: selectedTemplateId || undefined,
          visibility,
          status: 'draft',
        });
        onNavigate(`/documents/${res.data.slug ?? res.data.id}`);
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save');
    }
  };

  const handlePublish = async () => {
    setSaveError(null);
    try {
      if (isEditMode && existing) {
        await updateDocument.mutateAsync({
          id: existing.id,
          data: {
            title,
            body_markdown: body,
            summary: summary || undefined,
            icon_emoji: iconEmoji || undefined,
            visibility,
            status: 'approved' as DocumentStatus,
          },
        });
        onNavigate(`/documents/${idOrSlug}`);
      } else {
        const res = await createDocument.mutateAsync({
          title,
          body_markdown: body,
          summary: summary || undefined,
          icon_emoji: iconEmoji || undefined,
          project_id: projectId || undefined,
          template_id: selectedTemplateId || undefined,
          visibility,
          status: 'approved',
        });
        onNavigate(`/documents/${res.data.slug ?? res.data.id}`);
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to publish');
    }
  };

  const isSaving = createDocument.isPending || updateDocument.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(isEditMode ? `/documents/${idOrSlug}` : '/documents')}
            className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isEditMode ? 'Edit Document' : 'New Document'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleSaveDraft} loading={isSaving} disabled={!title.trim()}>
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} loading={isSaving} disabled={!title.trim()}>
            Publish
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-3xl space-y-6">
            {saveError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {saveError}
              </div>
            )}

            {/* Title */}
            <div>
              <input
                type="text"
                placeholder="Document title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-bold bg-transparent border-0 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              />
            </div>

            {/* Summary */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                Summary (optional)
              </label>
              <input
                type="text"
                placeholder="Brief description of this document..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                Content (Markdown)
              </label>
              <textarea
                placeholder="Start writing your document in Markdown..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={24}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 resize-y font-mono leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="w-72 shrink-0 border-l border-zinc-200 dark:border-zinc-800 overflow-auto p-5 hidden lg:block">
          <div className="space-y-5">
            {/* Icon emoji */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                Icon (emoji)
              </label>
              <input
                type="text"
                placeholder="e.g. docs, notes..."
                value={iconEmoji}
                onChange={(e) => setIconEmoji(e.target.value.slice(0, 2))}
                maxLength={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Project selector */}
            {!isEditMode && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Project (optional)
                </label>
                <select
                  value={projectId || '__none__'}
                  onChange={(e) => setProjectId(e.target.value === '__none__' ? '' : e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                >
                  <option value="__none__">Organization-wide (no project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isEditMode && existing?.project_name && (
              <div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Project</span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{existing.project_name}</p>
              </div>
            )}

            {/* Template selector (new documents only) */}
            {!isEditMode && templates && templates.length > 0 && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Start from template
                </label>
                <select
                  value={selectedTemplateId || '__none__'}
                  onChange={(e) => setSelectedTemplateId(e.target.value === '__none__' ? '' : e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                >
                  <option value="__none__">Blank document</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon_emoji ? `${t.icon_emoji} ` : ''}{t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
