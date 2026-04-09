import { useState } from 'react';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { useLogActivity, type ActivityType } from '@/hooks/use-activities';

const ACTIVITY_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'email_received', label: 'Email Received' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
];

interface LogActivityFormProps {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  onSuccess?: () => void;
}

export function LogActivityForm({ contactId, dealId, companyId, onSuccess }: LogActivityFormProps) {
  const [activityType, setActivityType] = useState<string>('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const logActivity = useLogActivity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() && !body.trim()) return;

    await logActivity.mutateAsync({
      activity_type: activityType as ActivityType,
      subject: subject.trim() || undefined,
      body: body.trim() || undefined,
      contact_id: contactId,
      deal_id: dealId,
      company_id: companyId,
    });

    setSubject('');
    setBody('');
    setActivityType('note');
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
      <div className="flex gap-3">
        <div className="w-40">
          <Select
            value={activityType}
            onValueChange={setActivityType}
            options={ACTIVITY_OPTIONS}
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Subject..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>
      <textarea
        placeholder="Add details..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 min-h-[80px] resize-y"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={logActivity.isPending}>
          Log Activity
        </Button>
      </div>
    </form>
  );
}
