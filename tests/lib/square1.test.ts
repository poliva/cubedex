import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import defaults from '../../src/data/defaultAlgs.json';
import setups from '../fixtures/square1-setups.json';
import { PUZZLES, puzzleLoader, puzzleVisualization } from '../../src/lib/puzzles';
import { expandNotation, getAlgorithmId, type SavedAlgorithms } from '../../src/lib/storage';
import { algorithmDisplayTokens, square1Tokens } from '../../src/lib/square1';
import { prepareTrainingAlgorithm } from '../../src/lib/auf';

const library: SavedAlgorithms = defaults;

describe('Square-1 notation and cases', () => {
  it('accepts compact and parenthesized pairs with stable case IDs', () => {
    const canonical = '(1, 0) / (-1, -1) / (0, 1)';
    expect(expandNotation('1,0/-1,-1/0,1', 'square1')).toBe(canonical);
    expect(expandNotation('(1,0)/(-1,-1)/(0,1)', 'square1')).toBe(canonical);
    expect(getAlgorithmId('1,0/-1,-1/0,1', 'square1')).toBe(getAlgorithmId(canonical, 'square1'));
    expect(algorithmDisplayTokens(canonical)).toEqual(['(1, 0)', '/', '(-1, -1)', '/', '(0, 1)']);
    expect(expandNotation('(1, x) /', 'square1')).toBe('(1, x) /');
  });

  it('keeps setups and expanded repetitions in native notation', async () => {
    const kpuzzle = await puzzleLoader('square1').kpuzzle();
    for (const raw of ['(1, -1) / (3, 0) /', '((1, 0) /)2', '/ (-3, 2) /']) {
      const inverse = new Alg(raw).invert();
      const formatted = square1Tokens(inverse).join(' ');
      expect(formatted).not.toContain('_SQ_');
      expect(formatted).not.toContain('_SLASH_');
      expect(kpuzzle.algToTransformation(formatted).isIdentical(kpuzzle.algToTransformation(inverse))).toBe(true);
    }
  });

  it('uses shape-changing 2D diagrams and leaves cube AUF disabled', async () => {
    expect(PUZZLES.square1.smartcube).toBe(false);
    for (const visualization of ['3D', 'PG3D', '2D', 'experimental-2D-LL']) {
      expect(puzzleVisualization('square1', visualization)).toBe('2D');
    }
    const moves = ['(1, 0)', '/', '(-1, 0)'];
    expect(await prepareTrainingAlgorithm(moves, 'square1:Cube Shape', true)).toMatchObject({
      displayAlgorithm: moves.join(' '), moves,
    });
  });

  it('matches the independent setups for every parity case', async () => {
    const kpuzzle = await puzzleLoader('square1').kpuzzle();
    expect(setups).toHaveLength(5);
    for (const reference of setups) {
      const entry = library[reference.category].flatMap(subset => subset.algorithms)
        .find(algorithm => algorithm.name === reference.name)!;
      const preview = kpuzzle.defaultPattern().applyAlg(new Alg(entry.algorithm).invert());
      expect(preview.isIdentical(kpuzzle.defaultPattern().applyAlg(reference.setup)), reference.name).toBe(true);
    }
  });
});
