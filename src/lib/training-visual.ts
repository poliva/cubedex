import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { patternCubeSize } from './cube-utils';
import { fixOrientation } from './scramble';

/** Keep case colors while expressing its progress in the device's exact frame. */
export function project2x2TrainingPattern(
  algorithm: string, caseStart: KPattern, sensor: KPattern, casePicture?: KPattern | null,
): KPattern {
  const startTransformation = caseStart.experimentalToTransformation();
  const sensorTransformation = sensor.experimentalToTransformation();
  if (!startTransformation || !sensorTransformation) throw new Error('Invalid 2×2 training pattern');
  const relative = startTransformation.invert().applyTransformation(sensorTransformation);
  const selectedCase = casePicture ?? caseStart.kpuzzle.defaultPattern().applyAlg(new Alg(algorithm).invert());
  // This replaces the physical starting stickers with the selected case's
  // stickers. Progress and whole-cube rotation are retained, without assuming
  // that a normalized device report describes the user's physical grip.
  return selectedCase.applyTransformation(relative);
}

/** A setup is ready only when the displayed turns solve it without a regrip. */
export function prepared2x2CasePicture(algorithm: string, start: KPattern, prepared: boolean): KPattern | null {
  if (!prepared || patternCubeSize(start) !== 2) return null;
  const solved = start.kpuzzle.defaultPattern();
  return fixOrientation(start.applyAlg(algorithm)).isIdentical(solved) ? start : null;
}

const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
  ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));
const turns = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(face => ['', "'", '2'].map(suffix => face + suffix));

/** Animate a turn and any frame change; a multi-turn batch can be set directly. */
export function get2x2VisualDelta(before: KPattern, after: KPattern): string | null {
  if (before.isIdentical(after)) return '';
  // Prefer a single layer turn over an opposite layer plus a cube rotation.
  for (const turn of turns) {
    if (before.applyMove(turn).isIdentical(after)) return turn;
  }
  for (const rotation of rotations.slice(1)) {
    if (before.applyAlg(rotation).isIdentical(after)) return rotation;
  }
  for (const turn of turns) {
    const turned = before.applyMove(turn);
    for (const rotation of rotations.slice(1)) {
      if (turned.applyAlg(rotation).isIdentical(after)) return `${turn} ${rotation}`;
    }
  }
  return null;
}
