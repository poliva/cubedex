import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import defaults from '../../src/data/defaultAlgs.json';
import { categoryPuzzle, puzzleLoader } from '../../src/lib/puzzles';
import { expandNotation, type SavedAlgorithms } from '../../src/lib/storage';
import { getCaseCards } from '../../src/lib/case-cards';

const library: SavedAlgorithms = defaults;
const expectedCaseCounts = {
  '2x2x2:OLL': 7,
  '2x2x2:PBL': 6,
  'pyraminx:Last Layer': 5,
  '4x4x4:OLL Parity': 3,
  '4x4x4:PLL Parity': 22,
  '5x5x5:Last Two Edges': 13,
  '5x5x5:Last Two Centers': 18,
  'megaminx:EO': 3,
  'megaminx:CO': 16,
  'megaminx:EP': 5,
  'megaminx:CP': 15,
  '2x2x2:CLL': 40,
  '2x2x2:EG1': 40,
  '2x2x2:EG2': 40,
  'pyraminx:Last 4 Edges': 37,
  'megaminx:OLL': 178,
  'megaminx:PLL': 151,
};

describe('Starter libraries', () => {
  it('includes every requested PLL parity and Megaminx subset', () => {
    expect(library['4x4x4:PLL Parity'].map(s => [s.subset, s.algorithms.length])).toEqual([
      ['Edge Swap', 5], ['Adj Corner Swap', 12], ['Diag Corner Swap', 5],
    ]);
    expect(library['megaminx:OLL']).toHaveLength(37);
    expect(library['megaminx:OLL'].flatMap(s => s.algorithms)).toHaveLength(178);
    expect(library['megaminx:PLL']).toHaveLength(26);
    expect(library['megaminx:PLL'].flatMap(s => s.algorithms)).toHaveLength(151);
    expect(library['megaminx:PLL'].find(s => s.subset === 'Skip')?.algorithms).toEqual([]);
  });

  it.each(Object.entries(expectedCaseCounts))('%s preserves every sourced move and checks preview compatibility', async (category, expectedCount) => {
    const puzzle = categoryPuzzle(category);
    const kpuzzle = await puzzleLoader(puzzle).kpuzzle();
    const subsets = library[category];
    const algorithms = subsets.flatMap((subset) => subset.algorithms);
    expect(algorithms).toHaveLength(expectedCount);
    const cards = getCaseCards(library, category, subsets.map((s) => s.subset));
    expect(cards).toHaveLength(algorithms.length);
    const unsupported = category === 'megaminx:OLL' ? ['28-', '28+', '35A+'] : [];
    expect(algorithms.filter(a => unsupported.includes(a.name)).map(a => a.name)).toEqual(unsupported);
    for (const [index, entry] of algorithms.entries()) {
      const raw = Alg.fromString(entry.algorithm);
      const normalized = Alg.fromString(expandNotation(entry.algorithm, puzzle));
      expect(Alg.fromString(cards[index].algorithm).isIdentical(normalized), entry.name).toBe(true);
      if (unsupported.includes(entry.name)) {
        // Keep the first sourced algorithm intact rather than silently replacing
        // an unsupported rotation with another algorithm or dropping the case.
        expect(normalized.isIdentical(raw), entry.name).toBe(true);
        expect(() => kpuzzle.defaultPattern().applyAlg(normalized.invert()), entry.name)
          .toThrow('Could not split X into face names.');
        continue;
      }
      const caseState = kpuzzle.defaultPattern().applyAlg(normalized.invert());
      expect(caseState.isIdentical(kpuzzle.defaultPattern().applyAlg(raw.invert())), entry.name).toBe(true);
      expect(caseState.applyAlg(normalized).isIdentical(kpuzzle.defaultPattern()), entry.name).toBe(true);
    }
  });

  it('keeps Megaminx and big cube moves distinct in normalization', () => {
    expect(expandNotation("BR' R2' U2'", 'megaminx')).toBe("BR' R2' U2'");
    expect(expandNotation("2R2 Uw2 3Rw'", '5x5x5')).toBe("2R2 Uw2 3Rw'");
  });
});
