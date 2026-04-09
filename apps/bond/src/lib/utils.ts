import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function generateAvatarInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.substring(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

export function formatCurrency(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '-';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function formatCurrencyCompact(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '-';
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return formatCurrency(cents, currency);
}

export function daysInStage(stageEnteredAt: string | null | undefined): number {
  if (!stageEnteredAt) return 0;
  try {
    return differenceInDays(new Date(), parseISO(stageEnteredAt));
  } catch {
    return 0;
  }
}

export function lifecycleStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    subscriber: 'Subscriber',
    lead: 'Lead',
    marketing_qualified: 'MQL',
    sales_qualified: 'SQL',
    opportunity: 'Opportunity',
    customer: 'Customer',
    evangelist: 'Evangelist',
    other: 'Other',
  };
  return labels[stage] ?? stage;
}

export function lifecycleStageColor(stage: string): string {
  const colors: Record<string, string> = {
    subscriber: '#94a3b8',
    lead: '#3b82f6',
    marketing_qualified: '#8b5cf6',
    sales_qualified: '#f59e0b',
    opportunity: '#f97316',
    customer: '#16a34a',
    evangelist: '#06b6d4',
    other: '#64748b',
  };
  return colors[stage] ?? '#64748b';
}
