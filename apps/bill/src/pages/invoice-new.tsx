import { useState } from 'react';
import { useClients } from '@/hooks/use-clients';
import { useCreateInvoice, useAddLineItem } from '@/hooks/use-invoices';
import { formatCents } from '@/lib/utils';

interface Props {
  onNavigate: (path: string) => void;
}

export function InvoiceNewPage({ onNavigate }: Props) {
  const { data: clients } = useClients();
  const createInvoice = useCreateInvoice();
  const addLineItem = useAddLineItem();

  const [clientId, setClientId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const total = subtotal + taxAmount;

  const handleAddRow = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveRow = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!clientId) return;

    try {
      const res = await createInvoice.mutateAsync({
        client_id: clientId,
        tax_rate: taxRate,
        notes,
      });

      const invoiceId = res.data.id;

      // Add line items
      for (const li of lineItems) {
        if (li.description && li.unit_price > 0) {
          await addLineItem.mutateAsync({
            invoiceId,
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
          });
        }
      }

      onNavigate(`/invoices/${invoiceId}`);
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">New Invoice</h1>

      {/* Client selection */}
      <div className="space-y-2">
        <label htmlFor="bill-invoice-client" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Client</label>
        <select
          id="bill-invoice-client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
        >
          <option value="">Select a client...</option>
          {clients?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-2 font-medium text-zinc-500">Description</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500 w-24">Qty</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500 w-32">Unit Price</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500 w-32">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => (
                <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={(e) => {
                        const items = [...lineItems];
                        items[idx]!.description = e.target.value;
                        setLineItems(items);
                      }}
                      placeholder="Description..."
                      className="w-full bg-transparent border-0 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      value={li.quantity}
                      onChange={(e) => {
                        const items = [...lineItems];
                        items[idx]!.quantity = Number(e.target.value);
                        setLineItems(items);
                      }}
                      className="w-20 text-right bg-transparent border-0 outline-none"
                      min={0}
                      step={0.5}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      value={li.unit_price}
                      onChange={(e) => {
                        const items = [...lineItems];
                        items[idx]!.unit_price = Number(e.target.value);
                        setLineItems(items);
                      }}
                      className="w-28 text-right bg-transparent border-0 outline-none"
                      min={0}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCents(li.quantity * li.unit_price)}
                  </td>
                  <td className="px-2">
                    <button
                      onClick={() => handleRemoveRow(idx)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={handleAddRow} className="text-sm text-green-600 hover:text-green-700 font-medium">
          + Add line item
        </button>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span className="font-medium">{formatCents(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Tax Rate</span>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-16 text-right bg-transparent border border-zinc-300 dark:border-zinc-600 rounded px-2 py-0.5"
              min={0}
              max={100}
              step={0.25}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax</span>
            <span>{formatCents(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="bill-invoice-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes (internal)</label>
        <textarea
          id="bill-invoice-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          rows={3}
          placeholder="Internal notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!clientId || createInvoice.isPending}
          className="rounded-lg bg-green-600 text-white px-6 py-2 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {createInvoice.isPending ? 'Creating...' : 'Create Draft Invoice'}
        </button>
        <button
          onClick={() => onNavigate('/')}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-6 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
