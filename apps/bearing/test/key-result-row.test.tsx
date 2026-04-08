import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KeyResultRow } from '../src/components/goal/KeyResultRow';
import type { KeyResult } from '../src/hooks/useKeyResults';

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeKr(overrides: Partial<KeyResult> = {}): KeyResult {
  return {
    id: 'kr-1',
    goal_id: 'goal-1',
    title: 'Close 50 deals',
    description: null,
    metric_type: 'number',
    start_value: 0,
    current_value: 30,
    target_value: 50,
    unit: null,
    progress: 60,
    sort_order: 1,
    created_at: '2025-04-01T00:00:00Z',
    updated_at: '2025-04-05T00:00:00Z',
    ...overrides,
  };
}

describe('KeyResultRow', () => {
  it('renders KR title', () => {
    render(
      <KeyResultRow kr={makeKr()} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    expect(screen.getByText('Close 50 deals')).toBeInTheDocument();
  });

  it('shows current/target value for number type', () => {
    render(
      <KeyResultRow kr={makeKr({ current_value: 30, target_value: 50, metric_type: 'number' })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    // The values appear inside a span as "30 / 50"
    const valueSpan = screen.getByText(/30.*\/.*50/);
    expect(valueSpan).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(
      <KeyResultRow kr={makeKr({ progress: 60 })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows percentage metric type indicator', () => {
    const { container } = render(
      <KeyResultRow kr={makeKr({ metric_type: 'percentage', current_value: 75, target_value: 100 })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    // The Percent icon from lucide-react renders as an SVG
    const icon = container.querySelector('.h-4.w-4.text-zinc-500');
    expect(icon).toBeInTheDocument();
  });

  it('shows currency metric type with unit label', () => {
    render(
      <KeyResultRow kr={makeKr({ metric_type: 'currency', current_value: 50000, target_value: 100000, unit: '$' })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
  });

  it('shows boolean metric type as Yes/No', () => {
    render(
      <KeyResultRow kr={makeKr({ metric_type: 'boolean', current_value: 1, target_value: 1 })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    expect(screen.getByText(/Yes/)).toBeInTheDocument();
  });

  it('shows number metric with unit label', () => {
    render(
      <KeyResultRow kr={makeKr({ title: 'Revenue deals', metric_type: 'number', current_value: 30, target_value: 50, unit: 'deals' })} goalId="goal-1" onEdit={vi.fn()} />,
      { wrapper: createQueryWrapper() },
    );
    // Both values with units appear in the same span: "30 deals / 50 deals"
    const valueSpan = screen.getByText(/30 deals.*\/.*50 deals/);
    expect(valueSpan).toBeInTheDocument();
  });
});
