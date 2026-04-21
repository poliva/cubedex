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
const mockCards = [
  { id: 'case-1', learned: 0, subset: 'A', smartReviewDue: false },
  { id: 'case-2', learned: 1, subset: 'A', smartReviewDue: true },
  { id: 'case-3', learned: 2, subset: 'B', smartReviewDue: false },
];

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
    return selectedSubsets.length === 0
      ? mockCards
      : mockCards.filter((card) => selectedSubsets.includes(card.subset));
  }),
}));

const { useCaseLibrary } = await import('../../src/hooks/useCaseLibrary');

describe('useCaseLibrary', () => {
  beforeEach(() => {
    initializeDefaultAlgorithms.mockClear();
    getSavedAlgorithms.mockClear();
    mockCards[0].learned = 0;
    mockCards[1].learned = 1;
    mockCards[2].learned = 2;
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

  it('keeps the current filtered selection when smart scheduling is enabled', async () => {
    const { result } = renderHook(() => useCaseLibrary({ smartReviewScheduling: true }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.toggleSubset('A', true);
    });

    await waitFor(() => {
      expect(result.current.selectedCaseIds).toEqual(['case-1', 'case-2']);
    });
  });

  it('allows manual case toggles while smart scheduling is enabled', async () => {
    const { result } = renderHook(() => useCaseLibrary({ smartReviewScheduling: true }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    act(() => {
      result.current.setSelectAllCases(false);
    });

    await waitFor(() => {
      expect(result.current.selectedCaseIds).toEqual([]);
    });

    act(() => {
      result.current.toggleCaseSelection('case-2', true);
    });

    await waitFor(() => {
      expect(result.current.selectionChangeMode).toBe('manual');
      expect(result.current.selectedCaseIds).toEqual(['case-2']);
    });

    act(() => {
      result.current.toggleCaseSelection('case-2', false);
    });

    await waitFor(() => {
      expect(result.current.selectedCaseIds).toEqual([]);
    });
  });

  it('recomputes case card learned states when review refresh token changes', async () => {
    const { result, rerender } = renderHook(
      ({ reviewRefreshToken }) => useCaseLibrary({ autoUpdateLearningState: true, reviewRefreshToken }),
      { initialProps: { reviewRefreshToken: 0 } },
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(result.current.caseCards.find((card) => card.id === 'case-2')?.learned).toBe(1);
    });

    mockCards[1].learned = 2;
    rerender({ reviewRefreshToken: 1 });

    await waitFor(() => {
      expect(result.current.caseCards.find((card) => card.id === 'case-2')?.learned).toBe(2);
    });
  });
});
