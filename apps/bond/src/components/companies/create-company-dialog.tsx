import { useState } from 'react';
import { Dialog } from '@/components/common/dialog';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { Select } from '@/components/common/select';
import { useCreateCompany } from '@/hooks/use-companies';

const SIZE_OPTIONS = [
  { value: '1-10', label: '1-10' },
  { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' },
  { value: '201-1000', label: '201-1000' },
  { value: '1001-5000', label: '1001-5000' },
  { value: '5000+', label: '5000+' },
];

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (companyId: string) => void;
}

export function CreateCompanyDialog({ open, onOpenChange, onSuccess }: CreateCompanyDialogProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [sizeBucket, setSizeBucket] = useState('');
  const [website, setWebsite] = useState('');
  const createCompany = useCreateCompany();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createCompany.mutateAsync({
      name: name.trim(),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      size_bucket: sizeBucket || undefined,
      website: website.trim() || undefined,
    });

    setName('');
    setDomain('');
    setIndustry('');
    setSizeBucket('');
    setWebsite('');
    onOpenChange(false);
    onSuccess?.(result.data.id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Company"
      description="Add a new company to your CRM."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Company Name"
          placeholder="e.g., Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Domain"
            placeholder="e.g., acme.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Input
            label="Industry"
            placeholder="e.g., Technology"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Company Size"
            value={sizeBucket}
            onValueChange={setSizeBucket}
            options={SIZE_OPTIONS}
            placeholder="Select size..."
          />
          <Input
            label="Website"
            placeholder="https://..."
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={createCompany.isPending}>
            Create Company
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
