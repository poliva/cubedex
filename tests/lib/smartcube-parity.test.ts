import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  composePerm,
  getSliceForPair,
  invertPerm,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
} from '../../src/lib/smartcube-parity';

describe('smartcube parity helpers', () => {
  it('inverts and composes permutations back to identity', () => {
    const rotated = updateSliceOrientation(IDENTITY, "M'");
    const inverse = invertPerm(rotated);

    expect(composePerm(rotated, inverse)).toEqual(IDENTITY);
    expect(composePerm(inverse, rotated)).toEqual(IDENTITY);
  });

  it('detects supported slice candidates and pairings', () => {
    expect(isSliceCandidate('R')).toBe(true);
    expect(isSliceCandidate('x')).toBe(false);
    expect(getSliceForPair("R'", 'L')).toBe("M'");
    expect(getSliceForPair('R', 'U')).toBeNull();
  });

  it('updates slice orientation and remaps player moves', () => {
    const rotated = updateSliceOrientation(IDENTITY, "M'");

    expect(rotated).not.toEqual(IDENTITY);
    expect(remapMoveForPlayer('F', rotated)).toBe('U');
    expect(remapMoveForPlayer("R'", rotated)).toBe("R'");
  });

  it('leaves unknown slice moves unchanged', () => {
    expect(updateSliceOrientation(IDENTITY, 'invalid')).toEqual(IDENTITY);
    expect(remapMoveForPlayer('hello', IDENTITY)).toBe('hello');
  });
});
