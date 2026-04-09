import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, addMonths, isSameDay, isSameMonth } from 'date-fns';

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

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'h:mm a');
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

export function eventStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: '#3b82f6',
    tentative: '#f59e0b',
    cancelled: '#ef4444',
  };
  return colors[status] ?? '#64748b';
}

export function visibilityLabel(visibility: string): string {
  const labels: Record<string, string> = {
    free: 'Free',
    busy: 'Busy',
    tentative: 'Tentative',
    out_of_office: 'Out of Office',
  };
  return labels[visibility] ?? visibility;
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end: endOfWeek(date, { weekStartsOn: 0 }) });
}

export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  return eachDayOfInterval({ start: calStart, end: calEnd });
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export { isSameDay, isSameMonth, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO };
