import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAlgorithmImportExport } from '../../src/hooks/useAlgorithmImportExport';
import { saveAlgorithm } from '../../src/lib/storage';
import type { PuzzleId } from '../../src/lib/puzzles';

vi.mock('../../src/lib/storage', async () => ({
  ...await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage'),
  saveAlgorithm: vi.fn(async () => undefined),
}));

describe('saving puzzle algorithms', () => {
  it.each([
    ['3x3x3', "R U R'", 'OLL'],
    ['2x2x2', "R U R'", '2x2x2:OLL'],
    ['pyraminx', "R U R' u", 'pyraminx:OLL'],
    ['4x4x4', "2R2 U2 2R2 Uw2 2R2 Uw2", '4x4x4:OLL'],
    ['5x5x5', "Rw U2 3Rw U2 3Rw' Rw'", '5x5x5:OLL'],
    ['megaminx', "R' BR' R BR", 'megaminx:OLL'],
    ['6x6x6', "3Rw U2 3R' U2", '6x6x6:OLL'],
    ['7x7x7', "4Rw U2 3R' U2", '7x7x7:OLL'],
    ['skewb', "UR R' UR' R", 'skewb:OLL'],
    ['fto', "Rv BR U r' U'", 'fto:OLL'],
  ] as [PuzzleId, string, string][])('saves %s notation into its own library', async (puzzle, algorithm, category) => {
    const { result } = renderHook(() => useAlgorithmImportExport(undefined, puzzle));
    act(() => {
      result.current.setCategoryInput('OLL');
      result.current.setSubsetInput('My cases');
      result.current.setAlgNameInput('Case');
    });
    await act(async () => expect(await result.current.submitSave(algorithm)).toBe(true));
    expect(saveAlgorithm).toHaveBeenLastCalledWith(category, 'My cases', 'Case', algorithm);
  });

  it('rejects moves that are not supported by the selected puzzle', async () => {
    const { result } = renderHook(() => useAlgorithmImportExport(undefined, '2x2x2'));
    act(() => {
      result.current.setCategoryInput('Custom');
      result.current.setSubsetInput('My cases');
      result.current.setAlgNameInput('Case');
    });
    await act(async () => expect(await result.current.submitSave('M')).toBe(false));
    expect(result.current.saveError).toBe('Enter a valid 2×2 algorithm.');
  });
});
