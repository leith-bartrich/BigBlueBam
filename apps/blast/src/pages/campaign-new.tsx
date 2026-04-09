import { useState } from 'react';
import { ArrowLeft, Send, Clock } from 'lucide-react';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { useTemplates } from '@/hooks/use-templates';
import { useSegments } from '@/hooks/use-segments';

interface CampaignNewPageProps {
  onNavigate: (path: string) => void;
}

export function CampaignNewPage({ onNavigate }: CampaignNewPageProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [htmlBody, setHtmlBody] = useState('<p>Your email content here...</p>');

  const createCampaign = useCreateCampaign();
  const { data: templatesData } = useTemplates();
  const { data: segmentsData } = useSegments();

  const templates = templatesData?.data ?? [];
  const segments = segmentsData?.data ?? [];

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('/')}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">New Campaign</h1>
      </div>

      <div className="space-y-4">
        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Campaign Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., April Product Launch"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Introducing our newest features"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* From */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">From Name</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your Company"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">From Email</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="newsletter@company.com"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Reply To */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reply-To Email (optional)</label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="replies@company.com"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Template Picker */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">No template (write from scratch)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Segment Picker */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Recipient Segment</label>
          <select
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All contacts</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.cached_count ?? '?'} contacts)</option>
            ))}
          </select>
        </div>

        {/* HTML Body */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Body (HTML)</label>
          <textarea
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleCreate}
            disabled={!name || !subject || createCampaign.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Send className="h-4 w-4" />
            {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
          </button>
          <button
            onClick={() => onNavigate('/')}
            className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
