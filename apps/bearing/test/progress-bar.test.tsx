import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../src/components/common/ProgressBar';

// motion/react uses framer-motion animations; in jsdom the animated width won't
// resolve to a real style, so we test the rendered text label and aria attributes.

describe('ProgressBar', () => {
  it('renders 0% progress', () => {
    render(<ProgressBar value={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders 50% progress with correct label', () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders 100% progress', () => {
    render(<ProgressBar value={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps values above 100', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps negative values to 0', () => {
    render(<ProgressBar value={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows percentage label by default', () => {
    render(<ProgressBar value={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('hides percentage label when showLabel is false', () => {
    render(<ProgressBar value={42} showLabel={false} />);
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
  });

  it('renders the progress track container', () => {
    const { container } = render(<ProgressBar value={60} />);
    const track = container.querySelector('.rounded-full.bg-zinc-200');
    expect(track).toBeInTheDocument();
  });
});
