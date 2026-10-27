import { describe, expect, it } from 'vitest';
import { getCasePreviewVisualization, getStickeringForCategory } from '../../src/lib/stickering';
import { categoryId, puzzleIds, puzzleLoader, type PuzzleId } from '../../src/lib/puzzles';

describe('getStickeringForCategory', () => {
  it('returns full when full stickering is enabled', () => {
    expect(getStickeringForCategory('PLL', true)).toBe('full');
  });

  it('matches known categories even when symbols are present', () => {
    expect(getStickeringForCategory('ZBLL!', false)).toBe('ZBLL');
    expect(getStickeringForCategory('L6E-O', false)).toBe('L6EO');
    expect(getStickeringForCategory('EOcross practice', false)).toBe('EOcross');
  });

  it('matches stickering names from category words', () => {
    expect(getStickeringForCategory('Winter Variation / WVLS', false)).toBe('WVLS');
    expect(getStickeringForCategory('Practice OLL Cases', false)).toBe('OLL');
  });

  it('falls back to full for unknown categories', () => {
    expect(getStickeringForCategory('My Custom Category', false)).toBe('full');
  });

  it('uses OLL stickering for 2×2 unless full stickers are enabled', () => {
    expect(getStickeringForCategory('2x2x2:OLL', false, '2x2x2')).toBe('OLL');
    expect(getStickeringForCategory('2x2x2:OLL', true, '2x2x2')).toBe('full');
  });

  it.each<[PuzzleId, string, string]>([
    ['2x2x2', 'CLL', 'CLL'],
    ['2x2x2', 'PBL', 'PBL'],
    ['2x2x2', 'OBL', 'OBL'],
    ['4x4x4', 'OLL Parity', 'OLL'],
    ['4x4x4', 'PLL Parity', 'PLL'],
    ['5x5x5', 'Last Two Centers', 'L2C'],
    ['6x6x6', 'L2C', 'L2C'],
    ['7x7x7', 'OLL', 'OLL'],
    ['7x7x7', 'PLL', 'PLL'],
    ['megaminx', 'OLL', 'OLL'],
    ['megaminx', 'PLL', 'PLL'],
    ['megaminx', 'EO', 'EOLL'],
    ['megaminx', 'CO', 'OCLL'],
    ['megaminx', 'EP', 'EPLL'],
    ['megaminx', 'CP', 'CPLL'],
    ['megaminx', 'Edge Orientation', 'EOLL'],
    ['megaminx', 'Corner Permutation', 'CPLL'],
    ['fto', 'FC', 'experimental-fto-fc'],
    ['fto', 'F2T', 'experimental-fto-f2t'],
    ['fto', 'SC', 'experimental-fto-sc'],
    ['fto', 'L2C', 'experimental-fto-l2c'],
    ['fto', 'LBT', 'experimental-fto-lbt'],
    ['fto', 'L3T', 'experimental-fto-l3t'],
    ['fto', 'experimental-fto-l3t', 'experimental-fto-l3t'],
  ])('uses %s category %s stickering in practice and puzzle-scoped previews', (puzzle, category, expected) => {
    expect(getStickeringForCategory(category, false, puzzle)).toBe(expected);
    expect(getStickeringForCategory(categoryId(puzzle, category), false, puzzle)).toBe(expected);
    expect(getStickeringForCategory(categoryId(puzzle, category), true, puzzle)).toBe('full');
  });

  it.each<[PuzzleId, string]>([
    ['2x2x2', 'EG1'], ['2x2x2', 'EG2'],
    ['5x5x5', 'Last Two Edges'], ['7x7x7', 'L2C'],
    ['6x6x6', 'Parity'], ['7x7x7', 'Parity'],
    ['megaminx', 'F2L'], ['fto', 'OLL'], ['fto', 'TCP'],
    ['fto', 'L6X'], ['fto', 'L3C'], ['fto', '1LP'],
    ['pyraminx', 'OLL'], ['skewb', 'CLL'], ['square1', 'PLL'],
  ])('keeps full stickers for unsupported %s category %s', (puzzle, category) => {
    expect(getStickeringForCategory(categoryId(puzzle, category), false, puzzle)).toBe('full');
  });

  it.each(puzzleIds)('only selects masks advertised by the real %s loader', async puzzle => {
    const supported = await puzzleLoader(puzzle).stickerings?.() ?? ['full'];
    for (const category of [...supported, 'EO', 'CO', 'EP', 'CP', 'Last Two Centers', 'L2C', 'FC', 'L3T']) {
      const stickering = getStickeringForCategory(categoryId(puzzle, category), false, puzzle);
      expect(supported, `${puzzle}: ${category} → ${stickering}`).toContain(stickering);
    }
  });

  it.each<PuzzleId>(['6x6x6', '7x7x7'])('uses each %s parity case name to distinguish orientation from permutation', puzzle => {
    const category = categoryId(puzzle, 'Parity');
    expect(getStickeringForCategory(category, false, puzzle, 'OLL Parity Inner')).toBe('OLL');
    expect(getStickeringForCategory(category, false, puzzle, 'OLL Parity Outer')).toBe('OLL');
    expect(getStickeringForCategory(category, false, puzzle, 'PLL Parity')).toBe('PLL');
    expect(getStickeringForCategory(category, true, puzzle, 'PLL Parity')).toBe('full');
    expect(getStickeringForCategory(category, false, puzzle, 'Custom parity')).toBe('full');
  });
});

describe('case thumbnail visualization', () => {
  it.each<[PuzzleId, string]>([
    ['3x3x3', 'OLL'], ['3x3x3', 'PLL'], ['3x3x3', 'ZBLL'],
    ['2x2x2', 'OLL'], ['2x2x2', 'CLL'],
    ['4x4x4', 'OLL Parity'], ['4x4x4', 'PLL Parity'],
    ['megaminx', 'OLL'], ['megaminx', 'PLL'],
    ['megaminx', 'EO'], ['megaminx', 'CO'], ['megaminx', 'EP'], ['megaminx', 'CP'],
  ])('uses a last-layer SVG for %s %s', (puzzle, category) => {
    expect(puzzleLoader(puzzle).llSVG).toBeDefined();
    expect(getCasePreviewVisualization(categoryId(puzzle, category), puzzle)).toBe('experimental-2D-LL');
  });

  it.each<[PuzzleId, string]>([
    ['2x2x2', 'PBL'], ['2x2x2', 'OBL'], ['2x2x2', 'EG1'], ['2x2x2', 'EG2'],
    ['4x4x4', 'L2C'], ['5x5x5', 'Last Two Centers'], ['5x5x5', 'Last Two Edges'],
    ['5x5x5', 'OLL'], ['6x6x6', 'Parity'], ['7x7x7', 'Parity'],
    ['fto', 'TCP'], ['fto', 'L3T'],
  ])('uses 3D when %s %s has no suitable last-layer diagram', (puzzle, category) => {
    expect(getCasePreviewVisualization(categoryId(puzzle, category), puzzle)).toBe('3D');
  });

  it('retains the 3×3 first-two-layers 3D preview', () => {
    expect(getCasePreviewVisualization('F2L')).toBe('3D');
    expect(getCasePreviewVisualization('LSOLL')).toBe('experimental-2D-LL');
  });
});
