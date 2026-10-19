import { act, renderHook } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it } from 'vitest';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';

// Exercise real corner patterns through training, without the pattern mocks used
// by the queue/timer tests.
describe('2×2 smartcube training', () => {
  it.each([
    { algorithm: "R U R' U'", physicalMoves: ['R', 'U', "R'", "U'"] },
    { algorithm: "x U R U' R' x'", physicalMoves: ['F', 'R', "F'", "R'"] },
  ])('completes $algorithm from native 2×2 face turns', async ({ algorithm, physicalMoves }) => {
    let pattern = (await solvedPattern(2)).applyAlg(Alg.fromString(algorithm).invert());
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
      randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false,
      smartcubeConnected: true, currentPattern: pattern,
    }));
    await act(async () => { await result.current.trainCurrent(pattern, { algorithm }); });
    let completed = false;
    for (const move of physicalMoves) {
      pattern = pattern.applyMove(move);
      await act(async () => { completed = result.current.handleSmartcubeMove(pattern, move); });
      expect(result.current.fixText).toBe('');
    }
    expect(completed).toBe(true);
    expect(result.current.fixText).toBe('');
  });
});

// Non-cube notation must never enter the cube-only Bluetooth pattern matcher.
describe('keyboard puzzle training', () => {
  it.each([
    ['pyraminx', "R U R' u"],
    ['4x4x4', "2R2 U2 2R2 Uw2 2R2 Uw2"],
    ['5x5x5', "Rw U2 3Rw U2 3Rw' Rw'"],
    ['megaminx', "R' BR' R BR R' F' R BR' R' BR F R"],
  ] as const)('prepares and times %s algorithms', async (puzzle, algorithm) => {
    const { result } = renderHook(() => useTrainingState([], `${puzzle}:Custom`, {
      puzzle, selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: true,
      randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: false,
    }));
    await act(async () => { await result.current.trainCurrent(null, { algorithm }); });
    expect(result.current.displayAlg).toBe(algorithm);
    expect(result.current.timerState).toBe('READY');
    act(() => result.current.activateTimer());
    expect(result.current.timerState).toBe('RUNNING');
    act(() => result.current.resetDrill());
    expect(result.current.timerState).toBe('IDLE');
    expect(result.current.displayAlg).toBe('');
  });

  it('does not reveal an old case after a puzzle switch resets the drill', async () => {
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
      randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: false,
    }));
    await act(async () => {
      const pending = result.current.trainCurrent(null, { algorithm: 'R U' });
      result.current.resetDrill();
      await pending;
    });
    expect(result.current.timerState).toBe('IDLE');
    expect(result.current.displayAlg).toBe('');
  });
});
