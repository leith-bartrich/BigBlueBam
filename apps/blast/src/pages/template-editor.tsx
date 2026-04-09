import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useCreateTemplate } from '@/hooks/use-templates';

interface TemplateEditorPageProps {
  templateId?: string;
  onNavigate: (path: string) => void;
}

export function TemplateEditorPage({ templateId, onNavigate }: TemplateEditorPageProps) {
  const isNew = !templateId;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [htmlBody, setHtmlBody] = useState(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Hello {{first_name}},</h1>
  <p>Your email content goes here.</p>
  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</body>
</html>`);

  const createTemplate = useCreateTemplate();

  const handleSave = async () => {
    if (!name || !subjectTemplate || !htmlBody) return;

    try {
      await createTemplate.mutateAsync({
        name,
        description: description || undefined,
        subject_template: subjectTemplate,
        html_body: htmlBody,
      });
      onNavigate('/templates');
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/templates')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {isNew ? 'New Template' : 'Edit Template'}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={!name || !subjectTemplate || createTemplate.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <Save className="h-4 w-4" />
          {createTemplate.isPending ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Newsletter"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject Template</label>
            <input
              type="text"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              placeholder="e.g., {{first_name}}, check out what's new!"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">HTML Body</label>
            <textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Preview Column */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Preview</label>
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white">
            <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
              Subject: {subjectTemplate.replace(/\{\{(\w+)\}\}/g, (_, field) => {
                const samples: Record<string, string> = { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' };
                return samples[field] ?? `[${field}]`;
              })}
            </div>
            <iframe
              srcDoc={htmlBody}
              className="w-full h-[500px] border-0"
              sandbox="allow-same-origin"
              title="Email preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
