import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getTrainingVisualDelta, projectTrainingPattern } from '../../src/lib/training-visual';

describe('2×2 case picture in the tracked frame', () => {
  it.each(['', "y'", 'y2', 'x y', "z' y"])
    ('retains the selected case and exact %s orientation instead of copying physical stickers', async rotation => {
      const solved = await solvedPattern(2);
      const algorithm = "R U R' U'";
      const selectedCase = solved.applyAlg(new Alg(algorithm).invert());
      const start = solved.applyAlg('R F2 U');
      const sensor = start.applyAlg(rotation);
      const picture = projectTrainingPattern(algorithm, start, sensor);
      expect(picture.isIdentical(selectedCase.applyAlg(rotation))).toBe(true);
      expect(picture.isIdentical(sensor)).toBe(false);
      expect(fixOrientation(picture).isIdentical(fixOrientation(selectedCase))).toBe(true);
    });

  it('tracks physical progress, opposite faces, a frame change and an undo without changing the case colors', async () => {
    const solved = await solvedPattern(2);
    const algorithm = "R2 U' B2' U2' R2' U' R2";
    const selectedCase = solved.applyAlg(new Alg(algorithm).invert());
    const start = solved.applyAlg('U F R2');
    let physical = start;
    let expected = selectedCase;
    for (const move of ['R', 'R', "U'", 'B', "B'", 'B2', 'U2', 'R2', "U'", 'R2']) {
      physical = physical.applyMove(move);
      expected = expected.applyMove(move);
      const picture = projectTrainingPattern(algorithm, start, physical.applyAlg("y'"));
      expect(picture.isIdentical(expected.applyAlg("y'")), move).toBe(true);
    }
    expect(expected.isIdentical(solved)).toBe(true);
  });

  it.each(['R', 'B', 'D', "U' y'", 'F2 x', "y'"])
    ('animates %s to the exact target pattern rather than an equivalent orientation', async moves => {
      const before = (await solvedPattern(2)).applyAlg('U R F');
      const after = before.applyAlg(moves);
      const delta = getTrainingVisualDelta(before, after);
      expect(delta).not.toBeNull();
      expect(before.applyAlg(delta!).isIdentical(after)).toBe(true);
      if (['R', 'B', 'D'].includes(moves)) expect(delta).toBe(moves);
    });
});
