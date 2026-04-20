import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  patterns: {} as Record<string, any>,
  lastTimes: new Map<string, number[]>(),
  bestTimes: new Map<string, number | null>(),
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
    getLastTimes: vi.fn((id: string) => mockState.lastTimes.get(id) ?? []),
    getTimeAttackLastRuns: vi.fn((id: string) => mockState.timeAttackRuns.get(id) ?? []),
    setBestTime: vi.fn((id: string, value: number) => {
      mockState.bestTimes.set(id, value);
    }),
    setLastTimes: vi.fn((id: string, values: number[]) => {
      mockState.lastTimes.set(id, values);
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
  getTimeAttackLastRuns,
} from '../../src/lib/storage';

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

function renderTrainingState() {
  return renderHook(() => useTrainingState(selectedCases, 'PLL', {
    selectionChangeMode: 'bulk',
    randomizeAUF: false,
    randomOrder: false,
    timeAttack: true,
    prioritizeSlowCases: false,
    prioritizeFailedCases: false,
    smartcubeConnected: false,
    currentPattern: null,
    statsRefreshToken: 0,
  }));
}

describe('useTrainingState time attack counts', () => {
  beforeEach(() => {
    mockState.patterns = {};
    mockState.lastTimes.clear();
    mockState.bestTimes.clear();
    mockState.timeAttackRuns.clear();

    mockState.patterns.solved = createPattern('solved');
    mockState.patterns['solved:R'] = createPattern('solved:R');
    mockState.patterns['solved:R:U'] = createPattern('solved:R:U');
    mockState.patterns['solved:R:R'] = createPattern('solved:R:R');
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

    act(() => {
      result.current.stopAndRecordSolve(2300);
    });

    await waitFor(() => {
      expect(result.current.practiceCounts['case-2']).toBe(1);
      expect(result.current.practiceCounts[scopeId]).toBe(1);
    });

    const recordedWallTimes = getLastTimes(scopeId);
    expect(recordedWallTimes).toHaveLength(1);
    expect(getBestTime(scopeId)).toBe(recordedWallTimes[0]);
    expect(getTimeAttackLastRuns(scopeId)).toEqual([
      { wallMs: recordedWallTimes[0], caseTimes: [1200, 2300] },
    ]);
  });
});
