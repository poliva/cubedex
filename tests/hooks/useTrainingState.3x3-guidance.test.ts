import { act, renderHook, waitFor } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it } from 'vitest';
import { useScrambleState } from '../../src/hooks/useScrambleState';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { alignForGuidance, fixOrientation, getGuidanceMoves } from '../../src/lib/scramble';
import { getAttemptHistory } from '../../src/lib/storage';
import { selectedCases } from './useTrainingStateTestUtils';

const options = {
  puzzle: '3x3x3' as const, selectionChangeMode: 'manual' as const, countdownMode: false,
  randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

describe('3×3 setup and recovery', () => {
  it.each(["R U R' U'", "x R U2 R' x'", "M2 U M2 U2 M2 U M2"])
    ('prepares %s and continues in the pictured grip', async algorithm => {
      const solved = await solvedPattern(3);
      const preview = solved.applyAlg('y').applyAlg(new Alg(algorithm).invert());
      const sensor = solved.applyAlg('R F U x y');
      const { result } = renderHook(() => ({
        scramble: useScrambleState('3x3x3'),
        training: useTrainingState([], 'Custom', options),
      }));
      await act(async () => {
        await result.current.scramble.startScrambleTo(algorithm, null, sensor, false, preview);
      });
      const target = result.current.scramble.setupTarget!;
      expect(target.isIdentical(preview)).toBe(true);
      const physical = alignForGuidance(sensor, target).applyAlg(result.current.scramble.scrambleText);
      expect(physical.isIdentical(preview)).toBe(true);
      await act(async () => {
        await result.current.training.trainCurrent(target, { algorithm, preserveDisplayedAlgorithm: true });
      });
      expect(result.current.training.casePicturePattern?.isIdentical(physical)).toBe(true);
      expect(result.current.training.displayAlg).toBe(algorithm);
      await act(async () => {
        expect(result.current.training.handleSmartcubeMove(physical.applyAlg(algorithm), 'U')).toBe(true);
      });
      expect(fixOrientation(physical.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
    });

  it.each(['', 'R', 'x R', 'M'])('recovers after %s without restarting the attempt or accepting a later endpoint', async progress => {
    const solved = await solvedPattern(3);
    const remaining = ['U', 'F2', 'L'];
    const algorithm = `${progress} ${remaining.join(' ')}`;
    const finish = solved.applyAlg('y');
    const start = finish.applyAlg(new Alg(algorithm).invert());
    const scope = `3x3-guidance-${progress}`;
    const card = { ...selectedCases[0], id: scope, algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'Custom', options));
    await act(async () => { await result.current.trainCurrent(start, { algorithm, statsScopeId: scope, preserveDisplayedAlgorithm: true }); });
    const anchor = start.applyAlg(progress);
    if (progress) await act(async () => { result.current.handleSmartcubeMove(anchor.applyAlg('z'), 'R'); });
    await act(async () => { result.current.handleSmartcubeMove(anchor.applyAlg('D x'), 'D'); });
    await waitFor(() => expect(result.current.failedCounts[scope]).toBe(1));
    const resetKey = result.current.visualResetKey;
    const highlights = result.current.displayMoves.map(move => ({ ...move }));
    expect(result.current.timerState).toBe('RUNNING');
    act(() => result.current.beginRecovery());
    expect(result.current.recoveryTarget?.isIdentical(anchor)).toBe(true);
    expect(result.current.checkRecovery(finish)).toBe(false);
    await act(async () => { expect(result.current.handleSmartcubeMove(finish, 'L')).toBe(false); });
    expect(result.current.recoveryTarget?.isIdentical(anchor)).toBe(true);
    expect(getAttemptHistory(scope)).toHaveLength(0);
    let physical = alignForGuidance(finish, anchor);
    const corrections = await getGuidanceMoves(physical, anchor);
    physical = physical.applyAlg(corrections.join(' '));
    // A mounted visual guide can hold completion until the physical grip fits.
    act(() => result.current.setRecoveryGripCheck(() => false));
    await act(async () => { result.current.handleSmartcubeMove(physical, corrections.at(-1)!); });
    expect(result.current.recoveryTarget?.isIdentical(anchor)).toBe(true);
    expect(result.current.checkRecovery(physical)).toBe(false);
    act(() => result.current.setRecoveryGripCheck(() => true));
    // Child effects in the panel run before the app consumes this same packet.
    act(() => { expect(result.current.checkRecovery(physical)).toBe(true); });
    await act(async () => { result.current.handleSmartcubeMove(physical.applyAlg('y'), corrections.at(-1)!); });
    expect(physical.isIdentical(anchor)).toBe(true);
    expect(result.current.recoveryTarget).toBeNull();
    expect(result.current.visualResetKey).toBe(resetKey);
    expect(result.current.timerState).toBe('RUNNING');
    expect(result.current.displayMoves.filter(move => move.color === 'green')).toEqual(highlights.filter(move => move.color === 'green'));
    expect(result.current.caseCurrentPattern?.isIdentical(anchor)).toBe(true);
    for (let i = 0; i < remaining.length; i++) {
      physical = physical.applyMove(remaining[i]);
      await act(async () => {
        expect(result.current.handleSmartcubeMove(physical.applyAlg('x y'), remaining[i])).toBe(i === remaining.length - 1);
      });
      if (i < remaining.length - 1) expect(result.current.caseCurrentPattern?.isIdentical(physical)).toBe(true);
    }
    expect(physical.isIdentical(finish)).toBe(true);
    expect(getAttemptHistory(scope)).toHaveLength(1);
    expect(getAttemptHistory(scope)[0].hadMistake).toBe(true);
  });
});
