import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { categoryId, categoryName, categoryPuzzle, isPuzzleId, puzzleIds, puzzleLoader } from '../../src/lib/puzzles';
import { createScopeId, expandNotation, getAlgorithmId } from '../../src/lib/storage';
import { prepareTrainingAlgorithm } from '../../src/lib/auf';
import { fixOrientation } from '../../src/lib/scramble';
import defaults from '../../src/data/defaultAlgs.json';

describe('puzzle-scoped libraries', () => {
  it('preserves legacy IDs and separates identical category names on different puzzles', () => {
    expect(categoryId('3x3x3', 'OLL')).toBe('OLL');
    expect(categoryPuzzle('OLL')).toBe('3x3x3');
    expect(categoryName('2x2x2:OLL')).toBe('OLL');
    expect(categoryPuzzle('2x2x2:OLL')).toBe('2x2x2');
    const algId = getAlgorithmId("R U R'");
    expect(createScopeId('OLL', 'Corners', algId))
      .not.toBe(createScopeId('2x2x2:OLL', 'Corners', algId));
  });

  it('offers Square-1 and retains its namespace for existing backups', () => {
    expect(puzzleIds).toContain('square1');
    expect(isPuzzleId('square1')).toBe(true);
    expect(categoryPuzzle('square1:Custom')).toBe('square1');
    expect(expandNotation('(1, 0) /')).toBe('(1, 0) /');
  });

  it('does not add AUF moves to Pyraminx, even if the saved toggle is on', async () => {
    const prepared = await prepareTrainingAlgorithm(['R', 'U', "R'", "U'", 'u'], 'pyraminx:Custom', true);
    expect(prepared.displayAlgorithm).toBe("R U R' U' u");
    const kpuzzle = await puzzleLoader('pyraminx').kpuzzle();
    expect(() => kpuzzle.defaultPattern().applyAlg(prepared.displayAlgorithm)).not.toThrow();
  });

  it('bundles all seven distinct 2×2 OLL orientations with a solved bottom layer', async () => {
    const kpuzzle = await puzzleLoader('2x2x2').kpuzzle();
    const orientationClasses = new Set<string>();
    for (const alg of defaults['2x2x2:OLL'][0].algorithms) {
      const pattern = fixOrientation(kpuzzle.defaultPattern().applyAlg(Alg.fromString(expandNotation(alg.algorithm)).invert()));
      expect(pattern.patternData.CORNERS.orientation.slice(4)).toEqual([0, 0, 0, 0]);
      expect(pattern.patternData.CORNERS.pieces.slice(4)).toEqual([4, 5, 6, 7]);
      const orientations = pattern.patternData.CORNERS.orientation.slice(0, 4);
      orientationClasses.add(orientations.map((_, i) => [...orientations.slice(i), ...orientations.slice(0, i)].join('')).sort()[0]);
    }
    expect(orientationClasses.size).toBe(7);
  });
});
