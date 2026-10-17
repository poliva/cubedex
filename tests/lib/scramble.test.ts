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


describe('2×2 scramble helpers', () => {
  it.each(['', 'R', "R U F' L2 D B", 'x y'])
    ('reproduces the exact corner pattern for %s, including odd parity', async (alg) => {
      const solved = await solvedPattern(2);
      const pattern = solved.applyAlg(alg);
      const reproduced = solved.applyAlg(patternToPlayerAlg(pattern));
      expect(reproduced.isIdentical(pattern)).toBe(true);
      expect(fixOrientation(pattern.applyAlg('x y')).isIdentical(fixOrientation(pattern))).toBe(true);
    });

  it.each(['', 'R', "R U R' F D2"])
    ('scrambles from %s to the requested case and completes', async (initialAlg) => {
      const solved = await solvedPattern(2);
      const start = solved.applyAlg(initialAlg);
      const algorithm = "R U R' U'";
      const scramble = await getScrambleToSolution(algorithm, start);
      const target = start.applyAlg(scramble);
      expect(target.applyAlg(algorithm).isIdentical(solved)).toBe(true);
      expect(await getScrambleToSolution(algorithm, target)).toBe('');
    });
});
