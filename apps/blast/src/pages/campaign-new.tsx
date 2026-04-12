import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Send, Paintbrush, Code, FileText } from 'lucide-react';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { useTemplates, useTemplate } from '@/hooks/use-templates';
import { useSegments } from '@/hooks/use-segments';
import { VisualBuilder } from '@/components/templates/visual-builder';
import { type EmailBlock, createBlock } from '@/components/templates/block-types';
import { blocksToHtml } from '@/components/templates/blocks-to-html';

interface CampaignNewPageProps {
  onNavigate: (path: string) => void;
}

type ContentMode = 'visual' | 'html' | 'template';

function defaultBlocks(): EmailBlock[] {
  const header = createBlock('header');
  if (header.type === 'header') header.props.text = 'Hello {{first_name}},';
  const text = createBlock('text');
  if (text.type === 'text') text.props.html = '<p>Your email content goes here.</p>';
  const button = createBlock('button');
  return [header, text, button];
}

export function CampaignNewPage({ onNavigate }: CampaignNewPageProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [segmentId, setSegmentId] = useState('');

  // Content state
  const [contentMode, setContentMode] = useState<ContentMode>('visual');
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks);
  const [rawHtml, setRawHtml] = useState('<p>Your email content here...</p>');

  const createCampaign = useCreateCampaign();
  const { data: templatesData } = useTemplates();
  const { data: segmentsData } = useSegments();
  const { data: selectedTemplate } = useTemplate(templateId || undefined);

  const templates = templatesData?.data ?? [];
  const segments = segmentsData?.data ?? [];

  // When a template is selected, load its content
  useEffect(() => {
    if (!selectedTemplate?.data) return;
    const t = selectedTemplate.data;
    if (t.json_design && Array.isArray(t.json_design) && (t.json_design as EmailBlock[]).length > 0) {
      setBlocks(t.json_design as EmailBlock[]);
      setContentMode('visual');
    } else if (t.html_body) {
      setRawHtml(t.html_body);
      setContentMode('html');
    }
    if (t.subject_template && !subject) {
      setSubject(t.subject_template);
    }
  }, [selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  const visualHtml = useMemo(() => blocksToHtml(blocks), [blocks]);
  const htmlBody = contentMode === 'visual' ? visualHtml : rawHtml;

  const handleCreate = async () => {
    if (!name || !subject) return;
    try {
      await createCampaign.mutateAsync({
        name,
        subject,
        html_body: htmlBody,
        template_id: templateId || undefined,
        segment_id: segmentId || undefined,
        from_name: fromName || undefined,
        from_email: fromEmail || undefined,
        reply_to_email: replyTo || undefined,
      });
      onNavigate('/');
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
            onClick={() => onNavigate('/')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">New Campaign</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreate}
            disabled={!name || !subject || createCampaign.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Send className="h-4 w-4" />
            {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>

      {/* Campaign settings bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div>
          <label htmlFor="blast-campaign-name" className="block text-xs font-medium text-zinc-500 mb-1">Campaign Name *</label>
          <input id="blast-campaign-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., April Product Launch" className={input} />
        </div>
        <div>
          <label htmlFor="blast-campaign-subject" className="block text-xs font-medium text-zinc-500 mb-1">Subject Line *</label>
          <input id="blast-campaign-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Introducing our newest features" className={input} />
        </div>
        <div>
          <label htmlFor="blast-campaign-from-name" className="block text-xs font-medium text-zinc-500 mb-1">From</label>
          <div className="flex gap-2">
            <input id="blast-campaign-from-name" type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Name" className={input} aria-label="From name" />
            <input id="blast-campaign-from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="Email" className={input} aria-label="From email" />
          </div>
        </div>
        <div>
          <label htmlFor="blast-campaign-segment" className="block text-xs font-medium text-zinc-500 mb-1">Segment</label>
          <select id="blast-campaign-segment" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className={input}>
            <option value="">All contacts</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.cached_count ?? '?'})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content mode selector */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <span className="text-xs font-medium text-zinc-500 mr-2">Content:</span>
        <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setContentMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              contentMode === 'visual'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Paintbrush className="h-3 w-3" /> Visual Builder
          </button>
          <button
            type="button"
            onClick={() => {
              if (contentMode === 'visual') setRawHtml(visualHtml);
              setContentMode('html');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              contentMode === 'html'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Code className="h-3 w-3" /> HTML
          </button>
          <button
            type="button"
            onClick={() => setContentMode('template')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              contentMode === 'template'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="h-3 w-3" /> From Template
          </button>
        </div>
        {contentMode === 'template' && (
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="ml-2 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Choose a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {contentMode === 'visual' ? (
          <VisualBuilder blocks={blocks} onChange={setBlocks} />
        ) : contentMode === 'html' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            <div className="p-4 overflow-auto">
              <label htmlFor="blast-campaign-html-body" className="block text-xs font-medium text-zinc-500 mb-2">HTML Body</label>
              <textarea
                id="blast-campaign-html-body"
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                className="w-full h-[calc(100%-2rem)] px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-700 p-4 overflow-auto bg-zinc-50 dark:bg-zinc-950">
              <label className="block text-xs font-medium text-zinc-500 mb-2">Preview</label>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxWidth: 600 }}>
                <iframe srcDoc={rawHtml} className="w-full border-0" style={{ height: 500 }} sandbox="allow-same-origin" title="Email preview" />
              </div>
            </div>
          </div>
        ) : (
          /* Template mode — show loaded template preview */
          <div className="p-6 flex flex-col items-center gap-4">
            {templateId && selectedTemplate?.data ? (
              <>
                <p className="text-sm text-zinc-500">
                  Using template: <span className="font-medium text-zinc-700 dark:text-zinc-300">{selectedTemplate.data.name}</span>
                </p>
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden" style={{ maxWidth: 600, width: '100%' }}>
                  <iframe
                    srcDoc={selectedTemplate.data.html_body}
                    className="w-full border-0"
                    style={{ height: 500 }}
                    sandbox="allow-same-origin"
                    title="Template preview"
                  />
                </div>
              </>
            ) : (
              <div className="text-center text-zinc-400 py-16">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Select a template above</p>
                <p className="text-xs mt-1">
                  Or{' '}
                  <button type="button" onClick={() => onNavigate('/templates/new')} className="text-red-600 hover:text-red-700 font-medium">
                    create a new template
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
