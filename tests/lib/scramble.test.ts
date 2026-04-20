import { describe, expect, it } from 'vitest';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation, getScrambleToSolution, patternToPlayerAlg } from '../../src/lib/scramble';

const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('scramble helpers', () => {
  it('fixes center orientation for rotated patterns', async () => {
    const rotated = (await solvedPattern()).applyAlg('x y');
    const fixed = fixOrientation(rotated);

    expect(patternToFacelets(fixed)).toBe(SOLVED_FACELETS);
  });

  it('returns a player algorithm that reproduces the current pattern from solved', async () => {
    const pattern = (await solvedPattern()).applyAlg("R U R' F");
    const playerAlg = patternToPlayerAlg(pattern);
    const reproduced = (await solvedPattern()).applyAlg(playerAlg);

    expect(playerAlg.length).toBeGreaterThan(0);
    expect(patternToFacelets(reproduced)).toBe(patternToFacelets(fixOrientation(pattern)));
  });

  it('computes a scramble that leaves the target algorithm as the solve', async () => {
    const start = await solvedPattern();
    const algorithm = "R U R' U'";
    const scramble = await getScrambleToSolution(algorithm, start);
    const final = start.applyAlg(`${scramble} ${algorithm}`);

    expect(patternToFacelets(final)).toBe(patternToFacelets(start));
    expect(scramble.length).toBeGreaterThan(0);
  });
});
