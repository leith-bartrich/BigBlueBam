import { eq, and, sql, gte, lte, ne, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billInvoices, billExpenses, billPayments } from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Revenue summary
// ---------------------------------------------------------------------------

export async function getRevenueSummary(orgId: string, dateFrom?: string, dateTo?: string) {
  const conditions: any[] = [
    eq(billInvoices.organization_id, orgId),
    notInArray(billInvoices.status, ['draft', 'void', 'written_off']),
  ];
  if (dateFrom) conditions.push(gte(billInvoices.invoice_date, dateFrom));
  if (dateTo) conditions.push(lte(billInvoices.invoice_date, dateTo));

  const rows = await db
    .select({
      month: sql<string>`to_char(${billInvoices.invoice_date}::date, 'YYYY-MM')`,
      total_invoiced: sql<number>`COALESCE(SUM(${billInvoices.total}), 0)::bigint`,
      total_paid: sql<number>`COALESCE(SUM(${billInvoices.amount_paid}), 0)::bigint`,
      invoice_count: sql<number>`COUNT(*)::int`,
    })
    .from(billInvoices)
    .where(and(...conditions))
    .groupBy(sql`to_char(${billInvoices.invoice_date}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${billInvoices.invoice_date}::date, 'YYYY-MM')`);

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Outstanding (aging buckets)
// ---------------------------------------------------------------------------

export async function getOutstanding(orgId: string) {
  const rows = await db
    .select({
      client_id: billInvoices.client_id,
      to_name: billInvoices.to_name,
      bucket_0_30: sql<number>`COALESCE(SUM(CASE WHEN (CURRENT_DATE - ${billInvoices.due_date}::date) BETWEEN 0 AND 30 THEN ${billInvoices.total} - ${billInvoices.amount_paid} ELSE 0 END), 0)::bigint`,
      bucket_31_60: sql<number>`COALESCE(SUM(CASE WHEN (CURRENT_DATE - ${billInvoices.due_date}::date) BETWEEN 31 AND 60 THEN ${billInvoices.total} - ${billInvoices.amount_paid} ELSE 0 END), 0)::bigint`,
      bucket_61_90: sql<number>`COALESCE(SUM(CASE WHEN (CURRENT_DATE - ${billInvoices.due_date}::date) BETWEEN 61 AND 90 THEN ${billInvoices.total} - ${billInvoices.amount_paid} ELSE 0 END), 0)::bigint`,
      bucket_90_plus: sql<number>`COALESCE(SUM(CASE WHEN (CURRENT_DATE - ${billInvoices.due_date}::date) > 90 THEN ${billInvoices.total} - ${billInvoices.amount_paid} ELSE 0 END), 0)::bigint`,
    })
    .from(billInvoices)
    .where(
      and(
        eq(billInvoices.organization_id, orgId),
        notInArray(billInvoices.status, ['draft', 'paid', 'void', 'written_off']),
      ),
    )
    .groupBy(billInvoices.client_id, billInvoices.to_name);

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Profitability (revenue vs expenses per project)
// ---------------------------------------------------------------------------

export async function getProfitability(orgId: string) {
  // Revenue by project
  const revenueRows = await db
    .select({
      project_id: billInvoices.project_id,
      total_invoiced: sql<number>`COALESCE(SUM(${billInvoices.total}), 0)::bigint`,
      total_paid: sql<number>`COALESCE(SUM(${billInvoices.amount_paid}), 0)::bigint`,
    })
    .from(billInvoices)
    .where(
      and(
        eq(billInvoices.organization_id, orgId),
        notInArray(billInvoices.status, ['draft', 'void', 'written_off']),
      ),
    )
    .groupBy(billInvoices.project_id);

  // Expenses by project
  const expenseRows = await db
    .select({
      project_id: billExpenses.project_id,
      total_expenses: sql<number>`COALESCE(SUM(${billExpenses.amount}), 0)::bigint`,
    })
    .from(billExpenses)
    .where(
      and(
        eq(billExpenses.organization_id, orgId),
        eq(billExpenses.status, 'approved'),
      ),
    )
    .groupBy(billExpenses.project_id);

  // Merge
  const projectMap = new Map<string | null, { project_id: string | null; revenue: number; paid: number; expenses: number }>();

  for (const r of revenueRows) {
    projectMap.set(r.project_id, {
      project_id: r.project_id,
      revenue: Number(r.total_invoiced),
      paid: Number(r.total_paid),
      expenses: 0,
    });
  }

  for (const e of expenseRows) {
    const existing = projectMap.get(e.project_id);
    if (existing) {
      existing.expenses = Number(e.total_expenses);
    } else {
      projectMap.set(e.project_id, {
        project_id: e.project_id,
        revenue: 0,
        paid: 0,
        expenses: Number(e.total_expenses),
      });
    }
  }

  const data = Array.from(projectMap.values()).map((p) => ({
    ...p,
    profit: p.revenue - p.expenses,
    margin: p.revenue > 0 ? Math.round(((p.revenue - p.expenses) / p.revenue) * 10000) / 100 : 0,
  }));

  return { data };
}

// ---------------------------------------------------------------------------
// Overdue invoices
// ---------------------------------------------------------------------------

export async function getOverdue(orgId: string) {
  const rows = await db
    .select()
    .from(billInvoices)
    .where(
      and(
        eq(billInvoices.organization_id, orgId),
        notInArray(billInvoices.status, ['draft', 'paid', 'void', 'written_off']),
        lte(billInvoices.due_date, sql`CURRENT_DATE`),
      ),
    )
    .orderBy(billInvoices.due_date);

  const data = rows.map((inv) => ({
    ...inv,
    days_overdue: Math.floor(
      (Date.now() - new Date(inv.due_date).getTime()) / 86400000,
    ),
    amount_due: inv.total - inv.amount_paid,
  }));

  return { data };
}
