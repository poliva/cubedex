import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTrainingState, type TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getAttemptHistory } from '../../src/lib/storage';
import { selectedCases } from './useTrainingStateTestUtils';

const options: TrainingPracticeOptions = {
  selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: true,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

describe('random AUF move equivalence', () => {
  const routes = [
    { auf: "U'", random: 0.3, turns: ['U', 'U', 'U'] },
    { auf: 'U', random: 0, turns: ["U'", "U'", "U'"] },
    { auf: 'U2', random: 0.6, turns: ['U', 'U'] },
    { auf: 'U2', random: 0.6, turns: ["U'", "U'"] },
  ];

  const scenarios = ([2, 3] as const).flatMap(size => routes.map(route => ({ size, ...route })));

  it.each(scenarios)('accepts $turns for an initial $auf on cube size $size', async ({ size, auf, random, turns }) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    const algorithm = "R U R' U R U2 R'";
    const scope = `auf-${size}-${auf}-${turns[0]}`;
    const card = { ...selectedCases[0], id: scope, category: 'OLL', algorithm };
    const onGyroTrainingEvent = vi.fn();
    const { result } = renderHook(() => useTrainingState([card], 'OLL', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', onGyroTrainingEvent,
    }));
    await act(async () => { await result.current.trainCurrent(await solvedPattern(size), { algorithm, statsScopeId: scope }); });
    expect(result.current.displayAlg.split(/\s+/)[0]).toBe(auf);
    let physical = result.current.caseStartPattern!;
    const moves = [...turns, 'R', 'U', "R'", 'U', 'R', 'U', 'U', "R'"];
    for (const [index, move] of moves.entries()) {
      physical = physical.applyMove(move);
      let completed = false;
      await act(async () => { completed = result.current.handleSmartcubeMove(fixOrientation(physical), move); });
      expect(completed, `turn ${index + 1}: ${move}`).toBe(index === moves.length - 1);
      expect(result.current.recoveryTarget).toBeNull();
      expect(result.current.displayMoves.some(entry => entry.color === 'red')).toBe(false);
      if (index < turns.length - 1) {
        expect(result.current.displayMoves[0].color).toBe('blue');
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
        expect(result.current.fixVisible).toBe(false);
        expect(result.current.failedCounts[scope]).toBeUndefined();
      }
    }
    expect(getAttemptHistory(scope)).toHaveLength(1);
    expect(getAttemptHistory(scope)[0].hadMistake).toBe(false);
    expect(result.current.practiceCounts[scope]).toBe(1);
    expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'cancel')).toBe(false);
  });

  it.each([2, 3] as const)('still flags a different face turn during the starting AUF on cube size %i', async size => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const algorithm = "R U R' U R U2 R'";
    const scope = `wrong-auf-${size}`;
    const card = { ...selectedCases[0], id: scope, category: 'OLL', algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'OLL', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3',
    }));
    await act(async () => { await result.current.trainCurrent(await solvedPattern(size), { algorithm, statsScopeId: scope }); });
    let physical = result.current.caseStartPattern!;
    for (const move of ['U', 'R']) {
      physical = physical.applyMove(move);
      act(() => { result.current.handleSmartcubeMove(fixOrientation(physical), move); });
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(result.current.fixVisible).toBe(true);
    expect(result.current.failedCounts[scope]).toBe(1);
    expect(getAttemptHistory(scope)).toHaveLength(0);
  });
});
