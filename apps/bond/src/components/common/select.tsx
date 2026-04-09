import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
}

export function Select({ value, onValueChange, options, placeholder = 'Select...', label, className }: SelectProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          className={cn(
            'inline-flex items-center justify-between w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm',
            'text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-50 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:bg-zinc-900 dark:border-zinc-700"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[state=checked]:text-primary-700 dark:data-[state=checked]:text-primary-400"
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
