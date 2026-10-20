import { act, renderHook, waitFor } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { cubeTimestampLinearFit } from 'smartcube-web-bluetooth';
import { describe, expect, it, vi } from 'vitest';
import { useTrainingState, type TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getAttemptHistory, getTimeAttackLastRuns } from '../../src/lib/storage';
import { selectedCases } from './useTrainingStateTestUtils';

vi.mock('smartcube-web-bluetooth', () => ({ cubeTimestampLinearFit: vi.fn(() => []) }));

const options: TrainingPracticeOptions = {
  selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

async function tickTimer() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}

describe('guided recovery timer', () => {
  it.each([2, 3].flatMap(size => [false, true].flatMap(timeAttack => [false, true].map(deviceTiming => ({ size, timeAttack, deviceTiming })))))
    ('excludes recovery from the displayed and saved $size×$size time (time attack $timeAttack, device timing $deviceTiming)', async ({ size, timeAttack, deviceTiming }) => {
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      vi.mocked(cubeTimestampLinearFit).mockReturnValue([]);
      if (deviceTiming) {
        vi.mocked(cubeTimestampLinearFit).mockImplementation(moves => moves.map(move => ({
          ...move, cubeTimestamp: (move.localTimestamp ?? 0) - (moves[0].localTimestamp ?? 0),
        })));
      }
      const algorithm = 'R U F';
      const start = (await solvedPattern(size as 2 | 3)).applyAlg(new Alg(algorithm).invert());
      const scope = `${size}-${timeAttack}-${deviceTiming}`;
      const card = { ...selectedCases[0], id: `recovery-timer-${scope}`, algorithm };
      const next = { ...selectedCases[1], id: `after-recovery-${scope}`, algorithm: 'U R' };
      const { result } = renderHook(() => useTrainingState([card, next], 'Custom', {
        ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', timeAttack,
      }));
      await act(async () => { await result.current.trainCurrent(start, {
        algorithm, statsScopeId: timeAttack ? `recovery-session-${scope}` : card.id, preserveDisplayedAlgorithm: true,
      }); });
      let physical = start;
      async function turn(move: string) {
        physical = physical.applyMove(move);
        await act(async () => { result.current.handleSmartcubeMove(fixOrientation(physical), move, [{
          face: -1, direction: 0, move, localTimestamp: now, cubeTimestamp: now - 1000,
        }]); });
      }

      await turn('R');
      now = 1600;
      await turn('B');
      await waitFor(() => expect(result.current.failedCounts[card.id]).toBe(1));
      now = 2000;
      act(() => {
        result.current.beginRecovery(false);
        result.current.setRecoveryGripCheck(() => false);
      });
      const pausedText = result.current.timerText;
      expect(pausedText).toBe('0:01.000');
      expect(result.current.getElapsedMs()).toBe(1000);
      now = 7000;
      await tickTimer();
      expect(result.current.timerText).toBe(pausedText);
      expect(result.current.getElapsedMs()).toBe(1000);
      // Returning the stickers alone cannot resume before grip confirmation.
      now = 8000;
      await turn("B'");
      expect(result.current.checkRecovery(physical)).toBe(false);
      expect(result.current.getElapsedMs()).toBe(1000);
      now = 9000;
      act(() => {
        result.current.setRecoveryGripCheck(() => true);
        expect(result.current.checkRecovery(physical)).toBe(true);
        // The panel unmounts after recovery; this must not resume twice.
        result.current.setRecoveryGripCheck(null);
      });
      expect(result.current.recoveryTarget).toBeNull();
      expect(result.current.timerState).toBe('RUNNING');
      expect(result.current.getElapsedMs()).toBe(1000);
      now = 9500;
      await turn('U');
      await tickTimer();
      expect(result.current.timerText).toBe('0:01.500');
      now = 10000;
      await turn('F');
      expect(getAttemptHistory(card.id)).toMatchObject([{ executionMs: 2000, hadMistake: true }]);
      const sessionId = result.current.statsAlgId;

      // The recovery pause must not leak into the next attempt or be
      // deducted twice from the Time Attack session total.
      physical = result.current.caseStartPattern!;
      now = 10500;
      await turn('U');
      now = 11000;
      await turn('R');
      expect(getAttemptHistory(next.id)).toHaveLength(1);
      if (timeAttack) {
        expect(getTimeAttackLastRuns(sessionId)[0].wallMs).toBe(3000);
        expect(getTimeAttackLastRuns(sessionId)[0].caseTimes[0]).toBe(2000);
      } else {
        expect(result.current.lastSolveText).toBe('0:00.500');
      }
    });

  it('subtracts multiple recovery intervals from one device-timed attempt', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.mocked(cubeTimestampLinearFit).mockReturnValue([{
      face: 0, direction: 1, move: 'L', localTimestamp: 11000, cubeTimestamp: 10000,
    }]);
    const algorithm = 'R U F L';
    const start = (await solvedPattern()).applyAlg(new Alg(algorithm).invert());
    const card = { ...selectedCases[0], id: 'multiple-recovery-pauses', algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'Custom', options));
    await act(async () => { await result.current.trainCurrent(start, { algorithm, statsScopeId: card.id, preserveDisplayedAlgorithm: true }); });
    let physical = start;
    for (const [move, startedAt, resumedAt] of [['R', 2000, 6000], ['U', 7000, 10000]] as const) {
      physical = physical.applyMove(move);
      act(() => { result.current.handleSmartcubeMove(physical, move); });
      act(() => { result.current.handleSmartcubeMove(physical.applyMove('B'), 'B'); });
      now = startedAt;
      act(() => result.current.beginRecovery(false));
      now = resumedAt;
      act(() => { expect(result.current.checkRecovery(physical)).toBe(true); });
    }
    now = 10500;
    physical = physical.applyMove('F');
    act(() => { result.current.handleSmartcubeMove(physical, 'F'); });
    expect(result.current.getElapsedMs()).toBe(2500);
    now = 11000;
    physical = physical.applyMove('L');
    await act(async () => { expect(result.current.handleSmartcubeMove(physical, 'L')).toBe(true); });
    expect(getAttemptHistory(card.id)).toMatchObject([{ executionMs: 3000 }]);
  });

  it.each(['cancel', 'alternatives', 'reset', 'abort'] as const)('clears a recovery pause when users %s', async action => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const start = (await solvedPattern()).applyAlg(new Alg('R U F').invert());
    const { result, rerender } = renderHook(({ alternatives }) => useTrainingState([], 'Custom', {
      ...options, allowAlternativeAlgorithms: alternatives,
    }), { initialProps: { alternatives: false } });
    await act(async () => { await result.current.trainCurrent(start, { algorithm: 'R U F', preserveDisplayedAlgorithm: true }); });
    act(() => { result.current.handleSmartcubeMove(start.applyAlg('R'), 'R'); });
    now = 2000;
    act(() => result.current.beginRecovery(false));
    now = 6000;
    expect(result.current.getElapsedMs()).toBe(1000);
    act(() => {
      if (action === 'cancel') result.current.setRecoveryGripCheck(null);
      if (action === 'alternatives') rerender({ alternatives: true });
      if (action === 'reset') result.current.resetDrill();
      if (action === 'abort') result.current.abortRunningAttempt();
    });
    now = 7000;
    if (action === 'cancel' || action === 'alternatives') {
      expect(result.current.getElapsedMs()).toBe(2000);
    } else {
      await act(async () => { await result.current.trainCurrent(start, { algorithm: 'R U F', preserveDisplayedAlgorithm: true }); });
      act(() => { result.current.handleSmartcubeMove(start.applyMove('R'), 'R'); });
      now = 7500;
      expect(result.current.getElapsedMs()).toBe(500);
    }
  });
});
