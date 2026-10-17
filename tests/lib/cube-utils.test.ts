import { describe, expect, it } from 'vitest';
import { faceletsToPattern, patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';

const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('cube utils', () => {
  it('returns the solved facelets for the solved pattern', async () => {
    const pattern = await solvedPattern();

    expect(patternToFacelets(pattern)).toBe(SOLVED_FACELETS);
  });

  it('round-trips solved facelets into a pattern', async () => {
    const pattern = await faceletsToPattern(SOLVED_FACELETS);

    expect(patternToFacelets(pattern)).toBe(SOLVED_FACELETS);
  });

  it('round-trips non-solved patterns through facelets', async () => {
    const pattern = (await solvedPattern()).applyAlg("R U R'");
    const facelets = patternToFacelets(pattern);
    const roundTripped = await faceletsToPattern(facelets);

    expect(patternToFacelets(roundTripped)).toBe(facelets);
  });
});


describe('2×2 cube utils', () => {
  it('uses a corners-only puzzle and 24 solved facelets', async () => {
    const pattern = await solvedPattern(2);
    expect(Object.keys(pattern.patternData)).toEqual(['CORNERS']);
    expect(patternToFacelets(pattern)).toBe('UUUURRRRFFFFDDDDLLLLBBBB');
  });

  it.each(['R', 'U', 'F', 'D', 'L', 'B', "R U R' U' F2 D L B'", 'x y z'])
    ('round-trips %s and agrees with 3×3 corner facelets', async (alg) => {
      const pattern = (await solvedPattern(2)).applyAlg(alg);
      const facelets = patternToFacelets(pattern);
      const restored = await faceletsToPattern(facelets);
      expect(restored.isIdentical(pattern)).toBe(true);
      if (!/[xyz]/.test(alg)) {
        const full = patternToFacelets((await solvedPattern()).applyAlg(alg));
        const corners = full.match(/.{9}/g)!.map((face) =>
          [0, 2, 6, 8].map((i) => face[i]).join('')).join('');
        expect(facelets).toBe(corners);
      }
    });

  it.each(['', 'U'.repeat(24), 'UUUURRRRFFFFDDDDLLLLBBBX', 'UUUURRRRFFFFDDDDLLLLBBBBU'])
    ('rejects invalid facelets %s', async (facelets) => {
      await expect(faceletsToPattern(facelets)).rejects.toThrow();
    });
});
