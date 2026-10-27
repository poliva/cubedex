import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import defaults from '../../src/data/defaultAlgs.json';
import reference from '../fixtures/square1-reference.json';
import { puzzleLoader } from '../../src/lib/puzzles';
import type { SavedAlgorithms } from '../../src/lib/storage';

const library: SavedAlgorithms = defaults;
// Each corner occupies two adjacent 30-degree wedges; each edge occupies one.
// Bottom wedges run opposite to the top in the puzzle model's coordinate frame.
const physicalPieces = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 15, 14, 14, 13, 12, 12, 11, 10, 10, 9, 8, 8];
const units = (pattern: KPattern) => pattern.patternData.WEDGES.pieces.map(wedge => physicalPieces[wedge]);
const rotateKey = (bits: string) => Array.from({ length: 12 }, (_, i) => bits.slice(i) + bits.slice(0, i)).sort()[0];
const layerKey = (pieces: number[]) => rotateKey(pieces.map((piece, i) => piece === pieces[(i + 11) % 12] ? '0' : '1').join(''));
const reverse = (bits: string) => [...bits].reverse().join('');
const familyKey = (top: string, bottom: string) => [
  [rotateKey(top), rotateKey(bottom)].sort().join('/'),
  [rotateKey(reverse(top)), rotateKey(reverse(bottom))].sort().join('/'),
].sort()[0];

function applyLegal(pattern: KPattern, algorithm: Alg): KPattern | null {
  for (const move of algorithm.experimentalLeafMoves()) {
    if (move.family === '_SLASH_') {
      const pieces = units(pattern);
      if ([[0, 11], [5, 6], [12, 23], [17, 18]].some(([a, b]) => pieces[a] === pieces[b])) return null;
    }
    pattern = pattern.applyMove(move);
  }
  return pattern;
}

describe('Square-1 independent case checks', () => {
  it('keeps every setup and solution physically legal, without splitting corners', async () => {
    const solved = (await puzzleLoader('square1').kpuzzle()).defaultPattern();
    let count = 0;
    for (const [category, subsets] of Object.entries(library).filter(([category]) => category.startsWith('square1:'))) {
      for (const entry of subsets.flatMap(subset => subset.algorithms)) {
        const label = `${category}: ${entry.name}`;
        const algorithm = new Alg(entry.algorithm);
        const setup = applyLegal(solved, algorithm.invert());
        expect(setup, `${label}: setup cuts through a corner`).not.toBeNull();
        const result = applyLegal(setup!, algorithm);
        expect(result?.isIdentical(solved), `${label}: solution cuts through a corner`).toBe(true);
        count += 1;
      }
    }
    expect(count).toBe(69);
  });

  it('matches all 64 named shape pairs, with one algorithm per shape family', async () => {
    const solved = (await puzzleLoader('square1').kpuzzle()).defaultPattern();
    const entries = library['square1:Cube Shape'].flatMap(subset => subset.algorithms);
    expect(entries).toHaveLength(64);
    expect(reference.cases).toHaveLength(64);
    const expectedFamilies = new Set(reference.cases.map(({ top, bottom }) => familyKey(top, bottom)));
    expect(expectedFamilies.size).toBe(64);
    const actualFamilies = new Set<string>();
    for (const entry of entries) {
      const expected = reference.cases.find(shape => shape.name === entry.name)!;
      const pieces = units(solved.applyAlg(new Alg(entry.algorithm).invert()));
      const top = layerKey(pieces.slice(0, 12)), bottom = layerKey(pieces.slice(12).reverse());
      expect({ top, bottom }, entry.name).toEqual({ top: expected.top, bottom: expected.bottom });
      actualFamilies.add(familyKey(top, bottom));
    }
    expect(actualFamilies).toEqual(expectedFamilies);
  });

  it('solves all five independent parity cases up to initial and final layer adjustments', async () => {
    const solved = (await puzzleLoader('square1').kpuzzle()).defaultPattern();
    const amounts = Array.from({ length: 12 }, (_, i) => i - 5);
    const key = (pattern: KPattern) => JSON.stringify(pattern.patternData);
    const solvedFrames = new Set(amounts.flatMap(top => amounts.map(bottom => key(solved.applyAlg(`(${top}, ${bottom})`)))));
    expect(reference.parity).toHaveLength(5);
    for (const { name, setup } of reference.parity) {
      const pattern = applyLegal(solved, new Alg(setup))!;
      expect(pattern, name).not.toBeNull();
      const algorithm = new Alg(library['square1:Parity'].flatMap(subset => subset.algorithms)
        .find(entry => entry.name === name)!.algorithm);
      const matches = amounts.some(top => amounts.some(bottom => {
        const result = applyLegal(pattern.applyAlg(`(${top}, ${bottom})`), algorithm);
        return result !== null && solvedFrames.has(key(result));
      }));
      expect(matches, name).toBe(true);
    }
  });
});
