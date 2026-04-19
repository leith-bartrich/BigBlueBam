import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn, generateAvatarInitials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Optional ring color (used by presence bar to mark each collaborator). */
  borderColor?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ src, name, size = 'md', className, borderColor }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full bg-primary-100 select-none shrink-0',
        sizeClasses[size],
        borderColor && 'ring-2',
        className,
      )}
      style={borderColor ? { boxShadow: `0 0 0 2px ${borderColor}` } : undefined}
    >
      {src && (
        <RadixAvatar.Image
          className="h-full w-full object-cover"
          src={src}
          alt={name ?? 'User avatar'}
        />
      )}
      <RadixAvatar.Fallback
        className="flex h-full w-full items-center justify-center bg-primary-100 font-medium text-primary-700"
        delayMs={src ? 600 : 0}
      >
        {generateAvatarInitials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
