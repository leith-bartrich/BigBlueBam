import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusBadge, PriorityBadge } from '../src/components/common/badge';
import { Button } from '../src/components/common/button';
import { Input } from '../src/components/common/input';

afterEach(() => cleanup());

describe('StatusBadge', () => {
  it('renders with "open" status and green styling', () => {
    render(<StatusBadge status="open" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Open');
    expect(badge.className).toContain('bg-green-100');
  });

  it('renders with "in_progress" status and blue styling', () => {
    render(<StatusBadge status="in_progress" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('In Progress');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('renders with "waiting_on_customer" status and yellow styling', () => {
    render(<StatusBadge status="waiting_on_customer" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Waiting on Customer');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('renders with "resolved" status and purple styling', () => {
    render(<StatusBadge status="resolved" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Resolved');
    expect(badge.className).toContain('bg-purple-100');
  });

  it('renders with "closed" status and gray styling', () => {
    render(<StatusBadge status="closed" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Closed');
    expect(badge.className).toContain('bg-zinc-100');
  });
});

describe('PriorityBadge', () => {
  it('renders low priority', () => {
    render(<PriorityBadge priority="low" />);
    const badge = screen.getByTestId('priority-badge');
    expect(badge).toHaveTextContent('Low');
    expect(badge.className).toContain('bg-blue-50');
  });

  it('renders high priority', () => {
    render(<PriorityBadge priority="high" />);
    const badge = screen.getByTestId('priority-badge');
    expect(badge).toHaveTextContent('High');
    expect(badge.className).toContain('bg-orange-50');
  });
});

describe('Button', () => {
  it('renders primary variant by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-primary-600');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button.className).toContain('border-zinc-300');
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-red-600');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: 'Ghost' });
    expect(button.className).toContain('hover:bg-zinc-100');
  });

  it('shows loading spinner and disables when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('renders with a label', () => {
    render(<Input id="test" label="Email" placeholder="Enter email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input id="test" label="Email" error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<Input id="test" placeholder="No label" />);
    expect(screen.getByPlaceholderText('No label')).toBeInTheDocument();
  });
});
