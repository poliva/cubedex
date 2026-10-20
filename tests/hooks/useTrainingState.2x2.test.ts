import { act, renderHook, waitFor } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it } from 'vitest';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { selectedCases } from './useTrainingStateTestUtils';
import { getAttemptHistory } from '../../src/lib/storage';
import { solvedPattern } from '../../src/lib/cube-utils';
import { align2x2RecoveryPattern, fixOrientation, get2x2RecoveryMoves } from '../../src/lib/scramble';
import { projectTrainingPattern } from '../../src/lib/training-visual';

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

describe('2×2 state-based undo recovery', () => {
  it.each(['', 'D', 'L B', 'x U'])('resumes the remaining algorithm in the same grip after progress "%s"', async progress => {
    const solved = await solvedPattern(2);
    const remaining = ['R', 'U', 'F'];
    const algorithm = `${progress} ${remaining.join(' ')}`.trim();
    const finish = solved.applyAlg('x y');
    const start = finish.applyAlg(new Alg(algorithm).invert());
    const { result } = renderHook(() => useTrainingState([], 'Custom', {
      puzzle: '2x2x2', selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
      randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false,
      smartcubeConnected: true, currentPattern: start,
    }));
    await act(async () => { await result.current.trainCurrent(start, { algorithm }); });
    expect(result.current.inputMode).toBe(false);
    expect(result.current.displayAlg).toBe(algorithm);
    const anchor = start.applyAlg(progress);
    if (progress) await act(async () => { result.current.handleSmartcubeMove(anchor.applyAlg('y'), 'U'); });
    const current = anchor.applyAlg('F x y');
    await act(async () => { result.current.handleSmartcubeMove(current, 'F'); });
    const target = result.current.recoveryTarget!;
    expect(target).not.toBeNull();
    expect(target.isIdentical(anchor)).toBe(true);
    const picture = align2x2RecoveryPattern(current, target);
    const moves = await get2x2RecoveryMoves(picture, target);
    let physical = picture.applyAlg(moves.join(' '));
    await act(async () => { result.current.handleSmartcubeMove(physical.applyAlg('z'), moves.at(-1)!); });
    expect(result.current.recoveryTarget).toBeNull();
    for (let i = 0; i < remaining.length; i++) {
      physical = physical.applyMove(remaining[i]);
      let completed = false;
      await act(async () => { completed = result.current.handleSmartcubeMove(physical.applyAlg('y'), remaining[i]); });
      expect(result.current.recoveryTarget).toBeNull();
      expect(completed).toBe(i === remaining.length - 1);
    }
    expect(physical.isIdentical(finish)).toBe(true);
  });

  let attemptId = 0;
  async function start() {
    let pattern = (await solvedPattern(2)).applyAlg('F U R');
    const hook = renderHook(() => useTrainingState([], 'Custom', {
      puzzle: '2x2x2', selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
      randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false,
      smartcubeConnected: true, currentPattern: pattern,
    }));
    await act(async () => { await hook.result.current.trainCurrent(pattern, { algorithm: "R U F2 R'", statsScopeId: `recovery-test-${++attemptId}` }); });
    async function turn(move: string, reported = move) {
      pattern = pattern.applyAlg(move);
      let completed = false;
      await act(async () => { completed = hook.result.current.handleSmartcubeMove(pattern, reported); });
      return completed;
    }
    return { ...hook, turn, getPattern: () => pattern };
  }

  it('recovers at index −1, accepts rotated physical undo, and preserves the running attempt', async () => {
    const h = await start();
    await h.turn('F');
    expect(h.result.current.recoveryTarget).not.toBeNull();
    expect(h.result.current.recoveryMoveCount).toBe(1);
    // Undo in an equivalent rotated sensor frame, with an unrelated move token.
    expect(await h.turn("F' x y", 'R')).toBe(false);
    expect(h.result.current.recoveryTarget).toBeNull();
    expect(h.result.current.recoveredAt).toBeGreaterThan(0);
    expect(h.result.current.timerState).toBe('RUNNING');
    expect(h.result.current.stats.hasHistory).toBe(false);
    expect(h.result.current.displayMoves[0].color).toBe('next');
  });

  it('waits for the guided grip check after undo and releases it when the guide closes', async () => {
    const h = await start();
    await h.turn('F');
    act(() => h.result.current.setRecoveryGripCheck(() => false));
    await h.turn("F'");
    expect(h.result.current.recoveryTarget).not.toBeNull();
    expect(h.result.current.checkRecovery(h.getPattern())).toBe(false);
    act(() => h.result.current.setRecoveryGripCheck(null));
    act(() => { expect(h.result.current.checkRecovery(h.getPattern())).toBe(true); });
    expect(h.result.current.recoveryTarget).toBeNull();
  });

  it('preserves the correct index across multiple errors, partial undo, and a misleading inverse token', async () => {
    const h = await start();
    await h.turn('R');
    await h.turn('R');
    await h.turn('F');
    // The token looks like an undo, but the real state is still wrong.
    await h.turn('U', "F'");
    expect(h.result.current.recoveryTarget).not.toBeNull();
    await h.turn("U' F'");
    expect(h.result.current.recoveryTarget).not.toBeNull();
    await h.turn("R'");
    expect(h.result.current.recoveryTarget).toBeNull();
    expect(h.result.current.displayMoves[0].color).toBe('green');
    expect(h.result.current.displayMoves[1].color).toBe('next');
    expect(h.result.current.timerState).toBe('RUNNING');
    expect(await h.turn('U')).toBe(false);
    expect(await h.turn('F')).toBe(false);
    expect(await h.turn('F')).toBe(false);
    expect(await h.turn("R'")).toBe(true);
    expect(h.result.current.stats.practiceCount).toBe(1);
  });

  it('does not record a solve for visiting the algorithm endpoint during recovery', async () => {
    const h = await start();
    await h.turn('F');
    expect(await h.turn("F' R U F2 R'")).toBe(false);
    expect(h.result.current.recoveryTarget).not.toBeNull();
    expect(h.result.current.stats.hasHistory).toBe(false);
    act(() => h.result.current.resetDrill());
    expect(h.result.current.recoveryTarget).toBeNull();
    expect(h.result.current.recoveredAt).toBe(0);
  });
});


it('keeps a failed timed attempt through visual recovery and records completion only once', async () => {
  const algorithm = "R U F R'";
  let pattern = (await solvedPattern(2)).applyAlg(new Alg(algorithm).invert());
  const card = { ...selectedCases[0], id: '2x2-failed-recovery', algorithm };
  const { result } = renderHook(() => useTrainingState([card], 'Custom', {
    puzzle: '2x2x2', selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
    randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
    prioritizeFailedCases: false, smartReviewScheduling: false,
    smartcubeConnected: true, currentPattern: pattern,
  }));
  await act(async () => { await result.current.trainCurrent(pattern, { algorithm }); });
  async function turn(move: string) {
    pattern = pattern.applyAlg(move);
    let completed = false;
    await act(async () => { completed = result.current.handleSmartcubeMove(pattern, move); });
    return completed;
  }
  await turn('R');
  await turn('F');
  await waitFor(() => expect(result.current.failedCounts[card.id]).toBe(1));
  const elapsedBefore = result.current.getElapsedMs();
  await turn("F'");
  expect(result.current.recoveryTarget).toBeNull();
  expect(result.current.failedCounts[card.id]).toBe(1);
  expect(result.current.timerState).toBe('RUNNING');
  expect(result.current.getElapsedMs()).toBeGreaterThanOrEqual(elapsedBefore);
  expect(getAttemptHistory(card.id)).toHaveLength(0);
  await turn('U');
  await turn('F');
  expect(await turn("R'")).toBe(true);
  const attempts = getAttemptHistory(card.id);
  expect(attempts).toHaveLength(1);
  expect(attempts[0].hadMistake).toBe(true);
  expect(attempts[0].aborted).not.toBe(true);
  expect(result.current.practiceCounts[card.id] ?? 0).toBe(0);
});

describe('2×2 PBL orientation between cases', () => {
  it.each([
    { timeAttack: false, frame: 'fixed' },
    { timeAttack: true, frame: 'fixed' },
    { timeAttack: false, frame: 'rotated reports' },
    { timeAttack: true, frame: 'rotated reports' },
    { timeAttack: false, frame: 'y-prime handoffs' },
    { timeAttack: true, frame: 'y-prime handoffs' },
  ])('plays two complete PBL cycles without regripping ($frame, time attack $timeAttack)', async ({ timeAttack, frame }) => {
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const { getCaseCards } = await import('../../src/lib/case-cards');
    const cards = getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL'])
      .map(card => ({ ...card, id: `pbl-frame-${timeAttack}-${frame}-${card.id}` }));
    let pattern = await solvedPattern(2);
    let reportedPattern = pattern;
    let sensorYaw = '';
    const { result } = renderHook(() => useTrainingState(cards, '2x2x2:PBL', {
      puzzle: '2x2x2', selectionChangeMode: 'bulk', countdownMode: false, randomizeAUF: false,
      randomOrder: false, timeAttack, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false,
      smartcubeConnected: true, currentPattern: reportedPattern,
    }));
    await act(async () => { await result.current.trainCurrent(pattern, { algorithm: cards[0].algorithm }); });
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const card of cards) {
        expect(result.current.currentCase?.id).toBe(card.id);
        expect(result.current.displayAlg).toBe(card.algorithm);
        const physicalStart = pattern;
        const selectedCase = pattern.kpuzzle.defaultPattern().applyAlg(new Alg(card.algorithm).invert());
        expect(result.current.caseStartPattern?.isIdentical(physicalStart)).toBe(true);
        const assertPicture = (currentPhysical: typeof pattern, snapshot: typeof pattern, progress: string) => {
          const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
            ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));
          const rotation = rotations.find(r => currentPhysical.applyAlg(r).isIdentical(snapshot));
          expect(rotation).toBeDefined();
          const picture = projectTrainingPattern(card.algorithm, physicalStart, snapshot);
          expect(picture.isIdentical(selectedCase.applyAlg(progress).applyAlg(rotation!))).toBe(true);
        };
        assertPicture(pattern, reportedPattern, '');
        const moves = new Alg(card.algorithm).expand().toString().split(/\s+/).filter(Boolean)
          .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
        let completed = false;
        for (let i = 0; i < moves.length; i++) {
          const physicalMove = moves[i];
          pattern = pattern.applyMove(physicalMove);
          // A 2×2 snapshot can describe the same stickers in a rotated frame.
          // Keep executing in the original grip rather than applying that
          // representational rotation to the next case's physical turn axes.
          if (frame === 'y-prime handoffs' && i === moves.length - 1
            && ['Adj Adj - 2 bars', 'Opp Adj - Bar on bottom'].includes(card.name)) {
            sensorYaw += " y'";
          }
          reportedPattern = frame === 'rotated reports' ? fixOrientation(pattern) : pattern.applyAlg(sensorYaw);
          expect(fixOrientation(reportedPattern).isIdentical(fixOrientation(pattern))).toBe(true);
          assertPicture(pattern, reportedPattern, moves.slice(0, i + 1).join(' '));
          // MY22 reports only U/R/F axes. Progress must follow the actual
          // refreshed stickers even for the B and D turns in this case set.
          const reported = physicalMove.replace('B', 'F').replace('D', 'U');
          await act(async () => { completed = result.current.handleSmartcubeMove(reportedPattern, reported); });
          expect(result.current.recoveryTarget, `${card.name}, cycle ${cycle + 1}, turn ${i + 1}: ${physicalMove}`).toBeNull();
          expect(completed, `${card.name}, cycle ${cycle + 1}, turn ${i + 1}`).toBe(i === moves.length - 1);
        }
        expect(getAttemptHistory(card.id)).toHaveLength(cycle + 1);
      }
      expect(result.current.currentCase?.id).toBe(cards[0].id);
      expect(result.current.displayAlg).toBe(cards[0].algorithm);
    }
  });
});
