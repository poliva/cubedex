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
