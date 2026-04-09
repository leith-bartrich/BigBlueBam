import { useState } from 'react';
import {
  Users, Mail, Phone, MapPin, FileText, ArrowLeft, Edit2, Save, X,
} from 'lucide-react';
import { useClient, useUpdateClient } from '@/hooks/use-clients';
import { useInvoices } from '@/hooks/use-invoices';
import { formatDate, formatCents, statusBadgeClass, cn } from '@/lib/utils';

interface Props {
  clientId: string;
  onNavigate: (path: string) => void;
}

export function ClientDetailPage({ clientId, onNavigate }: Props) {
  const { data: client, isLoading } = useClient(clientId);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices({ client_id: clientId });
  const updateClient = useUpdateClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  if (isLoading) return <div className="p-6 text-zinc-400">Loading...</div>;
  if (!client) return <div className="p-6 text-zinc-400">Client not found</div>;

  const clientInvoices = invoices ?? [];
  const totalBilled = clientInvoices.reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0);
  const totalPaid = clientInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid ?? 0), 0);
  const outstanding = totalBilled - totalPaid;

  const address = [
    client.address_line1,
    client.address_line2,
    [client.city, client.state_region, client.postal_code].filter(Boolean).join(', '),
    client.country,
  ]
    .filter(Boolean)
    .join('\n');

  const startEditing = () => {
    setEditForm({
      name: client.name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      address_line1: client.address_line1 ?? '',
      address_line2: client.address_line2 ?? '',
      city: client.city ?? '',
      state_region: client.state_region ?? '',
      postal_code: client.postal_code ?? '',
      country: client.country ?? '',
      tax_id: client.tax_id ?? '',
      notes: client.notes ?? '',
    });
    setEditing(true);
  };

  const saveEdits = async () => {
    await updateClient.mutateAsync({
      id: clientId,
      name: editForm.name || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      address_line1: editForm.address_line1 || undefined,
      address_line2: editForm.address_line2 || undefined,
      city: editForm.city || undefined,
      state_region: editForm.state_region || undefined,
      postal_code: editForm.postal_code || undefined,
      country: editForm.country || undefined,
      tax_id: editForm.tax_id || undefined,
      notes: editForm.notes || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/clients')}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {client.name}
            </h1>
            {client.email && (
              <p className="text-sm text-zinc-500">{client.email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={updateClient.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Billed</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formatCents(totalBilled)}</p>
        </div>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-600">{formatCents(totalPaid)}</p>
        </div>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Outstanding Balance</p>
          <p className={cn('text-xl font-bold', outstanding > 0 ? 'text-amber-600' : 'text-zinc-400')}>
            {formatCents(outstanding)}
          </p>
        </div>
      </div>

      {/* Client details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Contact info */}
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Contact Information</h3>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">{client.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">{client.phone || 'No phone'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Address & tax info */}
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Address & Tax</h3>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={editForm.address_line1}
                  onChange={(e) => setEditForm((f) => ({ ...f, address_line1: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={editForm.address_line2}
                  onChange={(e) => setEditForm((f) => ({ ...f, address_line2: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state_region}
                    onChange={(e) => setEditForm((f) => ({ ...f, state_region: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={editForm.postal_code}
                    onChange={(e) => setEditForm((f) => ({ ...f, postal_code: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={editForm.tax_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, tax_id: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-zinc-400 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {address || 'No address'}
                </span>
              </div>
              {client.tax_id && (
                <div className="text-sm">
                  <span className="text-zinc-500">Tax ID:</span>{' '}
                  <span className="text-zinc-700 dark:text-zinc-300">{client.tax_id}</span>
                </div>
              )}
              <div className="text-sm">
                <span className="text-zinc-500">Payment terms:</span>{' '}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {client.default_payment_terms_days ?? 30} days
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes (if editing) */}
      {editing && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Notes</h3>
          <textarea
            rows={3}
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            placeholder="Internal notes about this client..."
          />
        </div>
      )}

      {/* Notes (read-only) */}
      {!editing && client.notes && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Notes</h3>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{client.notes}</p>
        </div>
      )}

      {/* Invoices table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Invoices</h2>
          <button
            onClick={() => onNavigate('/invoices/new')}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            + New Invoice
          </button>
        </div>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoicesLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-zinc-400">Loading invoices...</td>
                </tr>
              ) : clientInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-zinc-400">
                    <FileText className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
                    No invoices yet for this client.
                  </td>
                </tr>
              ) : (
                clientInvoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    onClick={() => onNavigate(`/invoices/${inv.id}`)}
                    className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-zinc-500">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusBadgeClass(inv.status))}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCents(inv.total)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCents(inv.amount_paid)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">
                      {formatCents((inv.total ?? 0) - (inv.amount_paid ?? 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
