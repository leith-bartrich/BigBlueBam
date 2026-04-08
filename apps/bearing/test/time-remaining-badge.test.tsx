import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeRemainingBadge } from '../src/components/common/TimeRemainingBadge';

describe('TimeRemainingBadge', () => {
  it('shows "X days remaining" for future dates', () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={futureDate} />);
    expect(screen.getByText(/\d+ days? remaining/)).toBeInTheDocument();
  });

  it('shows "X days overdue" for past dates', () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={pastDate} />);
    expect(screen.getByText(/\d+ days? overdue/)).toBeInTheDocument();
  });

  it('shows "Due today" for today', () => {
    // Use a date that is 0 days away (same calendar day)
    const today = new Date();
    today.setHours(23, 59, 59, 0);
    render(<TimeRemainingBadge endDate={today.toISOString()} />);
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('renders nothing for null endDate', () => {
    const { container } = render(<TimeRemainingBadge endDate={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for undefined endDate', () => {
    const { container } = render(<TimeRemainingBadge endDate={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('applies overdue styling (red) for past dates', () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={pastDate} />);
    const badge = screen.getByText(/overdue/).closest('span');
    expect(badge?.className).toContain('bg-red-100');
    expect(badge?.className).toContain('text-red-700');
  });

  it('applies urgent styling (yellow) for dates within 7 days', () => {
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={soonDate} />);
    const badge = screen.getByText(/remaining/).closest('span');
    expect(badge?.className).toContain('bg-yellow-100');
    expect(badge?.className).toContain('text-yellow-700');
  });

  it('applies default styling (zinc) for dates more than 7 days away', () => {
    const farDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={farDate} />);
    const badge = screen.getByText(/remaining/).closest('span');
    expect(badge?.className).toContain('bg-zinc-100');
    expect(badge?.className).toContain('text-zinc-600');
  });

  it('shows singular "1 day remaining" for 1 day away', () => {
    // differenceInDays floors, so we need ~1.5 days to get 1
    const oneDayAway = new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString();
    render(<TimeRemainingBadge endDate={oneDayAway} />);
    expect(screen.getByText('1 day remaining')).toBeInTheDocument();
  });
});
