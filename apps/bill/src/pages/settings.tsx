import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Props {
  onNavigate: (path: string) => void;
}

export function SettingsPage({ onNavigate: _onNavigate }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ data: any }>('/v1/settings'),
    select: (res) => res.data,
  });

  const updateSettings = useMutation({
    mutationFn: (body: any) => api.put('/v1/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    company_tax_id: '',
    default_currency: 'USD',
    default_tax_rate: 0,
    default_payment_terms_days: 30,
    default_payment_instructions: '',
    default_footer_text: '',
    default_terms_text: '',
    invoice_prefix: 'INV',
  });

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name ?? '',
        company_email: data.company_email ?? '',
        company_phone: data.company_phone ?? '',
        company_address: data.company_address ?? '',
        company_tax_id: data.company_tax_id ?? '',
        default_currency: data.default_currency ?? 'USD',
        default_tax_rate: Number(data.default_tax_rate ?? 0),
        default_payment_terms_days: data.default_payment_terms_days ?? 30,
        default_payment_instructions: data.default_payment_instructions ?? '',
        default_footer_text: data.default_footer_text ?? '',
        default_terms_text: data.default_terms_text ?? '',
        invoice_prefix: data.invoice_prefix ?? 'INV',
      });
    }
  }, [data]);

  const handleSave = () => {
    updateSettings.mutate(form);
  };

  if (isLoading) return <div className="p-6 text-zinc-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Billing Settings</h1>

      <div className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-2">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Company Name</label>
              <input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input type="email" value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone</label>
              <input type="text" value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tax ID</label>
              <input type="text" value={form.company_tax_id} onChange={(e) => setForm({ ...form, company_tax_id: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Address</label>
            <textarea value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" rows={3} />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-2">Invoice Defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Invoice Prefix</label>
              <input type="text" value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default Tax Rate (%)</label>
              <input type="number" value={form.default_tax_rate} onChange={(e) => setForm({ ...form, default_tax_rate: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" min={0} max={100} step={0.25} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Payment Terms (days)</label>
              <input type="number" value={form.default_payment_terms_days} onChange={(e) => setForm({ ...form, default_payment_terms_days: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" min={0} max={365} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default Payment Instructions</label>
            <textarea value={form.default_payment_instructions} onChange={(e) => setForm({ ...form, default_payment_instructions: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" rows={3} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default Footer Text</label>
            <textarea value={form.default_footer_text} onChange={(e) => setForm({ ...form, default_footer_text: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default Terms & Conditions</label>
            <textarea value={form.default_terms_text} onChange={(e) => setForm({ ...form, default_terms_text: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" rows={3} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="rounded-lg bg-green-600 text-white px-6 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
      </button>
      {updateSettings.isSuccess && <span className="text-sm text-green-600 ml-3">Saved!</span>}
    </div>
  );
}
