import { describe, expect, it } from 'vitest';
import type { KPattern } from 'cubing/kpuzzle';
import defaults from '../../src/data/defaultAlgs.json';
import references from '../fixtures/fto-tcp-reference.json';
import { getCaseCards } from '../../src/lib/case-cards';
import { puzzleLoader } from '../../src/lib/puzzles';

describe('FTO TCP reference cases', () => {
  it('solves all 18 document setups, including centers and sticker orientations', async () => {
    const loader = puzzleLoader('fto');
    const kpuzzle = await loader.kpuzzle();
    const { stickers } = (await loader.pg!()).get3d();
    const stickerKey = (orbit: string, piece: number, orientation: number) => `${orbit}:${piece}:${orientation}`;
    const solvedColors = new Map(stickers.map(sticker => [stickerKey(sticker.orbit, sticker.ord, sticker.ori), sticker.face]));
    const orientations = new Map(kpuzzle.definition.orbits.map(orbit => [orbit.orbitName, orbit.numOrientations]));
    const colors = (pattern: KPattern) => stickers.map(sticker => {
      const orbit = pattern.patternData[sticker.orbit];
      const count = orientations.get(sticker.orbit)!;
      const orientation = (sticker.ori - orbit.orientation[sticker.ord] + count) % count;
      return solvedColors.get(stickerKey(sticker.orbit, orbit.pieces[sticker.ord], orientation));
    }).join(',');

    // A correct solution may finish in a different grip. Compare all stickers
    // against the 24 rigid orientations, allowing identical centers to exchange.
    const rotations = [kpuzzle.identityTransformation()];
    for (let index = 0; index < rotations.length; index += 1) {
      for (const move of ['Uv', 'T']) {
        const rotated = rotations[index].applyAlg(move);
        if (!rotations.some(rotation => rotation.isIdentical(rotated))) rotations.push(rotated);
      }
    }
    expect(rotations).toHaveLength(24);
    const solvedFrames = new Set(rotations.map(rotation => colors(rotation.toKPattern())));
    const subsets = defaults['fto:TCP'];
    const cards = getCaseCards(defaults, 'fto:TCP', subsets.map(subset => subset.subset));
    expect(cards).toHaveLength(18);
    expect(references.cases.map(reference => reference.documentCase)).toEqual(Array.from({ length: 18 }, (_, index) => index + 1));
    expect(new Set(references.cases.map(reference => reference.name)).size).toBe(cards.length);

    for (const reference of references.cases) {
      const link = new URL(reference.twizzleUrl);
      expect(link.searchParams.get('puzzle')).toBe('fto');
      // These setups come from the source's Twizzle links, independently of the
      // library algorithm. Inverting the library itself would hide bad cases.
      const setup = link.searchParams.get('setup-alg')!;
      expect(setup).toBeTruthy();
      const card = cards.find(card => card.name === reference.name)!;
      expect(card, reference.name).toBeDefined();
      const result = kpuzzle.defaultPattern().applyAlg(setup).applyAlg(card.algorithm);
      expect(solvedFrames.has(colors(result)), `${reference.name} (document case ${reference.documentCase})`).toBe(true);
    }
  });
});
