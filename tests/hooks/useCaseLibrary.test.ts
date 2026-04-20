import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sampleSavedAlgorithms = {
  PLL: [
    { subset: 'A', algorithms: [{ name: 'Not learned', algorithm: 'R U' }] },
    { subset: 'A', algorithms: [{ name: 'Learning', algorithm: "R U R'" }] },
    { subset: 'B', algorithms: [{ name: 'Learned', algorithm: "R U2 R'" }] },
  ],
};

const initializeDefaultAlgorithms = vi.fn(() => Promise.resolve({ alertMessage: '' }));
const getSavedAlgorithms = vi.fn(() => sampleSavedAlgorithms);

vi.mock('../../src/data/defaultAlgs.json', () => ({
  default: sampleSavedAlgorithms,
}));

vi.mock('../../src/lib/storage', () => ({
  initializeDefaultAlgorithms,
  getSavedAlgorithms,
}));

vi.mock('../../src/lib/case-cards', () => ({
  cycleLearnedStatus: vi.fn(),
  getSubsetsForCategory: vi.fn((savedAlgorithms: Record<string, Array<{ subset: string }>>, selectedCategory: string) => {
    const entries = savedAlgorithms[selectedCategory] ?? [];
    return [...new Set(entries.map((entry) => entry.subset))].map((subset) => ({ subset }));
  }),
  getCaseCards: vi.fn((_savedAlgorithms: unknown, _selectedCategory: string, selectedSubsets: string[]) => {
    const cards = [
      { id: 'case-1', learned: 0, subset: 'A' },
      { id: 'case-2', learned: 1, subset: 'A' },
      { id: 'case-3', learned: 2, subset: 'B' },
    ];
    return selectedSubsets.length === 0
      ? cards
      : cards.filter((card) => selectedSubsets.includes(card.subset));
  }),
}));

const { useCaseLibrary } = await import('../../src/hooks/useCaseLibrary');

describe('useCaseLibrary', () => {
  beforeEach(() => {
    initializeDefaultAlgorithms.mockClear();
    getSavedAlgorithms.mockClear();
  });

  it('allows learning and learned filters to stay enabled together', async () => {
    const { result } = renderHook(() => useCaseLibrary());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.setSelectAllCases(false);
      result.current.setSelectLearningCases(true);
    });

    await waitFor(() => {
      expect(result.current.selectedCaseIds).toEqual(['case-2']);
    });

    act(() => {
      result.current.setSelectLearnedCases(true);
    });

    await waitFor(() => {
      expect(result.current.selectLearningCases).toBe(true);
      expect(result.current.selectLearnedCases).toBe(true);
      expect(result.current.selectAllCases).toBe(false);
      expect(result.current.selectedCaseIds).toEqual(['case-2', 'case-3']);
    });
  });

  it('falls back to the remaining filter when one combined filter is turned off', async () => {
    const { result } = renderHook(() => useCaseLibrary());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.setSelectAllCases(false);
      result.current.setSelectLearningCases(true);
      result.current.setSelectLearnedCases(true);
    });

    await waitFor(() => {
      expect(result.current.selectedCaseIds).toEqual(['case-2', 'case-3']);
    });

    act(() => {
      result.current.setSelectLearningCases(false);
    });

    await waitFor(() => {
      expect(result.current.selectLearningCases).toBe(false);
      expect(result.current.selectLearnedCases).toBe(true);
      expect(result.current.selectedCaseIds).toEqual(['case-3']);
    });
  });
});
