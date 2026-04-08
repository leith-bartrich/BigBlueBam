import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { EFFECTS } from '@/lib/animation-config';

interface SectionDividerProps {
  position?: 'top' | 'bottom';
}

export function SectionDivider({ position = 'top' }: SectionDividerProps) {
  const prefersReduced = useReducedMotion();
  const config = EFFECTS.sectionLines;

  if (!config.enabled || prefersReduced) return null;

  return (
    <div
      className={clsx(
        'absolute left-0 right-0',
        position === 'top' ? 'top-0' : 'bottom-0',
      )}
    >
      <motion.div
        className={clsx('mx-auto h-px max-w-5xl bg-gradient-to-r', config.gradient)}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: config.duration, ease: [0.21, 0.47, 0.32, 0.98] }}
        style={{ originX: 0.5 }}
      />
    </div>
  );
}
