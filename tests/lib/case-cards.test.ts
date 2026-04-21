import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage');
  return {
    ...actual,
    getLastTimes: vi.fn(),
    getBestTime: vi.fn(),
    getLearnedStatus: vi.fn(),
    getReviewHistory: vi.fn(),
    getSrsState: vi.fn(),
    setLearnedStatus: vi.fn(),
  };
});

import {
  averageOfFiveTimeNumber,
  averageTimeString,
  bestTimeString,
  cycleLearnedStatus,
  getAllAlgorithms,
  getCaseCards,
  getSubsetsForCategory,
  learnedLabel,
  learnedTitle,
  makeTimeParts,
} from '../../src/lib/case-cards';
import {
  createScopeId,
  getBestTime,
  getLastTimes,
  getLearnedStatus,
  getReviewHistory,
  getSrsState,
  setLearnedStatus,
  type SavedAlgorithms,
} from '../../src/lib/storage';

const mockedGetLastTimes = vi.mocked(getLastTimes);
const mockedGetBestTime = vi.mocked(getBestTime);
const mockedGetLearnedStatus = vi.mocked(getLearnedStatus);
const mockedGetReviewHistory = vi.mocked(getReviewHistory);
const mockedGetSrsState = vi.mocked(getSrsState);
const mockedSetLearnedStatus = vi.mocked(setLearnedStatus);

describe('case card helpers', () => {
  beforeEach(() => {
    mockedGetLastTimes.mockReset();
    mockedGetBestTime.mockReset();
    mockedGetLearnedStatus.mockReset();
    mockedGetReviewHistory.mockReset();
    mockedGetSrsState.mockReset();
    mockedSetLearnedStatus.mockReset();
  });

  it('splits times into minutes, seconds, and milliseconds', () => {
    expect(makeTimeParts(61_023)).toEqual({ minutes: 1, seconds: 1, milliseconds: 23 });
  });

  it('formats best and average times', () => {
    expect(bestTimeString(null)).toBe('-');
    expect(bestTimeString(1_234)).toBe('1.234');
    expect(bestTimeString(74_437)).toBe('1:14.437');
    expect(averageTimeString(9_876)).toBe('9.876');
    expect(averageTimeString(74_437)).toBe('1:14.437');
  });

  it('computes an average of five by trimming the fastest and slowest times', () => {
    mockedGetLastTimes.mockReturnValue([1_100, 1_300, 1_200, 1_500, 1_000]);

    expect(averageOfFiveTimeNumber('case:pll')).toBe(1_200);
  });

  it('cycles learned status and persists the next state', () => {
    mockedGetLearnedStatus.mockReturnValue(1);

    expect(cycleLearnedStatus('scope-id')).toBe(2);
    expect(mockedSetLearnedStatus).toHaveBeenCalledWith('scope-id', 2);
  });

  it('returns learned labels and titles', () => {
    expect(learnedLabel(0)).toBe('Not learned');
    expect(learnedLabel(1)).toBe('Learning');
    expect(learnedTitle(2)).toBe('Learned');
  });

  it('builds case cards from selected subsets only', () => {
    const savedAlgorithms: SavedAlgorithms = {
      PLL: [
        {
          subset: 'A',
          algorithms: [{ name: 'Aa', algorithm: "RUR'U'" }],
        },
        {
          subset: 'B',
          algorithms: [{ name: 'Ab', algorithm: "R2 U R U R' U' R' U' R' U R'" }],
        },
      ],
    };

    mockedGetBestTime.mockReturnValue(2_345);
    mockedGetLastTimes.mockReturnValue([2_000, 2_100, 2_200, 2_300, 2_400]);
    mockedGetLearnedStatus.mockReturnValue(2);
    mockedGetReviewHistory.mockReturnValue([]);
    mockedGetSrsState.mockReturnValue(null);

    const cards = getCaseCards(savedAlgorithms, 'PLL', ['A']);

    expect(cards).toEqual([
      {
        id: createScopeId('PLL', 'A', 'R-U-Rp-Up'),
        name: 'Aa',
        algorithm: "R U R' U'",
        subset: 'A',
        category: 'PLL',
        bestTime: 2_345,
        ao5: 2_200,
        learned: 2,
        manualLearned: 2,
        reviewCount: 0,
        smartReviewDueAt: null,
        smartReviewDue: true,
        smartReviewUrgency: Number.NEGATIVE_INFINITY,
      },
    ]);
  });

  it('derives automatic learned status from review history when enabled', () => {
    const savedAlgorithms: SavedAlgorithms = {
      PLL: [
        {
          subset: 'A',
          algorithms: [{ name: 'Aa', algorithm: "RUR'U'" }],
        },
      ],
    };

    mockedGetBestTime.mockReturnValue(null);
    mockedGetLastTimes.mockReturnValue([]);
    mockedGetLearnedStatus.mockReturnValue(0);
    mockedGetSrsState.mockReturnValue({ dueAt: 1234, stabilityDays: 2, difficulty: 5, reps: 1, lapses: 0, lastReviewedAt: 1000, lastGrade: 'good' });
    mockedGetReviewHistory.mockReturnValue(Array.from({ length: 12 }, (_, index) => ({
      reviewedAt: index + 1,
      grade: index === 0 ? 'again' : 'good',
      mode: 'timer',
      executionMs: 1000,
      recognitionMs: null,
      totalMs: 1000,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
    })));

    const cards = getCaseCards(savedAlgorithms, 'PLL', ['A'], { autoUpdateLearningState: true, now: 2000 });

    expect(cards[0]).toMatchObject({
      learned: 2,
      manualLearned: 0,
      reviewCount: 12,
      smartReviewDueAt: 1234,
      smartReviewDue: true,
    });
  });

  it('returns subset and algorithm copies without mutating the source library', () => {
    const savedAlgorithms: SavedAlgorithms = {
      OLL: [
        {
          subset: 'Core',
          algorithms: [{ name: 'Sune', algorithm: "R U R' U R U2 R'" }],
        },
      ],
    };

    const subsets = getSubsetsForCategory(savedAlgorithms, 'OLL');
    const algorithms = getAllAlgorithms(savedAlgorithms, 'OLL');
    algorithms[0].name = 'Changed';

    expect(subsets).toHaveLength(1);
    expect(algorithms).toEqual([{ name: 'Changed', algorithm: "R U R' U R U2 R'" }]);
    expect(savedAlgorithms.OLL[0].algorithms[0].name).toBe('Sune');
  });
});
