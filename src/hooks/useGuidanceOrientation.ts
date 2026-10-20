import { useEffect, useMemo, useState } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { SmartcubeConnectionState } from './useSmartcubeConnection';
import { guidanceFrameRotation, guidanceGripRotation, WRONG_GRIP_ANGLE, type GripRotation } from '../lib/cube-orientation';

export type GuidanceOrientation = { misaligned: boolean; rotation: GripRotation } | null;

export function useGuidanceOrientation(smartcube: SmartcubeConnectionState, sensor: KPattern | null, picture: KPattern | null) {
  const frame = useMemo(() => sensor && picture ? guidanceFrameRotation(sensor, picture) : null, [sensor, picture]);
  const frameKey = frame?.toArray().map(value => Math.round(value * 1e8)).join(',');
  const [orientation, setOrientation] = useState<GuidanceOrientation>(null);
  const enabled = smartcube.connected && smartcube.gyroSupported && Boolean(frame);

  useEffect(() => {
    setOrientation(null);
    if (!enabled || !frame) return;
    let warning = false;
    let wrongSince: number | null = null;
    const sample = () => {
      const gyro = smartcube.cubeQuaternionRef.current;
      const rotation = gyro && guidanceGripRotation(gyro, frame);
      if (!rotation) {
        warning = false;
        wrongSince = null;
        setOrientation(null);
        return;
      }
      // A wrong quarter-turn grip should be clear before interrupting guidance.
      // Allow normal tilts and brief regrips, with a wider release threshold
      // so correcting the grip does not require matching the picture exactly.
      if (rotation.angle <= 40) {
        warning = false;
        wrongSince = null;
      } else if (rotation.angle >= WRONG_GRIP_ANGLE) {
        wrongSince ??= performance.now();
        if (performance.now() - wrongSince >= 600) warning = true;
      } else if (!warning) wrongSince = null;
      setOrientation({ misaligned: warning, rotation });
    };
    sample();
    const timer = window.setInterval(sample, 100);
    return () => window.clearInterval(timer);
  // Sticker snapshots change at each turn; the grip's rotation stays the same.
  // Depend on its value to preserve the warning and debounce while scrambling.
  }, [enabled, frameKey, smartcube.cubeQuaternionRef]);

  return enabled ? orientation : null;
}
