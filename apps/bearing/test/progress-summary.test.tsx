import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the useProgress hook so we can control the data without a real API
vi.mock('../src/hooks/useProgress', () => ({
  usePeriodReport: vi.fn(),
}));

import { ProgressSummary } from '../src/components/dashboard/ProgressSummary';
import { usePeriodReport } from '../src/hooks/useProgress';

const mockedUsePeriodReport = vi.mocked(usePeriodReport);

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ProgressSummary', () => {
  it('renders total goal count', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: {
        data: {
          period_id: 'p-1',
          period_name: 'Q2 2025',
          total_goals: 12,
          avg_progress: 65,
          on_track: 7,
          at_risk: 3,
          behind: 1,
          achieved: 1,
          cancelled: 0,
          progress_over_time: [],
        },
      },
      isLoading: false,
    } as any);

    render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Total Goals')).toBeInTheDocument();
  });

  it('renders average progress percentage', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: {
        data: {
          period_id: 'p-1',
          period_name: 'Q2 2025',
          total_goals: 10,
          avg_progress: 45.7,
          on_track: 5,
          at_risk: 2,
          behind: 2,
          achieved: 1,
          cancelled: 0,
          progress_over_time: [],
        },
      },
      isLoading: false,
    } as any);

    render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    expect(screen.getByText('46%')).toBeInTheDocument();
    expect(screen.getByText('Avg Progress')).toBeInTheDocument();
  });

  it('renders at-risk count (at_risk + behind)', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: {
        data: {
          period_id: 'p-1',
          period_name: 'Q2 2025',
          total_goals: 10,
          avg_progress: 50,
          on_track: 5,
          at_risk: 3,
          behind: 2,
          achieved: 0,
          cancelled: 0,
          progress_over_time: [],
        },
      },
      isLoading: false,
    } as any);

    render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    expect(screen.getByText('5')).toBeInTheDocument(); // 3 at_risk + 2 behind
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  it('renders achieved count', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: {
        data: {
          period_id: 'p-1',
          period_name: 'Q2 2025',
          total_goals: 10,
          avg_progress: 80,
          on_track: 3,
          at_risk: 1,
          behind: 0,
          achieved: 6,
          cancelled: 0,
          progress_over_time: [],
        },
      },
      isLoading: false,
    } as any);

    render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Achieved')).toBeInTheDocument();
  });

  it('handles zero goals gracefully (no report data)', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);

    render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    expect(screen.getByText('Total Goals')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    // The 0 values appear in multiple stat cards
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('shows loading skeleton when data is loading', () => {
    mockedUsePeriodReport.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    const { container } = render(<ProgressSummary periodId="p-1" />, { wrapper: createQueryWrapper() });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });
});
