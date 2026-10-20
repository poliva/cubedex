import { act, renderHook, waitFor } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it } from 'vitest';
import { useTrainingState, type TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getAttemptHistory } from '../../src/lib/storage';
import { selectedCases } from './useTrainingStateTestUtils';

const options: TrainingPracticeOptions = {
  selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

const cases = [
  { size: 2 as const, algorithm: "R2 F2' R2'", alternative: 'F2 R2 F2' },
  { size: 3 as const, algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'",
    alternative: new Alg("R U R' U' R' F R2 U' R' U' R U R' F'").invert().toString() },
];

describe('alternative algorithm practice', () => {
  it.each(cases.flatMap(test => [true, false].flatMap(prepared => [true, false].map(timeAttack => ({ ...test, prepared, timeAttack })))))
    ('accepts a different algorithm on $size×$size (prepared $prepared, time attack $timeAttack)', async ({ size, algorithm, alternative, prepared, timeAttack }) => {
      const solved = await solvedPattern(size);
      let physical = prepared ? solved.applyAlg(new Alg(algorithm).invert()) : solved.applyAlg('D R B y');
      const target = physical.applyAlg(algorithm);
      const scope = `alternative-${size}-${prepared}-${timeAttack}`;
      const card = { ...selectedCases[0], id: scope, algorithm };
      const { result } = renderHook(() => useTrainingState([card], 'Custom', {
        ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', allowAlternativeAlgorithms: true, timeAttack,
      }));
      await act(async () => { await result.current.trainCurrent(physical, {
        algorithm, statsScopeId: timeAttack ? `${scope}-session` : scope, preserveDisplayedAlgorithm: true,
      }); });
      const moves = alternative.split(/\s+/).flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
      const resetKey = result.current.visualResetKey;
      for (const [index, move] of moves.entries()) {
        physical = physical.applyMove(move);
        let complete = false;
        await act(async () => { complete = result.current.handleSmartcubeMove(fixOrientation(physical), move); });
        expect(complete, `turn ${index + 1}: ${move}`).toBe(index === moves.length - 1);
        expect(result.current.recoveryTarget).toBeNull();
        expect(result.current.fixText).toBe('');
        expect(result.current.displayMoves.some(move => move.color === 'red')).toBe(false);
        if (index === 0) {
          // A different first turn must remain valid beyond the mistake timer.
          await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
          expect(result.current.helpTone).toBe('hidden');
          expect(result.current.failedCounts[scope]).toBeUndefined();
        }
        if (index < moves.length - 1) {
          expect(result.current.timerState).toBe('RUNNING');
          expect(result.current.visualResetKey).toBe(resetKey);
          expect(getAttemptHistory(scope)).toHaveLength(0);
        }
      }
      expect(fixOrientation(physical).isIdentical(fixOrientation(target))).toBe(true);
      if (prepared) expect(fixOrientation(physical).isIdentical(solved)).toBe(true);
      expect(getAttemptHistory(scope)).toHaveLength(1);
      expect(getAttemptHistory(scope)[0].hadMistake).toBe(false);
      expect(result.current.practiceCounts[scope]).toBe(1);
    });

  it.each(cases)('keeps mistake feedback by default on $size×$size', async ({ size, algorithm, alternative }) => {
    const start = (await solvedPattern(size)).applyAlg(new Alg(algorithm).invert());
    const scope = `alternative-disabled-${size}`;
    const card = { ...selectedCases[0], id: scope, algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'Custom', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3',
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm, statsScopeId: scope, preserveDisplayedAlgorithm: true }); });
    const firstMove = alternative.split(/\s+/)[0][0];
    act(() => { result.current.handleSmartcubeMove(start.applyMove(firstMove), firstMove); });
    await waitFor(() => expect(result.current.failedCounts[scope]).toBe(1));
    expect(result.current.fixVisible).toBe(true);
    expect(result.current.displayMoves.some(move => move.color === 'red')).toBe(true);
    expect(getAttemptHistory(scope)).toHaveLength(0);
  });

  it('releases 2×2 undo recovery when alternative algorithms are enabled mid-attempt', async () => {
    const { algorithm, alternative } = cases[0];
    let physical = (await solvedPattern(2)).applyAlg(new Alg(algorithm).invert());
    const scope = 'alternative-mode-switch';
    const card = { ...selectedCases[0], id: scope, algorithm };
    const { result, rerender } = renderHook(({ enabled }) => useTrainingState([card], 'Custom', {
      ...options, puzzle: '2x2x2', allowAlternativeAlgorithms: enabled,
    }), { initialProps: { enabled: false } });
    await act(async () => { await result.current.trainCurrent(physical, { algorithm, statsScopeId: scope, preserveDisplayedAlgorithm: true }); });
    physical = physical.applyMove('F');
    act(() => { result.current.handleSmartcubeMove(physical, 'F'); });
    expect(result.current.recoveryTarget).not.toBeNull();
    const resetKey = result.current.visualResetKey;
    rerender({ enabled: true });
    expect(result.current.recoveryTarget).toBeNull();
    expect(result.current.visualResetKey).toBe(resetKey);
    expect(result.current.timerState).toBe('RUNNING');
    const remaining = alternative.split(/\s+/).flatMap(move => [move[0], move[0]]).slice(1);
    for (const move of remaining) {
      physical = physical.applyMove(move);
      await act(async () => { result.current.handleSmartcubeMove(physical, move); });
    }
    expect(getAttemptHistory(scope)).toHaveLength(1);
    expect(getAttemptHistory(scope)[0].hadMistake).toBe(false);
  });
});
