import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { EFFECTS } from '@/lib/animation-config';

interface GyroTilt {
  rotateX: number;
  rotateY: number;
}

const ZERO: GyroTilt = { rotateX: 0, rotateY: 0 };
const THROTTLE_MS = 1000 / 30; // ~30 fps

export function useGyroTilt(): GyroTilt {
  const prefersReduced = useReducedMotion();
  const [tilt, setTilt] = useState<GyroTilt>(ZERO);
  const lastUpdate = useRef(0);

  const { enabled, intensity } = EFFECTS.parallaxLift;
  const maxDegrees = 4 * intensity;

  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const isActive = enabled && !prefersReduced && isTouch;

  useEffect(() => {
    if (!isActive) return;

    let permissionGranted = true;

    const requestPermission = async () => {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE.requestPermission === 'function') {
        try {
          const result = await DOE.requestPermission();
          if (result !== 'granted') {
            permissionGranted = false;
          }
        } catch {
          permissionGranted = false;
        }
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!permissionGranted) return;

      const now = performance.now();
      if (now - lastUpdate.current < THROTTLE_MS) return;
      lastUpdate.current = now;

      const beta = event.beta ?? 0; // front-back, -180 to 180
      const gamma = event.gamma ?? 0; // left-right, -90 to 90

      // Center beta around 45° (typical phone holding angle)
      const centeredBeta = beta - 45;

      // Clamp and normalize to [-1, 1]
      const normalizedX = Math.max(-1, Math.min(1, centeredBeta / 45));
      const normalizedY = Math.max(-1, Math.min(1, gamma / 45));

      setTilt({
        rotateX: normalizedX * maxDegrees,
        rotateY: normalizedY * maxDegrees,
      });
    };

    requestPermission().then(() => {
      window.addEventListener('deviceorientation', handleOrientation);
    });

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isActive, maxDegrees]);

  if (!isActive) return ZERO;
  return tilt;
}
