import { vi } from 'vitest';
import type { CaseCardData } from '../../src/lib/case-cards';

type AttemptHistoryStore = Map<string, Array<any>>;

export interface TrainingStateMockStore {
  patterns: Record<string, any>;
  attemptHistory: AttemptHistoryStore;
  bestTimes: Map<string, number | null>;
  srsStates: Map<string, any>;
  timeAttackRuns: Map<string, Array<{ wallMs: number; caseTimes: number[] }>>;
}

export function getAttemptHistoryEntries(state: TrainingStateMockStore, id: string) {
  return [...(state.attemptHistory.get(id) ?? [])];
}

export function getSolveHistoryEntries(state: TrainingStateMockStore, id: string) {
  return getAttemptHistoryEntries(state, id)
    .filter((entry) => entry.aborted !== true && Number.isFinite(entry.executionMs))
    .map((entry) => ({
      executionMs: entry.executionMs,
      recognitionMs: entry.recognitionMs,
      totalMs: entry.totalMs,
    }));
}

export function getReviewHistoryEntries(state: TrainingStateMockStore, id: string) {
  return getAttemptHistoryEntries(state, id)
    .filter((entry) => entry.grade != null)
    .map((entry) => ({
      reviewedAt: entry.recordedAt,
      grade: entry.grade,
      mode: entry.mode,
      executionMs: entry.executionMs,
      recognitionMs: entry.recognitionMs,
      totalMs: entry.totalMs,
      hadMistake: entry.hadMistake,
      aborted: entry.aborted,
      timerOnly: entry.timerOnly,
    }));
}

export function buildAttemptSummary(state: TrainingStateMockStore, id: string) {
  const attemptHistory = getAttemptHistoryEntries(state, id);
  const solveHistory = getSolveHistoryEntries(state, id);
  const reviewHistory = getReviewHistoryEntries(state, id);
  return {
    attemptHistory,
    solveHistory,
    reviewHistory,
    executionTimes: solveHistory.map((entry) => entry.executionMs),
  };
}

export function createPattern(state: TrainingStateMockStore, key: string) {
  return {
    key,
    patternData: {
      EDGES: { pieces: [key.length], orientation: [0] },
      CORNERS: { pieces: [key.length], orientation: [0] },
      CENTERS: { pieces: [0], orientation: [0] },
    },
    applyMove: vi.fn((move: string) => {
      const nextPattern = state.patterns[`${key}:${move}`];
      if (!nextPattern) {
        throw new Error(`Missing mock pattern for ${key}:${move}`);
      }
      return nextPattern;
    }),
    isIdentical(other: { key?: string } | null | undefined) {
      return other?.key === key;
    },
  };
}

export function resetMockState(state: TrainingStateMockStore) {
  state.patterns = {};
  state.attemptHistory.clear();
  state.bestTimes.clear();
  state.srsStates.clear();
  state.timeAttackRuns.clear();
}

export const selectedCases: CaseCardData[] = [
  {
    id: 'case-1',
    name: 'Aa',
    algorithm: 'R',
    subset: 'A',
    category: 'PLL',
    learned: 0,
    manualLearned: 0,
    reviewCount: 0,
    smartReviewDueAt: null,
    smartReviewDue: true,
    smartReviewUrgency: 0,
    bestTime: null,
    ao5: null,
  },
  {
    id: 'case-2',
    name: 'Ab',
    algorithm: 'R',
    subset: 'A',
    category: 'PLL',
    learned: 0,
    manualLearned: 0,
    reviewCount: 0,
    smartReviewDueAt: null,
    smartReviewDue: true,
    smartReviewUrgency: 1,
    bestTime: null,
    ao5: null,
  },
];
