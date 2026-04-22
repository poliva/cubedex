import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cubeTimestampLinearFit } from 'smartcube-web-bluetooth';
import {
  buildAttemptSummary,
  createPattern,
  getAttemptHistoryEntries,
  getReviewHistoryEntries,
  getSolveHistoryEntries,
  resetMockState,
  selectedCases,
} from './useTrainingStateTestUtils';

const mockState = vi.hoisted(() => ({
  patterns: {} as Record<string, any>,
  attemptHistory: new Map<string, Array<any>>(),
  bestTimes: new Map<string, number | null>(),
  srsStates: new Map<string, any>(),
  timeAttackRuns: new Map<string, Array<{ wallMs: number; caseTimes: number[] }>>(),
}));

vi.mock('cubing/alg', () => ({
  Alg: {
    fromString: vi.fn((raw: string) => ({
      experimentalSimplify: () => ({
        toString: () => raw.trim(),
      }),
    })),
  },
}));

vi.mock('cubing/puzzles', () => ({
  cube3x3x3: {},
}));

vi.mock('smartcube-web-bluetooth', () => ({
  cubeTimestampLinearFit: vi.fn(() => []),
}));

vi.mock('../../src/lib/auf', () => ({
  prepareTrainingAlgorithm: vi.fn(async (moves: string[]) => ({
    displayAlgorithm: moves.join(' '),
    moves,
    originalMoves: moves,
  })),
}));

vi.mock('../../src/lib/cube-utils', () => ({
  solvedPattern: vi.fn(async () => mockState.patterns.solved),
}));

vi.mock('../../src/lib/scramble', () => ({
  fixOrientation: vi.fn((pattern: unknown) => pattern),
}));

vi.mock('../../src/lib/charts', () => ({
  countMovesETM: vi.fn(() => 1),
}));

vi.mock('../../src/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage');
  return {
    ...actual,
    getBestTime: vi.fn((id: string) => mockState.bestTimes.get(id) ?? null),
    getAttemptHistory: vi.fn((id: string) => getAttemptHistoryEntries(mockState, id)),
    getAttemptHistorySummary: vi.fn((id: string) => buildAttemptSummary(mockState, id)),
    getLastTimes: vi.fn((id: string) => buildAttemptSummary(mockState, id).executionTimes),
    getReviewHistory: vi.fn((id: string) => getReviewHistoryEntries(mockState, id)),
    getSolveHistory: vi.fn((id: string) => getSolveHistoryEntries(mockState, id)),
    getSrsState: vi.fn((id: string) => mockState.srsStates.get(id) ?? null),
    getTimeAttackLastRuns: vi.fn((id: string) => mockState.timeAttackRuns.get(id) ?? []),
    setBestTime: vi.fn((id: string, value: number) => {
      mockState.bestTimes.set(id, value);
    }),
    setAttemptHistory: vi.fn((id: string, values: Array<any>) => {
      mockState.attemptHistory.set(id, [...values]);
    }),
    setSrsState: vi.fn((id: string, value: any) => {
      mockState.srsStates.set(id, value);
    }),
    setTimeAttackLastRuns: vi.fn((id: string, values: Array<{ wallMs: number; caseTimes: number[] }>) => {
      mockState.timeAttackRuns.set(id, values);
    }),
  };
});

import { useTrainingState } from '../../src/hooks/useTrainingState';
import {
  createTimeAttackScopeId,
  getBestTime,
  getLastTimes,
  getReviewHistory,
  getSolveHistory,
  getAttemptHistory,
  getSrsState,
  getTimeAttackLastRuns,
} from '../../src/lib/storage';
import type { CaseCardData } from '../../src/lib/case-cards';

function renderTrainingState() {
  return renderHook(() => useTrainingState(selectedCases, 'PLL', {
    selectionChangeMode: 'bulk',
    countdownMode: false,
    randomizeAUF: false,
    randomOrder: false,
    timeAttack: true,
    prioritizeSlowCases: false,
    prioritizeFailedCases: false,
    smartReviewScheduling: false,
    smartcubeConnected: false,
    currentPattern: null,
    statsRefreshToken: 0,
  }));
}

function makeSmartReviewCases(count: number, overrides: Partial<CaseCardData>[] = []) {
  return Array.from({ length: count }, (_, index) => ({
    ...selectedCases[index % selectedCases.length],
    id: `case-${index + 1}`,
    name: `Case ${index + 1}`,
    subset: 'A',
    category: 'PLL',
    reviewCount: 2,
    smartReviewDueAt: index,
    smartReviewDue: true,
    smartReviewUrgency: index,
    ...overrides[index],
  }));
}

function renderSmartReviewState(cases: CaseCardData[], reviewRefreshToken = 0) {
  return renderHook(({ currentCases, currentReviewRefreshToken }) => useTrainingState(currentCases, 'PLL', {
    selectionChangeMode: 'bulk',
    countdownMode: false,
    randomizeAUF: false,
    randomOrder: false,
    timeAttack: false,
    prioritizeSlowCases: false,
    prioritizeFailedCases: false,
    smartReviewScheduling: true,
    smartcubeConnected: false,
    currentPattern: null,
    statsRefreshToken: 0,
    reviewRefreshToken: currentReviewRefreshToken,
  }), {
    initialProps: { currentCases: cases, currentReviewRefreshToken: reviewRefreshToken },
  });
}

function renderSmartcubeSmartReviewState(cases: CaseCardData[]) {
  return renderHook(({ currentCases }) => useTrainingState(currentCases, 'PLL', {
    selectionChangeMode: 'bulk',
    countdownMode: false,
    randomizeAUF: false,
    randomOrder: false,
    timeAttack: false,
    prioritizeSlowCases: false,
    prioritizeFailedCases: false,
    smartReviewScheduling: true,
    smartcubeConnected: true,
    currentPattern: null,
    statsRefreshToken: 0,
  }), {
    initialProps: { currentCases: cases },
  });
}

describe('useTrainingState time attack counts', () => {
  beforeEach(() => {
    resetMockState(mockState);

    const patternKeys = ['solved', 'solved:R:U'];
    let repeatedR = 'solved';
    for (let index = 0; index < 12; index += 1) {
      repeatedR = `${repeatedR}:R`;
      patternKeys.push(repeatedR);
    }
    for (const key of patternKeys) {
      mockState.patterns[key] = createPattern(mockState, key);
    }
  });

  it('keeps failed time-attack counts keyed by the current case', async () => {
    const { result } = renderTrainingState();

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.handleSmartcubeMove(mockState.patterns['solved:R:U'], 'U');
    });

    await waitFor(() => {
      expect(result.current.failedCounts['case-1']).toBe(1);
    });
  });

  it('increments solved time-attack cases per card and preserves run-level stats', async () => {
    const { result } = renderTrainingState();
    const scopeId = createTimeAttackScopeId('PLL', selectedCases.map((selectedCase) => selectedCase.id));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(1200);
    });

    await waitFor(() => {
      expect(result.current.practiceCounts['case-1']).toBe(1);
      expect(result.current.currentCase?.id).toBe('case-2');
    });
    expect(getLastTimes('case-1')).toEqual([1200]);
    expect(getSolveHistory('case-1')).toEqual([
      { executionMs: 1200, recognitionMs: null, totalMs: 1200 },
    ]);
    expect(getBestTime('case-1')).toBe(1200);

    act(() => {
      result.current.stopAndRecordSolve(2300);
    });

    await waitFor(() => {
      expect(result.current.practiceCounts['case-2']).toBe(1);
      expect(result.current.practiceCounts[scopeId]).toBe(1);
    });
    expect(getLastTimes('case-2')).toEqual([2300]);
    expect(getSolveHistory('case-2')).toEqual([
      { executionMs: 2300, recognitionMs: 0, totalMs: 2300 },
    ]);
    expect(getBestTime('case-2')).toBe(2300);

    const recordedWallTimes = getLastTimes(scopeId);
    expect(recordedWallTimes).toHaveLength(1);
    expect(getBestTime(scopeId)).toBe(recordedWallTimes[0]);
    expect(getTimeAttackLastRuns(scopeId)).toEqual([
      { wallMs: recordedWallTimes[0], caseTimes: [1200, 2300] },
    ]);
    expect(getSolveHistory(scopeId)).toEqual([
      { executionMs: recordedWallTimes[0], recognitionMs: null, totalMs: recordedWallTimes[0] },
    ]);
  });

  it('records smartcube recognition from case display to first move timestamp after the first case', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.mocked(cubeTimestampLinearFit)
      .mockReturnValueOnce([{ cubeTimestamp: 500 }] as any)
      .mockReturnValueOnce([{ cubeTimestamp: 700 }] as any);

    const { result } = renderHook(() => useTrainingState(selectedCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: false,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: false,
      smartcubeConnected: true,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    now = 1300;
    act(() => {
      result.current.handleSmartcubeMove(
        mockState.patterns['solved:R'],
        'R',
        [{ face: 0, direction: 1, move: 'R', localTimestamp: 1300, cubeTimestamp: 500 }],
      );
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });

    now = 1800;
    act(() => {
      result.current.handleSmartcubeMove(
        mockState.patterns['solved:R:R'],
        'R',
        [{ face: 0, direction: 1, move: 'R', localTimestamp: 1800, cubeTimestamp: 700 }],
      );
    });

    await waitFor(() => {
      expect(getSolveHistory('case-1')).toEqual([
        { executionMs: 500, recognitionMs: null, totalMs: 500 },
      ]);
      expect(getSolveHistory('case-2')).toEqual([
        { executionMs: 700, recognitionMs: 500, totalMs: 1200 },
      ]);
    });
  });

  it('keeps smartcube recognition tracking after review refresh rerenders', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.mocked(cubeTimestampLinearFit)
      .mockReturnValueOnce([{ cubeTimestamp: 500 }] as any)
      .mockReturnValueOnce([{ cubeTimestamp: 700 }] as any);

    const { result, rerender } = renderHook(
      ({ reviewRefreshToken }) => useTrainingState(selectedCases, 'PLL', {
        selectionChangeMode: 'bulk',
        countdownMode: false,
        randomizeAUF: false,
        randomOrder: false,
        timeAttack: false,
        prioritizeSlowCases: false,
        prioritizeFailedCases: false,
        smartReviewScheduling: false,
        smartcubeConnected: true,
        currentPattern: null,
        statsRefreshToken: 0,
        reviewRefreshToken,
      }),
      { initialProps: { reviewRefreshToken: 0 } },
    );

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    now = 1300;
    act(() => {
      result.current.handleSmartcubeMove(
        mockState.patterns['solved:R'],
        'R',
        [{ face: 0, direction: 1, move: 'R', localTimestamp: 1300, cubeTimestamp: 500 }],
      );
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });

    rerender({ reviewRefreshToken: 1 });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.timerState).toBe('READY');
    });

    now = 1800;
    act(() => {
      result.current.handleSmartcubeMove(
        mockState.patterns['solved:R:R'],
        'R',
        [{ face: 0, direction: 1, move: 'R', localTimestamp: 1800, cubeTimestamp: 700 }],
      );
    });

    await waitFor(() => {
      expect(getSolveHistory('case-2')).toEqual([
        { executionMs: 700, recognitionMs: 500, totalMs: 1200 },
      ]);
    });
  });

  it('ignores smartcube moves while the countdown is visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    try {
      const { result } = renderHook(() => useTrainingState(selectedCases, 'PLL', {
        selectionChangeMode: 'bulk',
        countdownMode: true,
        randomizeAUF: false,
        randomOrder: false,
        timeAttack: false,
        prioritizeSlowCases: false,
        prioritizeFailedCases: false,
        smartReviewScheduling: false,
        smartcubeConnected: true,
        currentPattern: null,
        statsRefreshToken: 0,
      }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.countdownActive).toBe(true);
      expect(result.current.timerState).toBe('IDLE');

      act(() => {
        const handled = result.current.handleSmartcubeMove(
          mockState.patterns['solved:R'],
          'R',
          [{ face: 0, direction: 1, move: 'R', localTimestamp: 1500, cubeTimestamp: 500 }],
        );
        expect(handled).toBe(false);
      });

      expect(getSolveHistory('case-1')).toEqual([]);
      expect(result.current.currentCase?.id).toBe('case-1');

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.countdownActive).toBe(false);
      expect(result.current.timerState).toBe('READY');

      act(() => {
        result.current.handleSmartcubeMove(
          mockState.patterns['solved:R'],
          'R',
          [{ face: 0, direction: 1, move: 'R', localTimestamp: 4200, cubeTimestamp: 700 }],
        );
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.currentCase?.id).toBe('case-2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips countdown when time attack is enabled even if countdown mode is on', async () => {
    const { result } = renderHook(() => useTrainingState(selectedCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: true,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: true,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: false,
      smartcubeConnected: false,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.countdownActive).toBe(false);
      expect(result.current.timerState).toBe('READY');
    });
  });

  it('records review history and SRS state for successful solves', async () => {
    const { result } = renderHook(() => useTrainingState(selectedCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: false,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: false,
      smartcubeConnected: false,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(1200);
    });

    expect(getReviewHistory('case-1')).toHaveLength(1);
    expect(getReviewHistory('case-1')[0]).toMatchObject({
      grade: 'good',
      mode: 'timer',
      aborted: false,
      hadMistake: false,
      executionMs: 1200,
    });
    expect(getSrsState('case-1')).toMatchObject({
      reps: 1,
      lastGrade: 'good',
    });
  });

  it('keeps logging rapid repeated solves while throttling upward SRS growth', async () => {
    const firstReviewedAt = 10_000;
    const secondReviewedAt = firstReviewedAt + 60_000;
    const initialDueAt = firstReviewedAt + 2 * 24 * 60 * 60 * 1000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(secondReviewedAt);

    mockState.attemptHistory.set('case-1', [
      {
        recordedAt: firstReviewedAt,
        mode: 'timer',
        executionMs: 1300,
        recognitionMs: null,
        totalMs: 1300,
        hadMistake: false,
        aborted: false,
        timerOnly: true,
        grade: 'good',
      },
    ]);
    mockState.bestTimes.set('case-1', 1300);
    mockState.srsStates.set('case-1', {
      dueAt: initialDueAt,
      stabilityDays: 2,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      lastReviewedAt: firstReviewedAt,
      lastGrade: 'good',
    });

    try {
      const { result } = renderHook(() => useTrainingState([selectedCases[0]], 'PLL', {
        selectionChangeMode: 'bulk',
        countdownMode: false,
        randomizeAUF: false,
        randomOrder: false,
        timeAttack: false,
        prioritizeSlowCases: false,
        prioritizeFailedCases: false,
        smartReviewScheduling: false,
        smartcubeConnected: false,
        currentPattern: null,
        statsRefreshToken: 0,
      }));

      await waitFor(() => {
        expect(result.current.currentCase?.id).toBe('case-1');
      });

      act(() => {
        result.current.stopAndRecordSolve(1200);
      });

      expect(getAttemptHistory('case-1')).toHaveLength(2);
      expect(getReviewHistory('case-1')).toHaveLength(2);
      expect(getSolveHistory('case-1')).toEqual([
        { executionMs: 1300, recognitionMs: null, totalMs: 1300 },
        { executionMs: 1200, recognitionMs: null, totalMs: 1200 },
      ]);
      expect(getBestTime('case-1')).toBe(1200);
      expect(getSrsState('case-1')).toMatchObject({
        dueAt: initialDueAt,
        stabilityDays: 2,
        reps: 2,
        lastReviewedAt: secondReviewedAt,
        lastGrade: 'good',
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('records aborted attempts in review history without affecting solve stats or best time', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderHook(() => useTrainingState(selectedCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: false,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: false,
      smartcubeConnected: false,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    act(() => {
      result.current.handleSpaceKeyDown();
      result.current.handleSpaceKeyUp();
    });
    now = 1600;
    act(() => {
      result.current.abortRunningAttempt();
    });

    expect(getAttemptHistory('case-1')).toHaveLength(1);
    expect(getSolveHistory('case-1')).toEqual([]);
    expect(getBestTime('case-1')).toBeNull();
    expect(result.current.practiceCounts['case-1'] ?? 0).toBe(0);
    expect(getReviewHistory('case-1')).toEqual([
      expect.objectContaining({
        grade: 'again',
        aborted: true,
        executionMs: 600,
      }),
    ]);
  });

  it('keeps time-attack aborts out of solve-derived selectors while recording the review', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderTrainingState();

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    act(() => {
      result.current.handleSpaceKeyDown();
      result.current.handleSpaceKeyUp();
    });
    now = 1450;
    act(() => {
      result.current.abortRunningAttempt();
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    expect(getSolveHistory('case-1')).toEqual([]);
    expect(getBestTime('case-1')).toBeNull();
    expect(getTimeAttackLastRuns(createTimeAttackScopeId('PLL', selectedCases.map((selectedCase) => selectedCase.id)))).toEqual([]);
    expect(getReviewHistory('case-1')).toEqual([
      expect.objectContaining({
        grade: 'again',
        aborted: true,
        executionMs: 450,
      }),
    ]);
  });

  it('orders smart order cases within the selected set by urgency, review count, and name', async () => {
    const orderedCases = [
      {
        ...selectedCases[1],
        id: 'case-4',
        name: 'Later',
        smartReviewDue: false,
        smartReviewUrgency: 100,
        reviewCount: 0,
      },
      {
        ...selectedCases[1],
        id: 'case-3',
        name: 'Soon',
        smartReviewDue: true,
        smartReviewUrgency: 5,
        reviewCount: 0,
      },
      {
        ...selectedCases[1],
        id: 'case-2',
        name: 'Bb',
        smartReviewDue: true,
        smartReviewUrgency: 0,
        reviewCount: 2,
      },
      {
        ...selectedCases[0],
        id: 'case-1',
        name: 'Aa',
        smartReviewDue: true,
        smartReviewUrgency: 0,
        reviewCount: 2,
      },
    ];

    const { result } = renderHook(() => useTrainingState(orderedCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: false,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: true,
      smartcubeConnected: false,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });

    act(() => {
      result.current.stopAndRecordSolve(1100);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-3');
    });

    act(() => {
      result.current.stopAndRecordSolve(1200);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-4');
    });
  });

  it('randomizes never-practiced cases under smart order', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const newCases = [
      {
        ...selectedCases[0],
        id: 'case-1',
        name: 'Aa',
        smartReviewDue: true,
        smartReviewUrgency: Number.NEGATIVE_INFINITY,
        reviewCount: 0,
      },
      {
        ...selectedCases[1],
        id: 'case-2',
        name: 'Bb',
        smartReviewDue: true,
        smartReviewUrgency: Number.NEGATIVE_INFINITY,
        reviewCount: 0,
      },
      {
        ...selectedCases[1],
        id: 'case-3',
        name: 'Cc',
        smartReviewDue: true,
        smartReviewUrgency: Number.NEGATIVE_INFINITY,
        reviewCount: 0,
      },
    ];

    try {
      const { result } = renderHook(() => useTrainingState(newCases, 'PLL', {
        selectionChangeMode: 'bulk',
        countdownMode: false,
        randomizeAUF: false,
        randomOrder: false,
        timeAttack: false,
        prioritizeSlowCases: false,
        prioritizeFailedCases: false,
        smartReviewScheduling: true,
        smartcubeConnected: false,
        currentPattern: null,
        statsRefreshToken: 0,
      }));

      await waitFor(() => {
        expect(result.current.currentCase?.id).toBe('case-2');
      });
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('orders upcoming smart-review cases by nearest due date when none are due', async () => {
    const nonDueCases = [
      {
        ...selectedCases[0],
        id: 'case-later',
        name: 'Later',
        smartReviewDue: false,
        smartReviewUrgency: 10_000,
        smartReviewDueAt: 10_000,
        reviewCount: 3,
      },
      {
        ...selectedCases[1],
        id: 'case-sooner',
        name: 'Sooner',
        smartReviewDue: false,
        smartReviewUrgency: 5_000,
        smartReviewDueAt: 5_000,
        reviewCount: 2,
      },
      {
        ...selectedCases[1],
        id: 'case-latest',
        name: 'Latest',
        smartReviewDue: false,
        smartReviewUrgency: 20_000,
        smartReviewDueAt: 20_000,
        reviewCount: 1,
      },
    ];

    const { result } = renderHook(() => useTrainingState(nonDueCases, 'PLL', {
      selectionChangeMode: 'bulk',
      countdownMode: false,
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: true,
      smartcubeConnected: false,
      currentPattern: null,
      statsRefreshToken: 0,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-sooner');
    });

    act(() => {
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-later');
    });

    act(() => {
      result.current.stopAndRecordSolve(1100);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-latest');
    });
  });

  it('rebuilds smart order from refreshed case metadata when a pass wraps', async () => {
    const initialCases = makeSmartReviewCases(3);
    const refreshedCases = [
      {
        ...initialCases[0],
        reviewCount: 3,
        smartReviewDueAt: 50,
        smartReviewDue: false,
        smartReviewUrgency: 50,
      },
      {
        ...initialCases[1],
        reviewCount: 4,
        smartReviewDueAt: 0,
        smartReviewDue: true,
        smartReviewUrgency: 0,
      },
      {
        ...initialCases[2],
        reviewCount: 3,
        smartReviewDueAt: 100,
        smartReviewDue: false,
        smartReviewUrgency: 100,
      },
    ];

    const { result, rerender } = renderSmartReviewState(initialCases);

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });

    act(() => {
      result.current.stopAndRecordSolve(1100);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-3');
    });

    await act(async () => {
      rerender({ currentCases: refreshedCases, currentReviewRefreshToken: 0 });
      await Promise.resolve();
    });

    act(() => {
      result.current.stopAndRecordSolve(1200);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });
  });

  it('rebuilds pending smart order when review metadata refreshes for the same selected ids', async () => {
    const initialCases = [
      {
        ...selectedCases[0],
        id: 'case-1',
        name: 'Aa',
        reviewCount: 3,
        smartReviewDueAt: 100,
        smartReviewDue: false,
        smartReviewUrgency: 100,
      },
      {
        ...selectedCases[1],
        id: 'case-2',
        name: 'Ab',
        reviewCount: 3,
        smartReviewDueAt: 200,
        smartReviewDue: false,
        smartReviewUrgency: 200,
      },
      {
        ...selectedCases[0],
        id: 'case-3',
        name: 'Ac',
        reviewCount: 3,
        smartReviewDueAt: 300,
        smartReviewDue: false,
        smartReviewUrgency: 300,
      },
    ];
    const refreshedCases = [
      {
        ...initialCases[0],
        reviewCount: 0,
        smartReviewDueAt: null,
        smartReviewDue: false,
        smartReviewUrgency: Number.POSITIVE_INFINITY,
      },
      {
        ...initialCases[1],
        reviewCount: 0,
        smartReviewDueAt: 250,
        smartReviewDue: false,
        smartReviewUrgency: 250,
      },
      {
        ...initialCases[2],
        reviewCount: 0,
        smartReviewDueAt: 50,
        smartReviewDue: false,
        smartReviewUrgency: 50,
      },
    ];

    const { result, rerender } = renderSmartReviewState(initialCases, 0);

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    rerender({ currentCases: refreshedCases, currentReviewRefreshToken: 1 });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.activateTimer();
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-3');
    });

    act(() => {
      result.current.activateTimer();
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
    });
  });

  it('repeats failed smart-order cases once later in the same pass with spacing', async () => {
    const cases = makeSmartReviewCases(7);
    const { result } = renderSmartReviewState(cases);

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.handleSmartcubeMove(mockState.patterns['solved:R:U'], 'U');
    });

    await waitFor(() => {
      expect(result.current.failedCounts['case-1']).toBe(1);
    });

    act(() => {
      result.current.stopAndRecordSolve(1000);
    });

    for (const expectedCaseId of ['case-2', 'case-3', 'case-4', 'case-5']) {
      await waitFor(() => {
        expect(result.current.currentCase?.id).toBe(expectedCaseId);
      });

      act(() => {
        result.current.stopAndRecordSolve(1000);
      });
    }

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.handleSmartcubeMove(mockState.patterns['solved:R:U'], 'U');
    });

    await waitFor(() => {
      expect(result.current.failedCounts['case-1']).toBe(2);
    });

    act(() => {
      result.current.stopAndRecordSolve(1000);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-6');
    });
  });

  it('repeats failed smart-order cases in the same pass for smartcube solves', async () => {
    const cases = makeSmartReviewCases(6);
    vi.mocked(cubeTimestampLinearFit).mockReturnValue([{ cubeTimestamp: 1000 }] as any);
    const { result } = renderSmartcubeSmartReviewState(cases);
    let patternKey = 'solved:R';

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    act(() => {
      result.current.handleSmartcubeMove(mockState.patterns['solved:R:U'], 'U');
    });

    await waitFor(() => {
      expect(result.current.failedCounts['case-1']).toBe(1);
    });

    act(() => {
      result.current.handleSmartcubeMove(
        mockState.patterns[patternKey],
        'R',
        [{ face: 0, direction: 1, move: 'R', localTimestamp: 1500, cubeTimestamp: 1000 }],
      );
    });

    for (const expectedCaseId of ['case-2', 'case-3', 'case-4', 'case-5']) {
      await waitFor(() => {
        expect(result.current.currentCase?.id).toBe(expectedCaseId);
      });

      patternKey = `${patternKey}:R`;
      act(() => {
        result.current.handleSmartcubeMove(
          mockState.patterns[patternKey],
          'R',
          [{ face: 0, direction: 1, move: 'R', localTimestamp: 1500, cubeTimestamp: 1000 }],
        );
      });
    }

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });
  });

  it('does not repeat slow hard reviews in the same pass', async () => {
    const cases = makeSmartReviewCases(7);
    mockState.attemptHistory.set('case-1', Array.from({ length: 8 }, (_, index) => ({
      recordedAt: index + 1,
      mode: 'timer',
      executionMs: 1000,
      recognitionMs: null,
      totalMs: 1000,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
      grade: 'good',
    })));

    const { result } = renderSmartReviewState(cases);

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(2000);
    });

    await waitFor(() => {
      expect(getReviewHistory('case-1').at(-1)).toEqual(expect.objectContaining({ grade: 'hard' }));
      expect(result.current.currentCase?.id).toBe('case-2');
    });

    for (const expectedCaseId of ['case-3', 'case-4', 'case-5', 'case-6', 'case-7']) {
      act(() => {
        result.current.stopAndRecordSolve(1000);
      });

      await waitFor(() => {
        expect(result.current.currentCase?.id).toBe(expectedCaseId);
      });
    }
  });
});
