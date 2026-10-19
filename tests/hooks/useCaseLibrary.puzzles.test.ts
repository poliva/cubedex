import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PuzzleId } from '../../src/lib/puzzles';

vi.mock('../../src/lib/storage', async () => ({
  ...await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage'),
  initializeDefaultAlgorithms: vi.fn(async () => ({ alertMessage: null })),
  getSavedAlgorithms: vi.fn(() => ({
    OLL: [{ subset: 'Corners', algorithms: [{ name: '3×3 case', algorithm: "R U R'" }] }],
    '2x2x2:OLL': [{ subset: 'Corners', algorithms: [{ name: '2×2 case', algorithm: "R U R'" }] }],
  })),
}));
const { useCaseLibrary } = await import('../../src/hooks/useCaseLibrary');

describe('puzzle library selection', () => {
  it('filters sets by puzzle and clears subsets and case selection when switching', async () => {
    const { result, rerender } = renderHook(({ puzzle }: { puzzle: PuzzleId }) => useCaseLibrary({ puzzle }), {
      initialProps: { puzzle: '3x3x3' },
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.categories).toEqual(['OLL']);
    act(() => result.current.toggleAllSubsets(true));
    await waitFor(() => expect(result.current.caseCards.map(c => c.name)).toEqual(['3×3 case']));
    const originalId = result.current.caseCards[0].id;
    rerender({ puzzle: '2x2x2' });
    expect(result.current.categories).toEqual(['2x2x2:OLL']);
    expect(result.current.selectedSubsets).toEqual([]);
    expect(result.current.selectedCaseIds).toEqual([]);
    act(() => result.current.toggleAllSubsets(true));
    await waitFor(() => expect(result.current.caseCards.map(c => c.name)).toEqual(['2×2 case']));
    expect(result.current.caseCards[0].id).not.toBe(originalId);
    rerender({ puzzle: 'pyraminx' });
    expect(result.current.categories).toEqual([]);
    expect(result.current.selectedCategory).toBe('');
    expect(result.current.caseCards).toEqual([]);
    expect(result.current.selectedCaseIds).toEqual([]);
  });
});
