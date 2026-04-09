import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

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

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
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

export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
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

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: '#71717a',
    sent: '#3b82f6',
    viewed: '#8b5cf6',
    paid: '#16a34a',
    partially_paid: '#f59e0b',
    overdue: '#ef4444',
    void: '#a1a1aa',
    written_off: '#a1a1aa',
  };
  return colors[status] ?? '#64748b';
}

export function statusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partially_paid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    void: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
    written_off: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    reimbursed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return classes[status] ?? 'bg-zinc-100 text-zinc-600';
}
