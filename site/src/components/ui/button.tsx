import clsx from 'clsx';

type Variant = 'primary' | 'outline' | 'ghost' | 'white';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
  white: 'bg-white text-primary-900 hover:bg-primary-50 shadow-sm',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', href, className, children, onClick }: ButtonProps) {
  const cls = clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
    variantStyles[variant],
    sizeStyles[size],
    className,
  );

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
