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
