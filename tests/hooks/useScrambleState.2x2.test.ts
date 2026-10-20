import { act, renderHook } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { describe, expect, it } from 'vitest';
import { useScrambleState } from '../../src/hooks/useScrambleState';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { getCaseCards } from '../../src/lib/case-cards';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { getAttemptHistory } from '../../src/lib/storage';
import { align2x2RecoveryPattern, fixOrientation } from '../../src/lib/scramble';
import { projectTrainingPattern } from '../../src/lib/training-visual';

const options = {
  puzzle: '2x2x2' as const, selectionChangeMode: 'manual' as const, countdownMode: false,
  randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};

describe('2×2 physical setup and execution', () => {
  it.each(['', 'y', "x y'"])("keeps the requested case preview's exact colors and orientation (%s)", async frame => {
    const solved = await solvedPattern(2);
    const algorithm = "R2 U' B2' U2' R2' U' R2";
    const preview = solved.applyAlg(frame).applyAlg(new Alg(algorithm).invert());
    const sensor = solved.applyAlg("y R F U");
    const { result } = renderHook(() => useScrambleState('2x2x2'));
    await act(async () => { await result.current.startScrambleTo(algorithm, null, sensor, false, preview); });
    expect(result.current.setupTarget?.isIdentical(preview)).toBe(true);
    const reference = align2x2RecoveryPattern(sensor, preview);
    const physical = reference.applyAlg(result.current.scrambleText);
    expect(patternToFacelets(physical)).toBe(patternToFacelets(preview));
    expect(physical.applyAlg(algorithm).isIdentical(solved.applyAlg(frame))).toBe(true);
  });

  it('keeps the setup target and turn frame through rotated snapshots and misleading move codes', async () => {
    const solved = await solvedPattern(2);
    const algorithm = "R2 U' B2 U2 R2 U' R2";
    const sensor = solved.applyAlg('R F U');
    const { result } = renderHook(() => useScrambleState('2x2x2'));
    await act(async () => { await result.current.startScrambleTo(algorithm, null, sensor); });
    const target = result.current.setupTarget!;
    expect(target).not.toBeNull();
    let physical = sensor;
    const first = result.current.scrambleText.split(/\s+/)[0];
    // The reported token claims the planned turn, but stickers are unchanged.
    await act(async () => { expect(await result.current.advanceScramble(first, sensor.applyAlg('x y'))).toBe(false); });
    expect(result.current.setupTarget).toBe(target);
    expect(align2x2RecoveryPattern(sensor, target).applyAlg(result.current.scrambleText).isIdentical(target)).toBe(true);
    // Correct displayed turns with arbitrary tokens and changing report frames.
    let complete = false;
    for (let i = 0; i < 40 && !complete; i++) {
      physical = align2x2RecoveryPattern(physical, target);
      const turn = result.current.scrambleText.split(/\s+/)[0];
      physical = physical.applyMove(turn);
      await act(async () => { complete = await result.current.advanceScramble('F', physical.applyAlg(i % 2 ? 'z' : 'x y')); });
      if (!complete) expect(result.current.setupTarget).toBe(target);
    }
    expect(complete).toBe(true);
    expect(physical.isIdentical(target)).toBe(true);
    expect(fixOrientation(physical.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
    expect(result.current.setupTarget).toBeNull();
  });

  it.each(["R U R' U'", "R2 U' B2' U2' R2' U' R2", "R' D R' F2 R D' R"])
    ('sets up and solves %s in the confirmed grip, with matching stickers and highlights', async algorithm => {
      const solved = await solvedPattern(2);
      const target = solved.applyAlg(new Alg(algorithm).invert());
      let sensor = solved.applyAlg('x y R U');
      const { result } = renderHook(() => ({
        training: useTrainingState([], '2x2x2:Custom', { ...options, alwaysScrambleTo: true, currentPattern: sensor }),
        scramble: useScrambleState('2x2x2'),
      }));
      await act(async () => { await result.current.training.trainCurrent(sensor, { algorithm }); });
      expect(result.current.training.casePicturePattern).toBeNull();
      await act(async () => {
        expect(await result.current.scramble.startScrambleTo(algorithm, null, sensor, false)).toBe(true);
        result.current.training.prepareForScramble();
      });
      sensor = align2x2RecoveryPattern(sensor, result.current.scramble.setupTarget!);
      let complete = false;
      for (let i = 0; i < 100 && !complete; i++) {
        const first = result.current.scramble.scrambleText.split(/\s+/)[0];
        expect(first).toMatch(/^[URF](2|')?$/);
        const move = first.endsWith('2') ? first[0] : first;
        sensor = sensor.applyMove(move);
        await act(async () => { complete = await result.current.scramble.advanceScramble(move, sensor); });
      }
      expect(complete).toBe(true);
      expect(fixOrientation(sensor.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
      expect(sensor.isIdentical(target)).toBe(true);
      await act(async () => {
        await result.current.training.trainCurrent(sensor, {
          algorithm, preserveDisplayedAlgorithm: true, statsScopeId: `physical-setup-${algorithm}`,
        });
      });
      const picture = () => projectTrainingPattern(result.current.training.displayAlg,
        result.current.training.caseStartPattern!, sensor, result.current.training.casePicturePattern);
      expect(patternToFacelets(picture())).toBe(patternToFacelets(sensor));
      expect(result.current.training.displayAlg).toBe(algorithm);
      const resetKey = result.current.training.visualResetKey;
      const moves = new Alg(algorithm).expand().toString().split(/\s+/)
        .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        sensor = sensor.applyMove(move);
        // Opposite-layer turns can have aliased U/R/F device tokens. Use the
        // authoritative sticker state to judge every quarter of the algorithm.
        const reported = move.replace('B', 'F').replace('D', 'U');
        let completed = false;
        await act(async () => { completed = result.current.training.handleSmartcubeMove(sensor, reported); });
        expect(completed).toBe(i === moves.length - 1);
        expect(result.current.training.recoveryTarget).toBeNull();
        if (!completed) {
          expect(patternToFacelets(picture())).toBe(patternToFacelets(sensor));
          expect(result.current.training.visualResetKey).toBe(resetKey);
        }
      }
      expect(fixOrientation(sensor).isIdentical(solved)).toBe(true);
      expect(result.current.training.stats.practiceCount).toBe(1);
    });

  it('recognizes an already prepared rotated case when Always Scramble To is enabled without restarting training', async () => {
    const algorithm = "R U R' U'";
    const solved = await solvedPattern(2);
    const sensor = solved.applyAlg("y'").applyAlg(new Alg(algorithm).invert());
    const { result, rerender } = renderHook(({ enabled }) => useTrainingState([], '2x2x2:Custom', {
      ...options, alwaysScrambleTo: enabled, currentPattern: sensor,
    }), { initialProps: { enabled: false } });
    await act(async () => { await result.current.trainCurrent(sensor, { algorithm }); });
    const resetKey = result.current.visualResetKey;
    expect(result.current.casePicturePattern).toBeNull();
    rerender({ enabled: true });
    const picture = projectTrainingPattern(result.current.displayAlg,
      result.current.caseStartPattern!, sensor, result.current.casePicturePattern);
    expect(picture.isIdentical(sensor)).toBe(true);
    expect(result.current.displayAlg).toBe(algorithm);
    expect(result.current.timerState).toBe('READY');
    expect(result.current.visualResetKey).toBe(resetKey);
    expect(result.current.stats.hasHistory).toBe(false);
  });

  it('keeps the case preview for unrelated stickers and resets physical matching for the next ordinary attempt', async () => {
    const algorithm = "R U R' U'";
    const solved = await solvedPattern(2);
    let sensor = solved.applyAlg('R U F2');
    const { result } = renderHook(() => useTrainingState([], '2x2x2:Custom', { ...options, currentPattern: sensor }));
    await act(async () => { await result.current.trainCurrent(sensor, { algorithm, preserveDisplayedAlgorithm: true }); });
    expect(result.current.casePicturePattern).toBeNull();
    sensor = solved.applyAlg('x y').applyAlg(new Alg(algorithm).invert());
    await act(async () => { await result.current.trainCurrent(sensor, { algorithm, preserveDisplayedAlgorithm: true }); });
    expect(result.current.casePicturePattern?.isIdentical(sensor)).toBe(true);
    await act(async () => { await result.current.trainCurrent(sensor, { algorithm }); });
    expect(result.current.casePicturePattern).toBeNull();
    act(() => result.current.enterInputMode());
    expect(result.current.caseStartPattern).toBeNull();
    expect(result.current.casePicturePattern).toBeNull();
  });

  it('confirms an equivalent case in the pictured algorithm grip without unnecessary layer turns', async () => {
    const algorithm = "R2 U' B2' U2' R2' U' R2";
    const solved = await solvedPattern(2);
    const canonical = solved.applyAlg(new Alg(algorithm).invert());
    let sensor = canonical.applyAlg("y'");
    expect(fixOrientation(sensor).isIdentical(fixOrientation(canonical))).toBe(true);
    expect(fixOrientation(sensor.applyAlg(algorithm)).isIdentical(solved)).toBe(false);
    const { result } = renderHook(() => ({
      training: useTrainingState([], '2x2x2:Custom', { ...options, alwaysScrambleTo: true, currentPattern: sensor }),
      scramble: useScrambleState('2x2x2'),
    }));
    await act(async () => { await result.current.training.trainCurrent(sensor, { algorithm }); });
    expect(result.current.training.casePicturePattern).toBeNull();
    await act(async () => {
      expect(await result.current.scramble.startScrambleTo(algorithm, null, sensor)).toBe(true);
    });
    sensor = align2x2RecoveryPattern(sensor, result.current.scramble.setupTarget!);
    expect(sensor.isIdentical(canonical)).toBe(true);
    expect(result.current.scramble.scrambleText).toBe('');
    await act(async () => { expect(await result.current.scramble.advanceScramble('', sensor)).toBe(true); });
    expect(fixOrientation(sensor.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
  });

  it('sets up and solves two full PBL cycles with Always Scramble To and no regrips', async () => {
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const cards = getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL'])
      .map(card => ({ ...card, id: `always-setup-cycle-${card.id}` }));
    const solved = await solvedPattern(2);
    let sensor = solved.applyAlg('x y R F U');
    const { result } = renderHook(() => ({
      training: useTrainingState(cards, '2x2x2:PBL', {
        ...options, selectionChangeMode: 'bulk', alwaysScrambleTo: true, currentPattern: sensor,
      }),
      scramble: useScrambleState('2x2x2'),
    }));
    await act(async () => { await result.current.training.trainCurrent(sensor, { algorithm: cards[0].algorithm }); });
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const card of cards) {
        expect(result.current.training.currentCase?.id).toBe(card.id);
        expect(result.current.training.displayAlg).toBe(card.algorithm);
        let started = false;
        await act(async () => {
          started = await result.current.scramble.startScrambleTo(card.algorithm, card, sensor);
          if (started) result.current.training.prepareForScramble();
        });
        if (started) {
          sensor = align2x2RecoveryPattern(sensor, result.current.scramble.setupTarget!);
          let complete = false;
          for (let i = 0; i < 100 && !complete; i++) {
            const first = result.current.scramble.scrambleText.split(/\s+/)[0];
            expect(first).toMatch(/^[URF](2|')?$/);
            const move = first.endsWith('2') ? first[0] : first;
            sensor = sensor.applyMove(move);
            await act(async () => { complete = await result.current.scramble.advanceScramble(move, sensor); });
          }
          expect(complete, `${card.name}, cycle ${cycle + 1}: setup`).toBe(true);
          await act(async () => {
            await result.current.training.trainCurrent(sensor, {
              algorithm: card.algorithm, preserveDisplayedAlgorithm: true, statsScopeId: card.id,
            });
          });
        }
        expect(result.current.training.casePicturePattern?.isIdentical(sensor)).toBe(true);
        const moves = new Alg(card.algorithm).expand().toString().split(/\s+/).filter(Boolean)
          .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
        for (let i = 0; i < moves.length; i++) {
          const move = moves[i];
          sensor = sensor.applyMove(move);
          const picture = projectTrainingPattern(card.algorithm,
            result.current.training.caseStartPattern!, sensor, result.current.training.casePicturePattern);
          expect(picture.isIdentical(sensor)).toBe(true);
          let completed = false;
          const reported = move.replace('B', 'F').replace('D', 'U').replace('L', 'R');
          await act(async () => { completed = result.current.training.handleSmartcubeMove(sensor, reported); });
          expect(result.current.training.recoveryTarget, `${card.name}: ${move}`).toBeNull();
          expect(completed, `${card.name}: ${move}`).toBe(i === moves.length - 1);
        }
        expect(fixOrientation(sensor).isIdentical(solved), `${card.name}, cycle ${cycle + 1}: solved`).toBe(true);
        expect(getAttemptHistory(card.id)).toHaveLength(cycle + 1);
      }
      expect(result.current.training.currentCase?.id).toBe(cards[0].id);
    }
  }, 20000);
});
