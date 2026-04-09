import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Paintbrush, Code } from 'lucide-react';
import { useCreateTemplate, useTemplate, useUpdateTemplate } from '@/hooks/use-templates';
import { VisualBuilder } from '@/components/templates/visual-builder';
import { type EmailBlock, createBlock } from '@/components/templates/block-types';
import { blocksToHtml } from '@/components/templates/blocks-to-html';

interface TemplateEditorPageProps {
  templateId?: string;
  onNavigate: (path: string) => void;
}

/** Default blocks for a brand-new template */
function defaultBlocks(): EmailBlock[] {
  const header = createBlock('header');
  if (header.type === 'header') header.props.text = 'Hello {{first_name}},';
  const text = createBlock('text');
  if (text.type === 'text') text.props.html = '<p>Your email content goes here. Write something great.</p>';
  const button = createBlock('button');
  const divider = createBlock('divider');
  const footer = createBlock('text');
  if (footer.type === 'text') {
    footer.props.html = '<p style="font-size:12px;color:#9ca3af;">You received this email because you subscribed. <a href="{{unsubscribe_url}}">Unsubscribe</a></p>';
    footer.props.fontSize = 12;
    footer.props.align = 'center';
    footer.props.color = '#9ca3af';
  }
  return [header, text, button, divider, footer];
}

export function TemplateEditorPage({ templateId, onNavigate }: TemplateEditorPageProps) {
  const isNew = !templateId;
  const { data: existing } = useTemplate(templateId);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(templateId ?? '');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [rawHtml, setRawHtml] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Load existing template data
  useEffect(() => {
    if (!existing?.data || loaded) return;
    const t = existing.data;
    setName(t.name);
    setDescription(t.description ?? '');
    setSubjectTemplate(t.subject_template);

    // Restore blocks from json_design if present, otherwise fall back to raw HTML mode
    if (t.json_design && Array.isArray(t.json_design) && (t.json_design as EmailBlock[]).length > 0) {
      setBlocks(t.json_design as EmailBlock[]);
      setMode('visual');
    } else if (t.html_body) {
      setRawHtml(t.html_body);
      setMode('html');
    }
    setLoaded(true);
  }, [existing, loaded]);

  // Keep raw HTML in sync when in visual mode
  const visualHtml = useMemo(() => blocksToHtml(blocks), [blocks]);

  const htmlBody = mode === 'visual' ? visualHtml : rawHtml;

  const sampleVars: Record<string, string> = { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', company: 'Acme Inc' };

  const previewSubject = subjectTemplate.replace(/\{\{(\w+)\}\}/g, (_, field) => sampleVars[field] ?? `[${field}]`);

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const handleSave = async () => {
    if (!name || !subjectTemplate) return;

    const payload = {
      name,
      description: description || undefined,
      subject_template: subjectTemplate,
      html_body: htmlBody,
      json_design: mode === 'visual' ? (blocks as unknown[]) : undefined,
    };

    try {
      if (isNew) {
        await createTemplate.mutateAsync(payload);
      } else {
        await updateTemplate.mutateAsync(payload);
      }
      onNavigate('/templates');
    } catch {
      // Error handled by mutation
    }
  };

  const input =
    'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/templates')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {isNew ? 'New Template' : 'Edit Template'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === 'visual'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Paintbrush className="h-3.5 w-3.5" /> Visual
            </button>
            <button
              type="button"
              onClick={() => {
                // Sync HTML from visual blocks when switching to HTML mode
                if (mode === 'visual') setRawHtml(visualHtml);
                setMode('html');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === 'html'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Code className="h-3.5 w-3.5" /> HTML
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!name || !subjectTemplate || isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Template Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Newsletter" className={input} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Subject Line *</label>
          <input
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            placeholder="e.g., {{first_name}}, check out what's new!"
            className={input}
          />
          {subjectTemplate && (
            <p className="mt-1 text-[10px] text-zinc-400 truncate">Preview: {previewSubject}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Internal note..." className={input} />
        </div>
      </div>

      {/* Builder body */}
      <div className="flex-1 min-h-0">
        {mode === 'visual' ? (
          <VisualBuilder blocks={blocks} onChange={setBlocks} />
        ) : (
          /* HTML mode: raw editor + live preview side-by-side */
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            <div className="p-4 overflow-auto">
              <label className="block text-xs font-medium text-zinc-500 mb-2">HTML Body</label>
              <textarea
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                className="w-full h-[calc(100%-2rem)] px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-700 p-4 overflow-auto bg-zinc-50 dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-500">Preview</label>
                <span className="text-[10px] text-zinc-400">Subject: {previewSubject}</span>
              </div>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxWidth: 600 }}>
                <iframe
                  srcDoc={rawHtml}
                  className="w-full border-0"
                  style={{ height: 500 }}
                  sandbox="allow-same-origin"
                  title="Email preview"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
