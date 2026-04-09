import { useState, useEffect } from 'react';
import { useInvoice, useUpdateInvoice } from '@/hooks/use-invoices';

interface Props {
  invoiceId: string;
  onNavigate: (path: string) => void;
}

export function InvoiceEditPage({ invoiceId, onNavigate }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const updateInvoice = useUpdateInvoice();

  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [footerText, setFooterText] = useState('');
  const [termsText, setTermsText] = useState('');

  useEffect(() => {
    if (invoice) {
      setTaxRate(Number(invoice.tax_rate ?? 0));
      setNotes(invoice.notes ?? '');
      setFooterText(invoice.footer_text ?? '');
      setTermsText(invoice.terms_text ?? '');
    }
  }, [invoice]);

  if (isLoading) return <div className="p-6 text-zinc-400">Loading...</div>;
  if (!invoice) return <div className="p-6 text-zinc-400">Invoice not found</div>;

  if (invoice.status !== 'draft') {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Only draft invoices can be edited.</p>
        <button
          onClick={() => onNavigate(`/invoices/${invoiceId}`)}
          className="mt-4 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
        >
          Back to Invoice
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    await updateInvoice.mutateAsync({
      id: invoiceId,
      tax_rate: taxRate,
      notes,
      footer_text: footerText,
      terms_text: termsText,
    });
    onNavigate(`/invoices/${invoiceId}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Edit Invoice {invoice.invoice_number}</h1>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tax Rate (%)</label>
          <input
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            min={0}
            max={100}
            step={0.25}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Internal Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Footer Text (on invoice)</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Terms & Conditions (on invoice)</label>
          <textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateInvoice.isPending}
          className="rounded-lg bg-green-600 text-white px-6 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {updateInvoice.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => onNavigate(`/invoices/${invoiceId}`)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-6 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
