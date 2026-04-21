import { describe, expect, it } from 'vitest';
import {
  createReviewEntry,
  deriveAutoLearnedStatus,
  deriveReviewGrade,
  getCaseUrgency,
  isCaseDue,
  updateSrsState,
  type CaseReviewEntry,
} from '../../src/lib/srs';

function makeReview(overrides: Partial<CaseReviewEntry> = {}): CaseReviewEntry {
  return {
    reviewedAt: 1_000,
    grade: 'good',
    mode: 'timer',
    executionMs: 1_000,
    recognitionMs: null,
    totalMs: 1_000,
    hadMistake: false,
    aborted: false,
    timerOnly: true,
    ...overrides,
  };
}

describe('srs helpers', () => {
  it('derives learning states from review history thresholds', () => {
    expect(deriveAutoLearnedStatus(Array.from({ length: 4 }, (_, index) => makeReview({ reviewedAt: index })))).toBe(0);
    expect(deriveAutoLearnedStatus(Array.from({ length: 5 }, (_, index) => makeReview({ reviewedAt: index })))).toBe(1);
    expect(deriveAutoLearnedStatus([
      makeReview({ reviewedAt: 1, grade: 'again' }),
      ...Array.from({ length: 11 }, (_, index) => makeReview({ reviewedAt: index + 2 })),
    ])).toBe(2);
  });

  it('derives again hard good and easy grades from recent case history', () => {
    const baselineHistory = Array.from({ length: 11 }, (_, index) => makeReview({
      reviewedAt: index + 1,
      executionMs: 1_000,
      recognitionMs: 300,
      totalMs: 1_300,
    }));

    expect(deriveReviewGrade({
      history: baselineHistory,
      reviewedAt: 12,
      mode: 'timer',
      executionMs: 900,
      recognitionMs: 250,
      totalMs: 1_150,
      hadMistake: false,
      aborted: true,
      timerOnly: true,
    })).toBe('again');

    expect(deriveReviewGrade({
      history: baselineHistory,
      reviewedAt: 12,
      mode: 'timer',
      executionMs: 1_500,
      recognitionMs: 450,
      totalMs: 1_950,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
    })).toBe('hard');

    expect(deriveReviewGrade({
      history: baselineHistory.slice(0, 5),
      reviewedAt: 12,
      mode: 'timer',
      executionMs: 1_020,
      recognitionMs: 320,
      totalMs: 1_340,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
    })).toBe('good');

    expect(deriveReviewGrade({
      history: baselineHistory,
      reviewedAt: 12,
      mode: 'timer',
      executionMs: 950,
      recognitionMs: 250,
      totalMs: 1_200,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
    })).toBe('easy');
  });

  it('updates SRS state and marks unscheduled cards due immediately', () => {
    const firstReview = createReviewEntry({
      history: [],
      reviewedAt: 10_000,
      mode: 'timer',
      executionMs: 1_000,
      recognitionMs: null,
      totalMs: 1_000,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
    });
    const firstState = updateSrsState(null, firstReview);
    const secondState = updateSrsState(firstState, makeReview({
      reviewedAt: 10_000 + 3 * 24 * 60 * 60 * 1000,
      grade: 'hard',
    }));

    expect(firstState.reps).toBe(1);
    expect(secondState.reps).toBe(2);
    expect(secondState.dueAt).toBeGreaterThan(secondState.lastReviewedAt ?? 0);
    expect(isCaseDue(null, 100)).toBe(true);
    expect(getCaseUrgency(null, 100)).toBe(Number.NEGATIVE_INFINITY);
  });
});
