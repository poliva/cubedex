import { describe, expect, it } from 'vitest';
import { solvedPattern } from '../../src/lib/cube-utils';
import { alignForGuidance, fixOrientation, getGuidanceMoves, patternToGuidanceAlg } from '../../src/lib/scramble';

const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
  ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));

describe('3×3 guidance in the continuation grip', () => {
  it.each(rotations)('renders exact stickers and corrects errors with sensor rotation "%s"', async rotation => {
    const solved = await solvedPattern(3);
    const target = solved.applyAlg("L D B R U x y");
    const sensor = target.applyAlg(`F R2 U' ${rotation}`);
    const picture = alignForGuidance(sensor, target);
    expect(fixOrientation(picture).isIdentical(fixOrientation(sensor))).toBe(true);
    expect(solved.applyAlg(patternToGuidanceAlg(picture)).isIdentical(picture)).toBe(true);
    const corrections = await getGuidanceMoves(picture, target);
    expect(corrections.every(move => /^[URFDLB](2|')?$/.test(move))).toBe(true);
    expect(picture.applyAlg(corrections.join(' ')).isIdentical(target)).toBe(true);
  });

  it.each(["R U R' U'", "x R U2 R' x'", "M2 U M2 U2 M2 U M2", "r U R' U' r' F R F'"])
    ('sets up an arbitrary %s target without a solved-cube detour', async algorithm => {
      const solved = await solvedPattern(3);
      const target = solved.applyAlg(algorithm);
      const current = alignForGuidance(solved.applyAlg("L D' B2 R F U x"), target);
      const corrections = await getGuidanceMoves(current, target);
      expect(current.applyAlg(corrections.join(' ')).isIdentical(target)).toBe(true);
      expect(solved.applyAlg(patternToGuidanceAlg(target)).isIdentical(target)).toBe(true);
      expect(await getGuidanceMoves(target.applyAlg('x y'), target)).toEqual([]);
    });
});
