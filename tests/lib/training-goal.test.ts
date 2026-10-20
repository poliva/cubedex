import { describe, expect, it } from 'vitest';
import { solvedPattern } from '../../src/lib/cube-utils';
import { createCaseGoalMatcher } from '../../src/lib/training-goal';

const sune = "R U R' U R U2 R'";
const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
const uPerm = "R U' R U R U R U' R' U' R2";
const edgeFlip = "M' U M' U M' U2 M U M U M U2";

describe('partial training goals', () => {
  it('accepts any F2L last layer but preserves the cross and every slot', async () => {
    const solved = await solvedPattern();
    const matches = createCaseGoalMatcher(solved, 'F2L')!;
    for (const lastLayer of ['U', sune, tPerm]) {
      expect(matches(solved.applyAlg(lastLayer)), lastLayer).toBe(true);
    }
    for (const broken of ['R', 'D', "R U R'", 'M2']) {
      expect(matches(solved.applyAlg(broken)), broken).toBe(false);
    }
  });

  it('ignores OLL permutation and AUF but requires orientation and intact F2L', async () => {
    const solved = await solvedPattern();
    const matches = createCaseGoalMatcher(solved, 'OLL')!;
    expect(matches(solved.applyAlg(`${tPerm} U`))).toBe(true);
    for (const broken of [sune, 'D', 'R2', 'M2']) {
      expect(matches(solved.applyAlg(broken)), broken).toBe(false);
    }
  });

  it('checks only edge orientation for the first look of 2-look OLL', async () => {
    const solved = await solvedPattern();
    const result = solved.applyAlg(sune);
    expect(createCaseGoalMatcher(solved, '2-Look OLL', 'Edges')!(result)).toBe(true);
    expect(createCaseGoalMatcher(solved, '2-Look OLL', 'Corners')!(result)).toBe(false);
    expect(createCaseGoalMatcher(solved, '2-Look OLL', 'Edges')!(solved.applyAlg("F R U R' U' F'"))).toBe(false);
  });

  it.each(['F2L', 'OLL'])('projects %s progress from arbitrary stickers and rotated device frames', async category => {
    const solved = await solvedPattern();
    const endpoint = solved.applyAlg('D R B x');
    const matches = createCaseGoalMatcher(endpoint, category)!;
    expect(matches(endpoint.applyAlg(`${tPerm} U y`))).toBe(true);
    expect(matches(endpoint.applyAlg('R y'))).toBe(false);
    expect(matches(endpoint.applyAlg(sune))).toBe(category === 'F2L');
  });

  it('allows Ortega OLL permutation while keeping both faces oriented', async () => {
    const solved = await solvedPattern(2);
    const matches = createCaseGoalMatcher(solved, '2x2x2:OLL')!;
    expect(matches(solved.applyAlg(`${tPerm} U y`))).toBe(true);
    expect(matches(solved.applyAlg(sune))).toBe(false);
    expect(matches(solved.applyAlg('R2'))).toBe(false);
  });

  const additionalGoals: Array<{ category: string; subset?: string; accepted: string[]; rejected: string[] }> = [
    { category: 'WVLS', accepted: [tPerm, `${tPerm} U`], rejected: [sune, edgeFlip, 'D', 'M2'] },
    ...['ZBLS', 'VHLS'].map(category => ({
      category, accepted: [sune, tPerm, 'U'], rejected: [edgeFlip, 'D', 'R', 'M2'],
    })),
    ...['COLL', 'OLLCP', '2-Look PLL'].map(category => ({
      category, subset: 'Corners', accepted: [uPerm, `${uPerm} U`], rejected: [tPerm, sune, edgeFlip, 'D', 'M2'],
    })),
    { category: 'CMLL', accepted: ['M', 'M2', 'M U M U M U M', uPerm, `${uPerm} U`], rejected: [tPerm, sune, 'R', 'D', 'E2'] },
    { category: 'L6E-EO', accepted: ['M2', "M U2 M'", uPerm, `${uPerm} U`], rejected: ['M', edgeFlip, tPerm, sune, 'R', 'D'] },
    { category: 'L6E-EOLR', accepted: ['M2', "U M2 U'", "U' M2 U", "U M2 U' U2"], rejected: ['M', edgeFlip, uPerm, tPerm, 'R', 'D', "U M2 U' M2"] },
  ];

  it.each(additionalGoals)('accepts only completed $category goals while preserving earlier stages', async ({ category, subset, accepted, rejected }) => {
    const solved = await solvedPattern();
    const matches = createCaseGoalMatcher(solved, category, subset)!;
    expect(matches).not.toBeNull();
    for (const ending of accepted) {
      expect(matches(solved.applyAlg(ending)), ending).toBe(true);
    }
    for (const ending of rejected) {
      expect(matches(solved.applyAlg(ending)), ending).toBe(false);
    }
  });

  it.each(additionalGoals)('projects $category goals from arbitrary physical stickers in every device orientation', async ({ category, subset, accepted, rejected }) => {
    const solved = await solvedPattern();
    const endpoint = solved.applyAlg('D R B x');
    const matches = createCaseGoalMatcher(endpoint, category, subset)!;
    for (const x of ['', 'x', 'x2', "x'", 'z', "z'"]) {
      for (const y of ['', 'y', 'y2', "y'"]) {
        for (const [endings, expected] of [[accepted, true], [rejected, false]] as const) {
          for (const ending of endings) {
            expect(matches(endpoint.applyAlg(`${ending} ${x} ${y}`)), `${ending} ${x} ${y}`).toBe(expected);
          }
        }
      }
    }
  });

  it('requires both EOLR edges to be prepared or solved relative to the corners', async () => {
    const solved = await solvedPattern();
    const matches = createCaseGoalMatcher(solved, 'L6E-EOLR')!;
    // EO alone and a single prepared LR edge are insufficient.
    expect(matches(solved.applyAlg(`${uPerm} M2`))).toBe(false);
    // Both LR edges on top must also line up with the corners after AUF.
    expect(matches(solved.applyAlg('M2 U M2 U2 M2 U M2'))).toBe(false);
  });

  it('keeps exact endpoints for full-solve and unknown categories', async () => {
    const solved = await solvedPattern();
    for (const category of ['PLL', 'ZBLL', 'Custom']) {
      expect(createCaseGoalMatcher(solved, category)).toBeNull();
    }
    expect(createCaseGoalMatcher(solved, '2-Look PLL', 'Edges')).toBeNull();
    for (const category of ['PBL', 'CLL', 'EG1', 'EG2', 'COLL', 'CMLL', 'F2L']) {
      expect(createCaseGoalMatcher(await solvedPattern(2), `2x2x2:${category}`)).toBeNull();
    }
  });
});
