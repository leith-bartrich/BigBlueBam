import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from 'date-fns';

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

export function formatMessageTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'h:mm a');
  } catch {
    return dateString;
  }
}

export function formatMessageDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  } catch {
    return dateString;
  }
}

export function formatAbsoluteTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
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

/** Presence status to dot color class */
export function presenceColor(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-presence-online';
    case 'idle':
      return 'bg-presence-idle';
    case 'dnd':
      return 'bg-presence-dnd';
    case 'in_call':
      return 'bg-presence-in-call';
    default:
      return 'bg-presence-offline';
  }
}

/** Presence status to a short human label. */
export function presenceLabel(status: string): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'dnd':
      return 'Do not disturb';
    case 'in_call':
      return 'In a call';
    case 'offline':
      return 'Offline';
    default:
      return status;
  }
}
