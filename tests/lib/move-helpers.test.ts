import { describe, expect, it } from 'vitest';
import {
  getInverseMove,
  getOppositeMove,
  sanitizeMove,
  trailingWholeCubeRotationMoveCount,
} from '../../src/lib/move-helpers';

describe('move helpers', () => {
  it('counts trailing whole-cube rotations', () => {
    expect(trailingWholeCubeRotationMoveCount(['R', '(x)', "y'"])).toBe(2);
    expect(trailingWholeCubeRotationMoveCount(['R', 'U'])).toBe(0);
  });

  it('returns inverse moves when known', () => {
    expect(getInverseMove('R')).toBe("R'");
    expect(getInverseMove("x'")).toBe('x');
    expect(getInverseMove('R2')).toBe('R2');
  });

  it('returns opposite face moves when known', () => {
    expect(getOppositeMove("U'")).toBe("D'");
    expect(getOppositeMove('L')).toBe('R');
    expect(getOppositeMove('M')).toBe('M');
  });

  it('sanitizes wrapper punctuation around moves', () => {
    expect(sanitizeMove(' (R2) ')).toBe('R2');
  });
});
