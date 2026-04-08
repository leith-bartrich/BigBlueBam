import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { EFFECTS } from '@/lib/animation-config';

type Direction = 'up' | 'down' | 'left' | 'right';

interface AnimatedRevealProps {
  direction?: Direction;
  delay?: number;
  children: ReactNode;
  className?: string;
  withScale?: boolean;
}

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

export function AnimatedReveal({ direction = 'up', delay = 0, children, className, withScale }: AnimatedRevealProps) {
  const reduced = useReducedMotion();
  const offset = offsets[direction];
  const applyScale = withScale && EFFECTS.revealScale.enabled && !reduced;

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, x: offset.x, y: offset.y, ...(applyScale && { scale: EFFECTS.revealScale.from }) }}
      whileInView={{ opacity: 1, x: 0, y: 0, ...(applyScale && { scale: 1 }) }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
