import { act, renderHook } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it, vi } from 'vitest';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import type { GyroTrainingEvent } from '../../src/hooks/useSmartcubeConnection';

const options = {
  selectionChangeMode: 'manual' as const, countdownMode: false, randomizeAUF: false,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

describe('training gyro calibration boundaries', () => {
  it('records Always Scramble To changes as context without changing the reference', () => {
    const onGyroTrainingEvent = vi.fn<(event: GyroTrainingEvent) => void>();
    const { rerender } = renderHook(({ alwaysScrambleTo }) => useTrainingState([], 'Custom', {
      ...options, alwaysScrambleTo, onGyroTrainingEvent,
    }), { initialProps: { alwaysScrambleTo: false } });
    rerender({ alwaysScrambleTo: true });
    rerender({ alwaysScrambleTo: false });
    expect(onGyroTrainingEvent.mock.calls.map(([event]) => event)).toEqual([
      { phase: 'context', alwaysScrambleTo: false }, { phase: 'context', alwaysScrambleTo: true },
      { phase: 'context', alwaysScrambleTo: false },
    ]);
  });
  it.each([2, 3] as const)('emits a single physical start frame and completion for a clean %i× attempt, including split half turns', async size => {
    const algorithm = "R U2 R'";
    let physical = (await solvedPattern(size)).applyAlg(new Alg(algorithm).invert());
    const start = physical;
    const onGyroTrainingEvent = vi.fn<(event: GyroTrainingEvent) => void>();
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', currentPattern: start, onGyroTrainingEvent,
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm, preserveDisplayedAlgorithm: true }); });
    expect(onGyroTrainingEvent.mock.calls.find(([event]) => event.phase === 'ready')?.[0]).toMatchObject({ phase: 'ready', algorithm, pattern: start });
    for (const move of ['R', 'U', 'U', "R'"]) {
      physical = physical.applyMove(move);
      act(() => { result.current.handleSmartcubeMove(size === 2 ? fixOrientation(physical) : physical, move); });
    }
    expect(onGyroTrainingEvent.mock.calls.map(([event]) => event.phase)).toEqual(['context', 'ready', 'complete']);
    const completed = onGyroTrainingEvent.mock.calls.find(([event]) => event.phase === 'complete')![0];
    expect(completed.phase === 'complete' && completed.pattern.isIdentical(physical)).toBe(true);
  });

  it.each([2, 3] as const)('excludes recovered %i× attempts from heading calibration', async size => {
    const algorithm = 'R U F';
    const start = (await solvedPattern(size)).applyAlg(new Alg(algorithm).invert());
    const onGyroTrainingEvent = vi.fn<(event: GyroTrainingEvent) => void>();
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', currentPattern: start, onGyroTrainingEvent,
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm }); });
    act(() => { result.current.handleSmartcubeMove(start.applyAlg('R'), 'R'); });
    act(() => result.current.beginRecovery(false));
    expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'cancel' && event.reason === 'recovery')).toBe(true);
    expect(onGyroTrainingEvent.mock.calls.at(-1)?.[0]).toEqual({ phase: 'guided-recovery-start' });
    act(() => { result.current.handleSmartcubeMove(start.applyAlg(algorithm), 'F'); });
    expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'complete')).toBe(false);
  });

  it.each([2, 3] as const)('publishes a %i× guided grip only after sticker and grip confirmation, exactly once', async size => {
    const start = (await solvedPattern(size)).applyAlg(new Alg('R U F').invert());
    const onGyroTrainingEvent = vi.fn<(event: GyroTrainingEvent) => void>();
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      ...options, puzzle: size === 2 ? '2x2x2' : '3x3x3', currentPattern: start, onGyroTrainingEvent,
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm: 'R U F' }); });
    act(() => { result.current.handleSmartcubeMove(start.applyMove('R'), 'R'); result.current.beginRecovery(false); });
    const target = result.current.recoveryTarget!;
    act(() => result.current.setRecoveryGripCheck(() => false));
    act(() => { expect(result.current.checkRecovery(target)).toBe(false); });
    expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'guided-recovery-complete')).toBe(false);
    act(() => result.current.setRecoveryGripCheck(() => true));
    act(() => { expect(result.current.checkRecovery(target)).toBe(true); });
    act(() => { result.current.checkRecovery(target); result.current.setRecoveryGripCheck(null); });
    const confirmations = onGyroTrainingEvent.mock.calls.filter(([event]) => event.phase === 'guided-recovery-complete');
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0][0]).toMatchObject({ pattern: target });
    expect(result.current.recoveryTarget).toBeNull();
    expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'guided-recovery-cancel')).toBe(false);
  });

  it('marks alternative algorithms as ineligible and cancels on returning to the editor', async () => {
    const start = await solvedPattern(3);
    const onGyroTrainingEvent = vi.fn<(event: GyroTrainingEvent) => void>();
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      ...options, allowAlternativeAlgorithms: true, currentPattern: start, onGyroTrainingEvent,
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm: 'R U' }); });
    expect(onGyroTrainingEvent.mock.calls.find(([event]) => event.phase === 'ready')?.[0]).toMatchObject({ phase: 'ready', reason: 'alternative-algorithms-enabled' });
    act(() => result.current.enterInputMode());
    expect(onGyroTrainingEvent.mock.calls.at(-1)?.[0].phase).toBe('cancel');
  });
});
