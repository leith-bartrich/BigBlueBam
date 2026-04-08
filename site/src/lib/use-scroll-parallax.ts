import { useRef } from 'react';
import { useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { EFFECTS } from '@/lib/animation-config';

interface UseScrollParallaxReturn {
  ref: React.RefObject<HTMLElement | null>;
  y: MotionValue<number>;
}

export function useScrollParallax(): UseScrollParallaxReturn {
  const ref = useRef<HTMLElement | null>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const { enabled, intensity } = EFFECTS.parallaxLift;
  const maxOffset = 50 * intensity;
  const isActive = enabled && !prefersReduced;

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    isActive ? [maxOffset, -maxOffset] : [0, 0],
  );

  return { ref, y };
}
