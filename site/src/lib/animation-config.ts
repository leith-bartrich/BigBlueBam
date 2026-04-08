export const EFFECTS = {
  parallaxLift: { enabled: false, intensity: 0.6, shadowScale: 1 },
  hoverTilt: { enabled: true, maxDegrees: 3, perspective: 800 },
  heroBlobs: { enabled: true, intensity: 0.5, layers: 3 },
  revealScale: { enabled: true, from: 0.97 },
  sectionLines: { enabled: true, duration: 0.8, gradient: 'from-transparent via-primary-300 to-transparent' },
} as const;

export type EffectKey = keyof typeof EFFECTS;
