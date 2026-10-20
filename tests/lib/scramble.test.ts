import { describe, expect, it } from 'vitest';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { align2x2RecoveryPattern, fixOrientation, get2x2RecoveryMoves, getScrambleToSolution, patternToPlayerAlg } from '../../src/lib/scramble';

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
      expect(fixOrientation(target.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
      if (!initialAlg || /^[URF2' ]+$/.test(initialAlg)) {
        expect(target.applyAlg(algorithm).isIdentical(solved)).toBe(true);
      }
      expect(await getScrambleToSolution(algorithm, target)).toBe('');
    });
});


describe('2×2 sensor setup notation', () => {
  it.each(['', 'x y R U', "z R F' U2", "R2 U' B2' U2' R2' U' R2"])
    ('sets up Adj Adj from %s so its authored algorithm solves without a regrip', async initialAlg => {
      const solved = await solvedPattern(2);
      const algorithm = "R2 U' B2' U2' R2' U' R2";
      const start = solved.applyAlg(initialAlg);
      const setup = await getScrambleToSolution(algorithm, start);
      expect(setup.split(/\s+/).filter(Boolean).every(move => /^[URF](2|')?$/.test(move))).toBe(true);
      const prepared = start.applyAlg(setup);
      expect(fixOrientation(prepared.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
      expect(await getScrambleToSolution(algorithm, prepared)).toBe('');
    });

  it.each([
    "R U R' U'",
    "L D B' U2 R",
    "x y R U2 R' F2",
    "R2 F2 R2",
  ])('reaches the case for %s using only U/R/F, including intermediate recomputations', async (algorithm) => {
    const solved = await solvedPattern(2);
    let state = solved.applyAlg("R F' U2");
    const setup = await getScrambleToSolution(algorithm, state);
    const moves = setup.split(/\s+/).filter(Boolean);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => /^[URF](2|')?$/.test(move))).toBe(true);
    for (const move of moves) {
      state = state.applyMove(move);
      const remaining = await getScrambleToSolution(algorithm, state);
      expect(remaining.split(/\s+/).filter(Boolean).every((turn) => /^[URF](2|')?$/.test(turn))).toBe(true);
      expect(fixOrientation(state.applyAlg(`${remaining} ${algorithm}`)).isIdentical(solved)).toBe(true);
    }
    expect(fixOrientation(state.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
    expect(await getScrambleToSolution(algorithm, state)).toBe('');
  });
});

describe('2×2 physical recovery frame', () => {
  const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
    ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));

  it.each(rotations)('finishes in the exact training grip for sensor rotation "%s" and errors on every face', async rotation => {
    const target = (await solvedPattern(2)).applyAlg("L D B R U x y");
    for (const error of ['U', "R'", 'F2', 'D', "L'", 'B2']) {
      const sensor = target.applyAlg(`${error} ${rotation}`);
      const picture = align2x2RecoveryPattern(sensor, target);
      expect(fixOrientation(picture).isIdentical(fixOrientation(sensor))).toBe(true);
      const moves = await get2x2RecoveryMoves(picture, target);
      expect(moves.every(move => /^[URF]'?$/.test(move))).toBe(true);
      expect(picture.applyAlg(moves.join(' ')).isIdentical(target), error).toBe(true);
    }
  });

  it.each(['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2',
    'D', "D'", 'D2', 'L', "L'", 'L2', 'B', "B'", 'B2'])
    ('recovers a single %s error directly, even with a rotated target', async error => {
      const solved = await solvedPattern(2);
      const target = solved.applyAlg("R U F2 R' U2 F R2 x y");
      const current = target.applyMove(error);
      const moves = await get2x2RecoveryMoves(current, target.applyAlg('z x'));
      expect(moves.length).toBe(error.endsWith('2') ? 2 : 1);
      expect(moves.every(move => /^[URF]'?$/.test(move))).toBe(true);
      expect(fixOrientation(current.applyAlg(moves.join(' '))).isIdentical(fixOrientation(target))).toBe(true);
    });

  it('recovers pairs of mistaken face turns in at most two quarter turns', async () => {
    const target = (await solvedPattern(2)).applyAlg("F2 R U' R2 F U x");
    for (const first of ['U', "R'", 'F', "D'", 'L', "B'"]) {
      for (const second of ["U'", 'R', "F'", 'D', "L'", 'B']) {
        const current = target.applyAlg(`${first} ${second} y z`);
        const moves = await get2x2RecoveryMoves(current, target);
        expect(moves.length, `${first} ${second}`).toBeLessThanOrEqual(2);
        expect(fixOrientation(current.applyAlg(moves.join(' '))).isIdentical(fixOrientation(target))).toBe(true);
      }
    }
  });

  it('matches independently enumerated shortest distances around a scrambled target', async () => {
    const target = (await solvedPattern(2)).applyAlg("R U R' F2 U R2 F");
    const key = (pattern: typeof target) => JSON.stringify(pattern.patternData);
    const seen = new Set([key(target)]);
    let frontier = [target];
    for (let depth = 1; depth <= 3; depth++) {
      const next = [];
      for (const state of frontier) {
        for (const move of ['U', "U'", 'R', "R'", 'F', "F'"]) {
          const current = state.applyMove(move);
          if (seen.has(key(current))) continue;
          seen.add(key(current));
          next.push(current);
        }
      }
      // Sample each breadth-first layer, whose first visits establish minima.
      for (let i = 0; i < next.length; i += 7) {
        const moves = await get2x2RecoveryMoves(next[i], target);
        expect(moves.length).toBe(depth);
        expect(next[i].applyAlg(moves.join(' ')).isIdentical(target)).toBe(true);
      }
      frontier = next;
    }
  });

  it.each([
    "R U F R' U' F' R U F R' U' F' R U",
    "R2 U2 F2 U' R F' R2 U F2 R' U2 F",
  ])('finds a short direct path for a distant state: %s', async error => {
    const target = (await solvedPattern(2)).applyAlg("L U F2 D' R B2 x y");
    const current = target.applyAlg(error);
    const moves = await get2x2RecoveryMoves(current, target);
    expect(moves.length).toBeLessThanOrEqual(14);
    expect(fixOrientation(current.applyAlg(moves.join(' '))).isIdentical(fixOrientation(target))).toBe(true);
  });

  it('does not mistake opposite-axis codes for physical sticker states', async () => {
    const solved = await solvedPattern(2);
    // Real MY22 capture: physical D is reported U′; L/B are reported R/F.
    for (const [physical, reported] of [['D', "U'"], ['L U', 'R U'], ['B R', 'F R']]) {
      expect(fixOrientation(solved.applyAlg(physical)).isIdentical(fixOrientation(solved.applyAlg(reported)))).toBe(false);
    }
  });

  it.each(['R', 'x y R F2', "L U B D' F R2"])
    ('corrects an exact refreshed %s state using the frame shown in the picture', async alg => {
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
