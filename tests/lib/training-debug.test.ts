import { describe, expect, it } from 'vitest';
import {
  buildSchedulerTableRows,
  buildSmartQueueTableRows,
  formatDueText,
} from '../../src/lib/training-debug';
import type { CaseCardData } from '../../src/lib/case-cards';
import type { CaseSrsState } from '../../src/lib/srs';

function makeCase(overrides: Partial<CaseCardData>): CaseCardData {
  return {
    id: 'case-1',
    name: 'Ua',
    algorithm: 'R U R\'',
    subset: 'PLL',
    category: 'PLL',
    bestTime: null,
    ao5: null,
    learned: 0,
    manualLearned: 0,
    reviewCount: 0,
    smartReviewDueAt: null,
    smartReviewDue: true,
    smartReviewUrgency: 0,
    ...overrides,
  };
}

describe('training debug formatting', () => {
  it('explains smart queue placement in plain language when due cases exist', () => {
    const now = 10_000;
    const queue = [
      makeCase({
        id: 'seen-due',
        name: 'Seen Due',
        bestTime: 1234,
        reviewCount: 3,
        smartReviewDue: true,
        smartReviewDueAt: now - 60_000,
      }),
      makeCase({
        id: 'new-due',
        name: 'New Due',
        reviewCount: 0,
        smartReviewDue: true,
        smartReviewDueAt: now - 30_000,
      }),
      makeCase({
        id: 'seen-upcoming',
        name: 'Seen Upcoming',
        reviewCount: 4,
        smartReviewDue: false,
        smartReviewDueAt: now + 60_000,
      }),
      makeCase({
        id: 'new-upcoming',
        name: 'New Upcoming',
        reviewCount: 0,
        smartReviewDue: false,
        smartReviewDueAt: now + 120_000,
      }),
    ];

    expect(buildSmartQueueTableRows(queue, now)).toEqual([
      {
        position: 1,
        case: 'Seen Due',
        best: '1.234',
        due: 'Overdue by 1 minute',
        why: 'Due and already practiced, so it moves to the front.',
      },
      {
        position: 2,
        case: 'New Due',
        best: '-',
        due: 'Overdue by 30 seconds',
        why: 'Due but still new, so it comes after the seen due cases.',
      },
      {
        position: 3,
        case: 'Seen Upcoming',
        best: '-',
        due: 'Due in 1 minute',
        why: 'Not due yet, so it waits behind the due cases.',
      },
      {
        position: 4,
        case: 'New Upcoming',
        best: '-',
        due: 'Due in 2 minutes',
        why: 'Brand new and not due yet, so it stays at the back for now.',
      },
    ]);
  });

  it('explains nearest-upcoming ordering when nothing is due yet', () => {
    const now = 5_000;
    const queue = [
      makeCase({
        id: 'case-soon',
        name: 'Soon',
        reviewCount: 2,
        smartReviewDue: false,
        smartReviewDueAt: now + 10_000,
      }),
      makeCase({
        id: 'case-later',
        name: 'Later',
        reviewCount: 5,
        smartReviewDue: false,
        smartReviewDueAt: now + 3 * 60_000,
      }),
    ];

    const rows = buildSmartQueueTableRows(queue, now);

    expect(rows[0].why).toBe('Nothing is due right now, so the soonest upcoming review goes first.');
    expect(rows[0].due).toBe('Due in 10 seconds');
    expect(rows[1].why).toBe('Nothing is due right now, so the soonest upcoming review goes first.');
    expect(rows[1].due).toBe('Due in 3 minutes');
  });

  it('shows scheduler before and after values for recorded reviews', () => {
    const reviewedAt = 100 * 24 * 60 * 60 * 1000;
    const previous: CaseSrsState = {
      dueAt: reviewedAt + 2 * 24 * 60 * 60 * 1000,
      stabilityDays: 3,
      difficulty: 5.4,
      reps: 6,
      lapses: 1,
      lastReviewedAt: reviewedAt - 24 * 60 * 60 * 1000,
      lastGrade: 'good',
    };
    const next: CaseSrsState = {
      dueAt: reviewedAt + 5 * 24 * 60 * 60 * 1000,
      stabilityDays: 5.5,
      difficulty: 5.1,
      reps: 7,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      lastGrade: 'easy',
    };

    expect(buildSchedulerTableRows(previous, next, reviewedAt)).toEqual([
      {
        field: 'Next review',
        before: 'Due in 2 days',
        after: 'Due in 5 days',
        change: '+3 days',
      },
      {
        field: 'Stability',
        before: '3 days',
        after: '5.5 days',
        change: '+2.5 days',
      },
      {
        field: 'Difficulty',
        before: '5.4',
        after: '5.1',
        change: '-0.3',
      },
      {
        field: 'Reps',
        before: '6',
        after: '7',
        change: '+1',
      },
      {
        field: 'Lapses',
        before: '1',
        after: '1',
        change: '0',
      },
    ]);
  });

  it('formats due dates without a schedule yet', () => {
    expect(formatDueText(null, 1_000)).toBe('No due date yet');
  });
});
