import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
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

  it.each(['', 'R', "R U R' F D2", 'x y', "F U2 R' F2 U R2"])
    ('scrambles from %s to the requested case and completes', async (initialAlg) => {
      const solved = await solvedPattern(2);
      const start = solved.applyAlg(initialAlg);
      const algorithm = "R U R' U'";
      const scramble = await getScrambleToSolution(algorithm, start);
      const target = start.applyAlg(scramble);
      expect(scramble.split(/\s+/).filter(Boolean).every((move) => /^[URF](2|')?$/.test(move))).toBe(true);
      const expected = solved.applyAlg("U R U' R'");
      expect(fixOrientation(target).isIdentical(fixOrientation(expected))).toBe(true);
      if (!initialAlg || /^[URF2' ]+$/.test(initialAlg)) {
        expect(target.applyAlg(algorithm).isIdentical(solved)).toBe(true);
      }
      expect(await getScrambleToSolution(algorithm, target)).toBe('');
    });
});


describe('2×2 sensor setup notation', () => {
  it.each([
    "R U R' U'",
    "L D B' U2 R",
    "x y R U2 R' F2",
    "R2 F2 R2",
  ])('reaches the case for %s using only U/R/F, including intermediate recomputations', async (algorithm) => {
    const solved = await solvedPattern(2);
    const expected = solved.applyAlg(Alg.fromString(algorithm).invert());
    let state = solved.applyAlg("R F' U2");
    const setup = await getScrambleToSolution(algorithm, state);
    const moves = setup.split(/\s+/).filter(Boolean);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => /^[URF](2|')?$/.test(move))).toBe(true);
    for (const move of moves) {
      state = state.applyMove(move);
      const remaining = await getScrambleToSolution(algorithm, state);
      expect(remaining.split(/\s+/).filter(Boolean).every((turn) => /^[URF](2|')?$/.test(turn))).toBe(true);
      expect(fixOrientation(state.applyAlg(remaining)).isIdentical(fixOrientation(expected))).toBe(true);
    }
    expect(fixOrientation(state).isIdentical(fixOrientation(expected))).toBe(true);
    expect(await getScrambleToSolution(algorithm, state)).toBe('');
  });
});

describe('2×2 physical recovery frame', () => {
  it('does not mistake opposite-axis codes for physical sticker states', async () => {
    const solved = await solvedPattern(2);
    // Real MY22 capture: physical D is reported U′; L/B are reported R/F.
    for (const [physical, reported] of [['D', "U'"], ['L U', 'R U'], ['B R', 'F R']]) {
      expect(fixOrientation(solved.applyAlg(physical)).isIdentical(fixOrientation(solved.applyAlg(reported)))).toBe(false);
    }
  });

  it.each(['R', 'x y R F2', "L U B D' F R2"])
    ('corrects an exact refreshed %s state using the frame shown in the picture', async alg => {
      const { get2x2RecoveryMoves } = await import('../../src/lib/scramble');
      const solved = await solvedPattern(2);
      const current = solved.applyAlg(alg);
      const target = solved.applyAlg("R U F R'");
      const moves = await get2x2RecoveryMoves(current, target);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every(move => /^[URF](2|')?$/.test(move))).toBe(true);
      expect(solved.applyAlg(patternToPlayerAlg(current)).isIdentical(current)).toBe(true);
      expect(fixOrientation(current.applyAlg(moves.join(' '))).isIdentical(fixOrientation(target))).toBe(true);
      expect(await get2x2RecoveryMoves(target.applyAlg('z x'), target)).toEqual([]);
    });
});
