import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import defaults from '../../src/data/defaultAlgs.json';
import { categoryPuzzle, puzzleLoader } from '../../src/lib/puzzles';
import { expandNotation, type SavedAlgorithms } from '../../src/lib/storage';
import { getCaseCards } from '../../src/lib/case-cards';
import ftoSourceStates from '../fixtures/fto-source-states.json';
import sarahIntermediateCases from '../fixtures/skewb-sarah-intermediate.json';

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
  'pyraminx:Last 4 Edges': 35,
  'megaminx:OLL': 178,
  'megaminx:PLL': 151,
  '6x6x6:Parity': 3,
  '7x7x7:Parity': 2,
  "skewb:Sarah's Advanced": 131,
  "skewb:Sarah's Beginner": 8,
  "skewb:Sarah's Intermediate": 15,
  'fto:TCP': 18,
  'fto:L6X': 35,
  'fto:L3C': 5,
  'fto:1LP': 11,
  'square1:Cube Shape': 64,
  'square1:Parity': 5,
};

describe('Starter libraries', () => {
  it('bundles only the 64 Cube Shape cases and five Parity cases for Square-1', () => {
    expect(Object.keys(library).filter(category => category.startsWith('square1:')))
      .toEqual(['square1:Cube Shape', 'square1:Parity']);
    expect(library['square1:Cube Shape'].map(subset => [subset.subset, subset.algorithms.length])).toEqual([
      ['1 Slice', 1], ['2 Slices', 2], ['3 Slices', 8], ['4 Slices', 16],
      ['5 Slices', 24], ['6 Slices', 12], ['7 Slices', 1],
    ]);
  });

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
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
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

  it('preserves non-TCP FTO source corner and edge permutations through rotations and wide turns', async () => {
    const kpuzzle = await puzzleLoader('fto').kpuzzle();
    // TCP is checked against independent Twizzle setups in fto-algorithms.test.ts.
    expect(ftoSourceStates).toHaveLength(51);
    for (const source of ftoSourceStates) {
      const entry = library[source.category].flatMap(subset => subset.algorithms)
        .find(algorithm => algorithm.name === source.name)!;
      const pattern = kpuzzle.defaultPattern().applyAlg(entry.algorithm);
      expect(pattern.patternData.C4RNER.pieces, `${source.category}: ${source.name}`).toEqual(source.corners);
      expect(pattern.patternData.EDGES.pieces, `${source.category}: ${source.name}`).toEqual(source.edges);
    }
  });

  it('preserves a solved first side in all Sarah’s Advanced case previews', async () => {
    const loader = puzzleLoader('skewb');
    const kpuzzle = await loader.kpuzzle();
    const { stickers } = (await loader.pg!()).get3d();
    const stickerKey = (orbit: string, piece: number, orientation: number) => `${orbit}:${piece}:${orientation}`;
    const solvedFaces = new Map(stickers.map(sticker => [stickerKey(sticker.orbit, sticker.ord, sticker.ori), sticker.face]));
    for (const entry of library["skewb:Sarah's Advanced"].flatMap(subset => subset.algorithms)) {
      const pattern = kpuzzle.defaultPattern().applyAlg(Alg.fromString(entry.algorithm).invert());
      const faces = new Map<number, Set<number | undefined>>();
      for (const sticker of stickers) {
        const orbit = pattern.patternData[sticker.orbit];
        const orientations = kpuzzle.definition.orbits.find(orbit => orbit.orbitName === sticker.orbit)!.numOrientations;
        const orientation = (sticker.ori - orbit.orientation[sticker.ord] + orientations) % orientations;
        const color = solvedFaces.get(stickerKey(sticker.orbit, orbit.pieces[sticker.ord], orientation));
        const colors = faces.get(sticker.face) ?? new Set();
        colors.add(color);
        faces.set(sticker.face, colors);
      }
      expect([...faces.values()].some(colors => colors.size === 1 && !colors.has(undefined)), entry.name).toBe(true);
    }
  });

  it('includes each stage of Sarah’s Beginner and Intermediate methods', () => {
    expect(library["skewb:Sarah's Beginner"].map(subset => [subset.subset, subset.algorithms.length])).toEqual([
      ['Step 1 - First Side', 2],
      ['Step 2 - Remaining Corners', 2],
      ['Step 3 - U Center', 1],
      ['Step 4 - Remaining Centers', 3],
    ]);
    expect(library["skewb:Sarah's Intermediate"].map(subset => [subset.subset, subset.algorithms.length])).toEqual([
      ['Step 1 - First Side', 2],
      ['Step 2 - Category 1', 3],
      ['Step 2 - Category 2', 4],
      ['Step 2 - Category 3', 3],
      ['Step 3 - Remaining Centers', 3],
    ]);
  });

  it('matches all ten Intermediate opposite-side diagrams, including the complete reduction cases', async () => {
    const loader = puzzleLoader('skewb');
    const kpuzzle = await loader.kpuzzle();
    const { stickers } = (await loader.pg!()).get3d();
    // Physical face labels in the diagrams' yellow-up, green-front frame.
    const faceNames = ['F', 'U', 'R', 'B', 'D', 'L'];
    const solvedColors = new Map(stickers.map(sticker => [`${sticker.orbit}:${sticker.ord}:${sticker.ori}`, faceNames[sticker.face]]));
    const cornerNames = Array.from({ length: 8 }, (_, piece) => stickers
      .filter(sticker => sticker.orbit === 'CORNERS' && sticker.ord === piece)
      .map(sticker => faceNames[sticker.face]).sort().join(''));
    const algorithms = library["skewb:Sarah's Intermediate"]
      .filter(subset => subset.subset.startsWith('Step 2'))
      .flatMap(subset => subset.algorithms);
    expect(sarahIntermediateCases).toHaveLength(10);
    for (const source of sarahIntermediateCases) {
      const algorithm = algorithms.find(entry => entry.name === source.name)!;
      const pattern = kpuzzle.defaultPattern().applyAlg(Alg.fromString(algorithm.algorithm).invert());
      const yellowStickers = new Set<string>();
      for (const sticker of stickers) {
        const orbit = pattern.patternData[sticker.orbit];
        const orientations = kpuzzle.definition.orbits.find(orbit => orbit.orbitName === sticker.orbit)!.numOrientations;
        const orientation = (sticker.ori - orbit.orientation[sticker.ord] + orientations) % orientations;
        const color = solvedColors.get(`${sticker.orbit}:${orbit.pieces[sticker.ord]}:${orientation}`);
        if (faceNames[sticker.face] === 'D') {
          expect(color, `${source.name}: first side`).toBe('D');
        } else if (color === 'U') {
          yellowStickers.add(`${faceNames[sticker.face]}:${sticker.orbit === 'CENTERS' ? 'center' : cornerNames[sticker.ord]}`);
        }
      }
      expect([...yellowStickers].sort(), source.name).toEqual(source.yellowStickers);
    }
  });
});
