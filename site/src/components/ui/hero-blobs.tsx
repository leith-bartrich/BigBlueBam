import { useScroll, useTransform, useReducedMotion, motion } from 'motion/react';
import clsx from 'clsx';
import { EFFECTS } from '@/lib/animation-config';

interface BlobDef {
  color: string;
  size: string;
  position: string;
  speed: number;
}

const blobs: BlobDef[] = [
  {
    color: 'bg-primary-300/50',
    size: 'h-[500px] w-[500px]',
    position: '-top-32 -left-24',
    speed: 0.6,
  },
  {
    color: 'bg-blue-300/40',
    size: 'h-[400px] w-[400px]',
    position: 'top-16 right-12',
    speed: 1.0,
  },
  {
    color: 'bg-violet-300/35',
    size: 'h-[350px] w-[350px]',
    position: 'top-48 left-1/3',
    speed: 0.8,
  },
];

export function HeroBlobs() {
  const prefersReduced = useReducedMotion();
  const { scrollY } = useScroll();

  const { enabled, intensity, layers } = EFFECTS.heroBlobs;

  const activeBlobs = blobs.slice(0, layers);

  const y0 = useTransform(scrollY, [0, 1000], [0, -200 * activeBlobs[0]?.speed * intensity]);
  const y1 = useTransform(scrollY, [0, 1000], [0, -200 * (activeBlobs[1]?.speed ?? 0) * intensity]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -200 * (activeBlobs[2]?.speed ?? 0) * intensity]);

  const yValues = [y0, y1, y2];

  if (!enabled || prefersReduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {activeBlobs.map((blob, i) => (
        <motion.div
          key={i}
          className={clsx('absolute rounded-full blur-3xl', blob.color, blob.size, blob.position)}
          style={{ y: yValues[i] }}
        />
      ))}
    </div>
  );
}
