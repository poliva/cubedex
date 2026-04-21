import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPracticeOptions } from '../../src/hooks/useTrainingState';

const mockState = vi.hoisted(() => ({
  patterns: {} as Record<string, any>,
  lastTimes: new Map<string, number[]>(),
  solveHistory: new Map<string, Array<{ executionMs: number; recognitionMs: number | null; totalMs: number }>>(),
  bestTimes: new Map<string, number | null>(),
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
    getLastTimes: vi.fn((id: string) => mockState.lastTimes.get(id) ?? []),
    getSolveHistory: vi.fn((id: string) => mockState.solveHistory.get(id) ?? []),
    setBestTime: vi.fn((id: string, value: number) => {
      mockState.bestTimes.set(id, value);
    }),
    setLastTimes: vi.fn((id: string, values: number[]) => {
      mockState.lastTimes.set(id, values);
    }),
    setSolveHistory: vi.fn((id: string, values: Array<{ executionMs: number; recognitionMs: number | null; totalMs: number }>) => {
      mockState.solveHistory.set(id, values);
      mockState.lastTimes.set(id, values.map((entry) => entry.executionMs));
    }),
    getTimeAttackLastRuns: vi.fn(() => []),
    setTimeAttackLastRuns: vi.fn(),
  };
});

import { useTrainingState } from '../../src/hooks/useTrainingState';
import { getBestTime, getLastTimes, getSolveHistory } from '../../src/lib/storage';

function createPattern(key: string) {
  return {
    key,
    patternData: {
      EDGES: { pieces: [key.length], orientation: [0] },
      CORNERS: { pieces: [key.length], orientation: [0] },
      CENTERS: { pieces: [0], orientation: [0] },
    },
    applyMove: vi.fn((move: string) => {
      const nextPattern = mockState.patterns[`${key}:${move}`];
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

const selectedCases = [
  {
    id: 'case-1',
    name: 'Aa',
    algorithm: 'R',
    subset: 'A',
    category: 'PLL',
    learned: 0,
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
    bestTime: null,
    ao5: null,
  },
];

const defaultOptions: TrainingPracticeOptions = {
  selectionChangeMode: 'bulk',
  countdownMode: false,
  randomizeAUF: false,
  randomOrder: false,
  timeAttack: false,
  prioritizeSlowCases: false,
  prioritizeFailedCases: false,
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
    mockState.patterns = {};
    mockState.lastTimes.clear();
    mockState.solveHistory.clear();
    mockState.bestTimes.clear();

    mockState.patterns.solved = createPattern('solved');
    mockState.patterns['solved:R'] = createPattern('solved:R');
    mockState.patterns['solved:R:R'] = createPattern('solved:R:R');
    mockState.patterns['solved:R:R:R'] = createPattern('solved:R:R:R');
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
      mockState.solveHistory.set('case-2', [
        { executionMs: 1000, recognitionMs: null, totalMs: 1000 },
      ]);
      mockState.lastTimes.set('case-2', [1000]);
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
});
