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

export function formatProgress(value: number | null | undefined): string {
  if (value == null) return '0%';
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
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

export function daysRemaining(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  try {
    return differenceInDays(parseISO(endDate), new Date());
  } catch {
    return null;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
