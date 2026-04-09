import { useState } from 'react';
import { Dialog } from '@/components/common/dialog';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { Select } from '@/components/common/select';
import { useCreateContact } from '@/hooks/use-contacts';

const LIFECYCLE_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'marketing_qualified', label: 'MQL' },
  { value: 'sales_qualified', label: 'SQL' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'customer', label: 'Customer' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'other', label: 'Other' },
];

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (contactId: string) => void;
}

export function CreateContactDialog({ open, onOpenChange, onSuccess }: CreateContactDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('lead');
  const createContact = useCreateContact();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim() && !email.trim()) return;

    const result = await createContact.mutateAsync({
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      lifecycle_stage: lifecycleStage,
    });

    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setTitle('');
    setLifecycleStage('lead');
    onOpenChange(false);
    onSuccess?.(result.data.id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Contact"
      description="Add a new contact to your CRM."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Job Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Select
          label="Lifecycle Stage"
          value={lifecycleStage}
          onValueChange={setLifecycleStage}
          options={LIFECYCLE_OPTIONS}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={createContact.isPending}>
            Create Contact
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
