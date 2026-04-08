import clsx from 'clsx';

type Variant = 'default' | 'coming-soon' | 'new' | 'blue' | 'green' | 'purple' | 'orange';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-zinc-100 text-zinc-700',
  'coming-soon': 'bg-amber-100 text-amber-800',
  new: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-primary-100 text-primary-800',
  green: 'bg-emerald-100 text-emerald-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
