import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Alg } from 'cubing/alg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import defaults from '../../src/data/defaultAlgs.json';
import { useCaseLibrary } from '../../src/hooks/useCaseLibrary';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { getCaseCards } from '../../src/lib/case-cards';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getAttemptHistory, removeAlgorithmTimesStorage } from '../../src/lib/storage';

// Keep real case cards, storage, patterns, and training; skip storage migration.
vi.mock('../../src/lib/storage', async () => ({
  ...await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage'),
  initializeDefaultAlgorithms: vi.fn(async () => ({ alertMessage: null })),
  getSavedAlgorithms: vi.fn(() => defaults),
}));

describe('case selection during smartcube practice', () => {
  beforeEach(() => {
    for (const card of getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL'])) {
      removeAlgorithmTimesStorage(card.id);
    }
  });

  it.each([false, true])(
    'repeats only the manually selected PBL after review refreshes (smart order %s)',
    async (smartReviewScheduling) => {
      let physical = await solvedPattern(2);
      const { result } = renderHook(() => {
        const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
        const library = useCaseLibrary({ puzzle: '2x2x2', autoUpdateLearningState: true, reviewRefreshToken });
        const selectedCases = library.caseCards.filter(card => library.selectedCaseIds.includes(card.id));
        const training = useTrainingState(selectedCases, library.selectedCategory, {
          puzzle: '2x2x2', selectionChangeMode: library.selectionChangeMode,
          countdownMode: false, randomizeAUF: false, randomOrder: false, timeAttack: false,
          prioritizeSlowCases: false, prioritizeFailedCases: false, smartReviewScheduling,
          smartcubeConnected: true, currentPattern: physical, reviewRefreshToken,
          onReviewRecorded: () => setReviewRefreshToken(token => token + 1),
        });
        return { library, training, reviewRefreshToken };
      });

      await waitFor(() => expect(result.current.library.isReady).toBe(true));
      act(() => result.current.library.setSelectedCategory('2x2x2:PBL'));
      act(() => result.current.library.toggleAllSubsets(true));
      expect(result.current.library.selectedCaseIds).toHaveLength(6);
      const selected = result.current.library.caseCards.find(card => card.name === 'Adj Adj - 2 bars')!;
      act(() => {
        for (const card of result.current.library.caseCards) {
          if (card.id !== selected.id) result.current.library.toggleCaseSelection(card.id, false);
        }
      });
      await waitFor(() => expect(result.current.training.displayAlg).toBe(selected.algorithm));

      const moves = new Alg(selected.algorithm).expand().toString().split(/\s+/)
        .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
      for (let attempt = 1; attempt <= 4; attempt++) {
        for (const [index, move] of moves.entries()) {
          physical = physical.applyMove(move);
          let completed = false;
          await act(async () => {
            // MY22 reports U/R/F axes and orientation-normalized corner states.
            completed = result.current.training.handleSmartcubeMove(fixOrientation(physical), move.replace('B', 'F'));
          });
          expect(completed, `attempt ${attempt}, turn ${index + 1}`).toBe(index === moves.length - 1);
        }
        expect(result.current.reviewRefreshToken).toBe(attempt);
        expect(getAttemptHistory(selected.id)).toHaveLength(attempt);
        expect(result.current.library.selectedCaseIds).toEqual([selected.id]);
        expect(result.current.training.currentCase?.id).toBe(selected.id);
        expect(result.current.training.displayAlg).toBe(selected.algorithm);
      }
    },
  );
});
