import { useState } from 'react';
import { Search, Plus, Globe, Users, Handshake } from 'lucide-react';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { EmptyState } from '@/components/common/empty-state';
import { CreateCompanyDialog } from '@/components/companies/create-company-dialog';
import { useCompanies } from '@/hooks/use-companies';
import { cn, formatCurrencyCompact } from '@/lib/utils';
import { Loader2, Building2 } from 'lucide-react';

interface CompanyListPageProps {
  onNavigate: (path: string) => void;
}

export function CompanyListPage({ onNavigate }: CompanyListPageProps) {
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data, isLoading } = useCompanies({
    search: search || undefined,
  });
  const companies = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Companies</h2>
          <span className="text-sm text-zinc-500">{total} total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Company table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies found"
            description={search ? 'Try a different search term.' : 'Add your first company to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Company
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-medium">Company</th>
                <th className="px-6 py-3 text-left font-medium">Domain</th>
                <th className="px-6 py-3 text-left font-medium">Industry</th>
                <th className="px-6 py-3 text-left font-medium">Size</th>
                <th className="px-6 py-3 text-left font-medium">Revenue</th>
                <th className="px-6 py-3 text-left font-medium">Contacts</th>
                <th className="px-6 py-3 text-left font-medium">Deals</th>
                <th className="px-6 py-3 text-left font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {companies.map((company) => (
                <tr
                  key={company.id}
                  onClick={() => onNavigate(`/companies/${company.id}`)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="h-8 w-8 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          <Building2 className="h-4 w-4 text-zinc-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {company.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {company.domain ? (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {company.domain}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {company.industry ?? '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {company.size_bucket ?? '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {company.annual_revenue ? formatCurrencyCompact(company.annual_revenue) : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                      <Users className="h-3.5 w-3.5" />
                      {company.contact_count}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                      <Handshake className="h-3.5 w-3.5" />
                      {company.deal_count}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {company.owner_name ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateCompanyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(id) => onNavigate(`/companies/${id}`)}
      />
    </div>
  );
}
