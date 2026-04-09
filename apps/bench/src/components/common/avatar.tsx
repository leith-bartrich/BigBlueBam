import { generateAvatarInitials, cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        className={cn('rounded-full object-cover', sizeMap[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-primary-600 text-white flex items-center justify-center font-medium',
        sizeMap[size],
        className,
      )}
    >
      {generateAvatarInitials(name)}
    </div>
  );
}
