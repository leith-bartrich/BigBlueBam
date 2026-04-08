import clsx from 'clsx';
import { SectionDivider } from './section-divider';

interface SectionWrapperProps {
  id?: string;
  alternate?: boolean;
  dark?: boolean;
  className?: string;
  children: React.ReactNode;
  dividerTop?: boolean;
  dividerBottom?: boolean;
}

export function SectionWrapper({ id, alternate, dark, className, children, dividerTop, dividerBottom }: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={clsx(
        'relative py-20 md:py-28',
        dark ? 'bg-primary-950 text-white' : alternate ? 'bg-zinc-50' : 'bg-white',
        className,
      )}
    >
      {dividerTop && <SectionDivider position="top" />}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      {dividerBottom && <SectionDivider position="bottom" />}
    </section>
  );
}
