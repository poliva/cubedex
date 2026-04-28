import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
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
import { getBestTime, getLastTimes, getSolveHistory } from '../../src/lib/storage';

const defaultOptions: TrainingPracticeOptions = {
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
};

function renderTrainingState(optionOverrides: Partial<TrainingPracticeOptions> = {}) {
  return renderHook(() => useTrainingState(selectedCases, 'PLL', {
    ...defaultOptions,
    ...optionOverrides,
  }));
}

describe('useTrainingState spacebar timer flow', () => {
  beforeEach(() => {
    resetMockState(mockState);

    mockState.patterns.solved = createPattern(mockState, 'solved');
    const patternKeys = ['solved'];
    let repeatedR = 'solved';
    for (let index = 0; index < 12; index += 1) {
      repeatedR = `${repeatedR}:R`;
      patternKeys.push(repeatedR);
    }
    for (const key of patternKeys) {
      mockState.patterns[key] = createPattern(mockState, key);
    }
  });

  it('stops, records, and advances dumb-cube solves without auto-starting the next case on keyup', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderTrainingState();

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    act(() => {
      result.current.handleSpaceKeyDown();
    });
    act(() => {
      result.current.handleSpaceKeyUp();
    });

    expect(result.current.timerState).toBe('RUNNING');

    now = 2350;

    await act(async () => {
      result.current.handleSpaceKeyDown();
      await Promise.resolve();
      result.current.handleSpaceKeyUp();
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.timerState).toBe('READY');
    });

    expect(result.current.practiceCounts['case-1']).toBe(1);
    expect(getLastTimes('case-1')).toEqual([1350]);
    expect(getSolveHistory('case-1')).toEqual([
      { executionMs: 1350, recognitionMs: null, totalMs: 1350 },
    ]);
    expect(getBestTime('case-1')).toBe(1350);
  });

  it('stores proxy recognition for later keyboard solves after the first case', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderTrainingState();

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    act(() => {
      result.current.stopAndRecordSolve(900);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.timerState).toBe('READY');
    });

    now = 1800;
    act(() => {
      result.current.handleSpaceKeyDown();
      result.current.handleSpaceKeyUp();
    });

    now = 2550;
    await act(async () => {
      result.current.handleSpaceKeyDown();
      await Promise.resolve();
      result.current.handleSpaceKeyUp();
    });

    await waitFor(() => {
      expect(getSolveHistory('case-2')).toEqual([
        { executionMs: 750, recognitionMs: 800, totalMs: 1550 },
      ]);
    });
  });

  it('stores null recognition when proxy recognition exceeds fifteen seconds', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderTrainingState();

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
    });

    act(() => {
      result.current.stopAndRecordSolve(900);
    });

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.timerState).toBe('READY');
    });

    now = 17050;
    act(() => {
      result.current.handleSpaceKeyDown();
      result.current.handleSpaceKeyUp();
    });

    now = 17800;
    await act(async () => {
      result.current.handleSpaceKeyDown();
      await Promise.resolve();
      result.current.handleSpaceKeyUp();
    });

    await waitFor(() => {
      expect(getSolveHistory('case-2')).toEqual([
        { executionMs: 750, recognitionMs: null, totalMs: 750 },
      ]);
    });
  });

  it('ignores keyboard and touch activation during countdown and starts recognition after reveal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    try {
      const { result } = renderTrainingState({ countdownMode: true });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.countdownActive).toBe(true);
      expect(result.current.countdownValue).toBe(3);
      expect(result.current.timerState).toBe('IDLE');

      act(() => {
        result.current.handleSpaceKeyDown();
        result.current.handleSpaceKeyUp();
        result.current.activateTimer();
      });

      expect(result.current.timerState).toBe('IDLE');

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.countdownActive).toBe(false);
      expect(result.current.timerState).toBe('READY');

      act(() => {
        result.current.stopAndRecordSolve(900);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.countdownActive).toBe(true);
      expect(result.current.timerState).toBe('IDLE');

      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.handleSpaceKeyDown();
        result.current.handleSpaceKeyUp();
        result.current.activateTimer();
      });

      expect(result.current.timerState).toBe('IDLE');

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.countdownActive).toBe(false);
      expect(result.current.timerState).toBe('READY');

      act(() => {
        vi.advanceTimersByTime(800);
        result.current.handleSpaceKeyDown();
        result.current.handleSpaceKeyUp();
      });

      act(() => {
        vi.advanceTimersByTime(750);
      });

      await act(async () => {
        result.current.handleSpaceKeyDown();
        await Promise.resolve();
        result.current.handleSpaceKeyUp();
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getSolveHistory('case-2')).toEqual([
        { executionMs: 750, recognitionMs: 800, totalMs: 1550 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps Average TPS available while the countdown is visible for the next case', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());

    try {
      mockState.attemptHistory.set('case-2', [
        {
          recordedAt: 1,
          mode: 'timer',
          executionMs: 1000,
          recognitionMs: null,
          totalMs: 1000,
          hadMistake: false,
          aborted: false,
          timerOnly: true,
          grade: null,
        },
      ]);
      mockState.bestTimes.set('case-2', 1000);

      const { result } = renderTrainingState({ countdownMode: true });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.timerState).toBe('READY');

      act(() => {
        result.current.handleSpaceKeyDown();
        result.current.handleSpaceKeyUp();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await act(async () => {
        result.current.handleSpaceKeyDown();
        await Promise.resolve();
        result.current.handleSpaceKeyUp();
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.currentCase?.id).toBe('case-2');
      expect(result.current.countdownActive).toBe(true);
      expect(result.current.stats.averageTps).toBe('1.00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('labels recent times with 1-based session solve index', async () => {
    vi.spyOn(performance, 'now').mockImplementation(() => 10_000);

    const onlyCase = [selectedCases[0]];

    const { result } = renderHook(() => useTrainingState(onlyCase, 'PLL', {
      ...defaultOptions,
    }));

    await waitFor(() => {
      expect(result.current.currentCase?.id).toBe('case-1');
      expect(result.current.timerState).toBe('READY');
    });

    for (let n = 1; n <= 3; n += 1) {
      act(() => {
        result.current.stopAndRecordSolve(800 + n);
      });
      await waitFor(() => {
        expect(result.current.practiceCounts['case-1']).toBe(n);
      });
    }

    const { lastFive } = result.current.stats;
    expect(lastFive).toHaveLength(3);
    expect(lastFive[0]?.label.startsWith('Time 1:')).toBe(true);
    expect(lastFive[1]?.label.startsWith('Time 2:')).toBe(true);
    expect(lastFive[2]?.label.startsWith('Time 3:')).toBe(true);
  });

  it('labels pre-session history rows as Recorded when session counter was reset', async () => {
    vi.spyOn(performance, 'now').mockImplementation(() => 10_000);

    const priorAttempt = {
      recordedAt: 1,
      mode: 'timer',
      executionMs: 100,
      recognitionMs: null,
      totalMs: 100,
      hadMistake: false,
      aborted: false,
      timerOnly: true,
      grade: 'good' as const,
    };
    mockState.attemptHistory.set('case-1', [priorAttempt, { ...priorAttempt, recordedAt: 2, executionMs: 200, totalMs: 200 }]);

    const onlyCase = [selectedCases[0]];

    const { result } = renderHook(() => useTrainingState(onlyCase, 'PLL', {
      ...defaultOptions,
    }));

    await waitFor(() => {
      expect(result.current.stats.lastFive).toHaveLength(2);
    });

    expect(result.current.stats.lastFive.every((entry) => entry.label.startsWith('Recorded:'))).toBe(true);

    act(() => {
      result.current.stopAndRecordSolve(300);
    });

    await waitFor(() => {
      expect(result.current.practiceCounts['case-1']).toBe(1);
    });

    const { lastFive } = result.current.stats;
    expect(lastFive).toHaveLength(3);
    expect(lastFive[0]?.label.startsWith('Recorded:')).toBe(true);
    expect(lastFive[1]?.label.startsWith('Recorded:')).toBe(true);
    expect(lastFive[2]?.label.startsWith('Time 1:')).toBe(true);
  });
});
