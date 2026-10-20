import { Quaternion, Vector3 } from 'three';
import type { KPattern } from 'cubing/kpuzzle';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

// Connect and Reset Gyro establish white up / green front. The display tilt
// belongs to the renderer, not to the physical grip we compare below.
export const HOME_ORIENTATION = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 15 * Math.PI / 180)
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -5 * Math.PI / 180));

const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
  ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));
const axes = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

/** Rotation of the device's sticker frame into the exact pictured grip. */
export function guidanceFrameRotation(sensor: KPattern, picture: KPattern): Quaternion | null {
  if (sensor.kpuzzle !== picture.kpuzzle) return null;
  for (const rotation of rotations) {
    if (!sensor.applyAlg(rotation).isIdentical(picture)) continue;
    const result = new Quaternion();
    for (const move of rotation.split(/\s+/).filter(Boolean)) {
      const axis = axes[move[0] as keyof typeof axes];
      const amount = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
      // Cube notation is clockwise viewed from the positive face. Each
      // rotation acts in the fixed sticker frame, so compose on the left.
      result.premultiply(new Quaternion().setFromAxisAngle(axis, -amount * Math.PI / 2));
    }
    return result;
  }
  return null; // A layer turn is still being reconciled with the next picture.
}

export type GripRotation = {
  angle: number;
  axis: 'x' | 'y' | 'z';
  direction: 1 | -1;
  instruction: string;
  visualQuaternion: SmartcubeQuaternion;
};

/** Pose of the pictured stickers in the user's current physical grip. */
export function guidanceGripRotation(gyro: SmartcubeQuaternion, frame: Quaternion): GripRotation | null {
  if (![gyro.x, gyro.y, gyro.z, gyro.w].every(Number.isFinite)) return null;
  const pose = new Quaternion(gyro.x, gyro.y, gyro.z, gyro.w);
  if (pose.lengthSq() < 1e-6) return null;
  pose.normalize().premultiply(HOME_ORIENTATION.clone().invert());
  const visual = pose.multiply(frame.clone().invert()).normalize();
  const correction = visual.clone().invert();
  // q and -q describe the same orientation. Choose the shorter rotation.
  if (correction.w < 0) correction.set(-correction.x, -correction.y, -correction.z, -correction.w);
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, correction.w))) * 180 / Math.PI;
  const axis = (['x', 'y', 'z'] as const).reduce((a, b) => Math.abs(correction[a]) >= Math.abs(correction[b]) ? a : b);
  const direction = correction[axis] >= 0 ? 1 : -1;
  const instruction = axis === 'y'
    ? angle > 150 && Math.abs(correction.y) > .9
      ? 'Turn the whole cube around.'
      : `Turn the front of the cube to your ${direction > 0 ? 'right' : 'left'}.`
    : axis === 'x'
      ? `Tilt the top of the cube ${direction > 0 ? 'toward you' : 'away from you'}.`
      : `Roll the top of the cube to your ${direction > 0 ? 'left' : 'right'}.`;
  return { angle, axis, direction, instruction,
    visualQuaternion: { x: visual.x, y: visual.y, z: visual.z, w: visual.w } };
}
