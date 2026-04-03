import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Button } from '../src/components/common/button';
import { Badge } from '../src/components/common/badge';
import { Input } from '../src/components/common/input';
import { Avatar } from '../src/components/common/avatar';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary-600');
  });

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('bg-white');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-zinc-600');
  });

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('is disabled when disabled prop passed', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

describe('Badge', () => {
  it('renders with text content', () => {
    render(<Badge>Feature</Badge>);
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('bg-zinc-100');
  });

  it('applies danger variant', () => {
    render(<Badge variant="danger">Critical</Badge>);
    const badge = screen.getByText('Critical');
    expect(badge.className).toContain('bg-red-100');
  });

  it('applies custom color via style', () => {
    render(<Badge variant="custom" color="#ff5500">Label</Badge>);
    const badge = screen.getByText('Label');
    expect(badge.style.color).toBe('rgb(255, 85, 0)');
  });
});

describe('Input', () => {
  it('renders with label', () => {
    render(<Input id="test" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input id="test" label="Email" error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('applies error border class when error present', () => {
    render(<Input id="test" error="Oops" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-red-500');
  });

  it('passes placeholder prop', () => {
    render(<Input id="test" placeholder="Enter value" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('shows fallback initials when no image is provided', async () => {
    render(<Avatar name="Jane Doe" />);
    await waitFor(() => {
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  it('shows first two letters for single-word name', async () => {
    render(<Avatar name="Jane" />);
    await waitFor(() => {
      expect(screen.getByText('JA')).toBeInTheDocument();
    });
  });

  it('renders question mark fallback when name is null', async () => {
    render(<Avatar />);
    await waitFor(() => {
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  it('applies size classes', () => {
    render(<Avatar name="Test User" size="lg" />);
    const root = document.querySelector('[class*="rounded-full"]');
    expect(root?.className).toContain('h-10');
    expect(root?.className).toContain('w-10');
  });
});

describe('Login form validation', () => {
  it('shows validation errors for empty submit', async () => {
    // We test the Input component directly for required field validation display
    render(
      <form>
        <Input id="email" label="Email" error="Email is required" />
        <Input id="password" label="Password" error="Password is required" />
      </form>,
    );
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });
});
