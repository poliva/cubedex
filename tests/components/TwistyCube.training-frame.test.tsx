import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { project2x2TrainingPattern } from '../../src/lib/training-visual';
import { TwistyCube } from '../../src/components/TwistyCube';
import { MainCubeArea } from '../../src/views/MainCubeArea';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { useScrambleState } from '../../src/hooks/useScrambleState';
import { getCaseCards } from '../../src/lib/case-cards';
import { align2x2RecoveryPattern, fixOrientation, get2x2RecoveryMoves } from '../../src/lib/scramble';

const drawing = vi.hoisted(() => ({
  solved: null as KPattern | null,
  current: null as KPattern | null,
  moves: [] as string[],
  resets: 0,
  alg: '',
  setupAlg: '',
  player: null as Record<string, unknown> | null,
}));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: class {
    constructor() {
      const player = document.createElement('div');
      drawing.alg = '';
      drawing.setupAlg = '';
      drawing.player = player as unknown as Record<string, unknown>;
      Object.defineProperty(player, 'alg', { set(value: string) {
        drawing.alg = value;
        drawing.current = drawing.solved!.applyAlg(drawing.setupAlg).applyAlg(value);
        drawing.resets++;
      } });
      Object.defineProperty(player, 'experimentalSetupAlg', { set(value: string) {
        drawing.setupAlg = value;
        drawing.current = drawing.solved!.applyAlg(value).applyAlg(drawing.alg);
      } });
      Object.assign(player, {
        pause: () => {},
        experimentalAddMove: (move: string) => {
          drawing.moves.push(move);
          drawing.current = drawing.current!.applyMove(move);
        },
      });
      return player;
    }
  },
}));

describe('TwistyCube training frame', () => {
  it('preserves the wand setup when returning to training after the first three Ortega PBL cases', async () => {
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const cards = getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL']);
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    let physical = solved;
    const { result } = renderHook(() => ({
      training: useTrainingState(cards, '2x2x2:PBL', {
        puzzle: '2x2x2', selectionChangeMode: 'bulk', countdownMode: false,
        randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
        prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
        currentPattern: fixOrientation(physical),
      }),
      scramble: useScrambleState('2x2x2'),
    }));
    await act(async () => { await result.current.training.trainCurrent(physical, { algorithm: cards[0].algorithm }); });
    for (const card of cards.slice(0, 3)) {
      expect(result.current.training.currentCase?.id).toBe(card.id);
      const turns = new Alg(card.algorithm).expand().toString().split(/\s+/)
        .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
      for (const turn of turns) {
        physical = physical.applyMove(turn);
        await act(async () => { result.current.training.handleSmartcubeMove(fixOrientation(physical), 'F'); });
      }
    }
    const card = result.current.training.currentCase!;
    expect(card.name).toBe('Adj Adj - 2 bars');
    const sensor = fixOrientation(physical);
    const preview = solved.applyAlg(new Alg(card.algorithm).invert());
    await act(async () => {
      await result.current.scramble.startScrambleTo(card.algorithm, card, sensor, false, preview);
      result.current.training.prepareForScramble();
    });
    const target = result.current.scramble.setupTarget!;
    expect(target.isIdentical(preview)).toBe(true);
    physical = align2x2RecoveryPattern(sensor, target);
    physical = physical.applyAlg((await get2x2RecoveryMoves(physical, target)).join(' '));
    await act(async () => {
      result.current.scramble.clearScramble();
      await result.current.training.trainCurrent(target, { algorithm: card.algorithm, preserveDisplayedAlgorithm: true });
    });
    const training = result.current.training;
    const picture = project2x2TrainingPattern(card.algorithm, training.caseStartPattern!,
      training.caseCurrentPattern!, training.casePicturePattern);
    render(<StrictMode><MainCubeArea
      puzzle="2x2x2" alg={new Alg(card.algorithm).invert().toString()}
      targetPattern={picture} fixedOrientation sizePx={420} visualization="3D"
      hintFacelets="none" controlPanel="none" experimentalStickering="full"
      setupAlg="" backView="none" resetToken="fourth-pbl-setup"
      orientationResetToken={0} orientationResetAlg={null}
      gyroscopeEnabled={false} cubeQuaternionRef={{ current: null }}
    /></StrictMode>);
    expect(patternToFacelets(drawing.current!)).toBe(patternToFacelets(physical));
    expect(patternToFacelets(drawing.current!).slice(8, 12)).toBe('FFFF');
  });

  it('keeps the red front and white top of an Adj Adj setup instead of restoring the green-front case', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    const algorithm = "R2 U' B2' U2' R2' U' R2";
    const canonical = solved.applyAlg(new Alg(algorithm).invert());
    const physical = solved.applyAlg('y').applyAlg(new Alg(algorithm).invert());
    expect(patternToFacelets(canonical).slice(8, 12)).toBe('FFFF');
    expect(patternToFacelets(physical).slice(0, 4)).toBe('UUUU');
    expect(patternToFacelets(physical).slice(8, 12)).toBe('RRRR');
    render(<StrictMode><MainCubeArea
      puzzle="2x2x2" alg={new Alg(algorithm).invert().toString()}
      targetPattern={physical} fixedOrientation sizePx={420} visualization="3D"
      hintFacelets="none" controlPanel="none" experimentalStickering="full"
      setupAlg="" backView="none" resetToken="adj-adj-setup"
      orientationResetToken={0} orientationResetAlg={null}
      gyroscopeEnabled={false} cubeQuaternionRef={{ current: null }}
    /></StrictMode>);
    expect(patternToFacelets(drawing.current!)).toBe(patternToFacelets(physical));
  });

  it.each([false, true])('keeps the confirmed setup stickers and viewing angle when training resumes (gyro %s)', async gyroscopeEnabled => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    const physical = solved.applyAlg("x y R F2 U");
    const props = {
      puzzle: '2x2x2' as const, alg: "R U' R'", resetToken: 'wand-setup',
      targetPattern: physical, fixedOrientation: true, sizePx: 420,
      visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: 'z2', backView: 'none' as const,
      orientationResetToken: 1, orientationResetAlg: 'U2',
      appendMoveKey: 'setup-last-turn', appendMove: 'F', gyroscopeEnabled,
      cubeQuaternionRef: { current: { x: 1, y: 0, z: 0, w: 0 } },
    };
    const { rerender } = render(<StrictMode><MainCubeArea {...props} /></StrictMode>);
    expect(drawing.current?.isIdentical(physical)).toBe(true);
    expect(drawing.setupAlg).toBe('');
    expect(drawing.player?.cameraLatitude).toBe(30);
    expect(drawing.player?.cameraLongitude).toBe(30);
    expect(drawing.player?.experimentalDragInput).toBe('none');
    expect(drawing.moves).toEqual([]);
    const next = physical.applyMove('B');
    rerender(<StrictMode><MainCubeArea {...props} targetPattern={next} appendMoveKey="first-algorithm-turn" appendMove="F" /></StrictMode>);
    expect(drawing.current?.isIdentical(next)).toBe(true);
    expect(drawing.moves).toEqual(['B']);
  });

  it('renders selected-case rotation and animates state-derived turns without appending raw aliases twice', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    drawing.resets = 0;
    const algorithm = "R U R'";
    const start = solved.applyAlg('R F2 U');
    const initial = project2x2TrainingPattern(algorithm, start, start.applyAlg("y'"));
    const props = {
      puzzle: '2x2x2' as const, alg: "R U' R'", resetToken: 'case-1',
      targetPattern: initial, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', enableExternalOrientationLoop: false,
      appendMoveKey: 'old', appendMove: 'F', orientationResetAlg: 'U2', orientationResetToken: 1,
    };
    const { rerender } = render(<TwistyCube {...props} />);
    expect(drawing.current?.isIdentical(initial)).toBe(true);
    expect(drawing.moves).toEqual([]);
    const resetsBefore = drawing.resets;

    const after = project2x2TrainingPattern(algorithm, start, start.applyAlg("R y'"));
    rerender(<TwistyCube {...props} targetPattern={after} appendMoveKey="new" appendMove="F" />);
    expect(drawing.current?.isIdentical(after)).toBe(true);
    expect(drawing.moves).toHaveLength(1);
    expect(drawing.resets).toBe(resetsBefore);

    // A report whose frame changes must end at the exact picture, including yaw.
    const reframed = after.applyAlg("y'");
    rerender(<TwistyCube {...props} targetPattern={reframed} appendMoveKey="same-state" />);
    expect(drawing.current?.isIdentical(reframed)).toBe(true);

    // Case transitions replace the base picture and skip the previous raw event.
    const nextAlgorithm = "F U F'";
    const nextStart = start.applyMove('R');
    const next = project2x2TrainingPattern(nextAlgorithm, nextStart, nextStart.applyAlg('y2'));
    const movesBefore = drawing.moves.length;
    rerender(<TwistyCube {...props} alg="F U' F'" resetToken="case-2"
      targetPattern={next} appendMoveKey="same-state" />);
    expect(drawing.current?.isIdentical(next)).toBe(true);
    expect(drawing.moves).toHaveLength(movesBefore);
    rerender(<TwistyCube {...props} alg="F U' F'" resetToken="case-2"
      targetPattern={null} appendMoveKey="same-state" />);
    expect(drawing.moves).toHaveLength(movesBefore);
  });

  it('replaces a multi-turn batch exactly and accepts half turns as two quarter updates', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    const props = { puzzle: '2x2x2' as const, alg: '', targetPattern: solved,
      visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', enableExternalOrientationLoop: false };
    const { rerender } = render(<TwistyCube {...props} />);
    const batched = solved.applyAlg("R U F R'");
    rerender(<TwistyCube {...props} targetPattern={batched} />);
    expect(drawing.current?.isIdentical(batched)).toBe(true);
    drawing.moves = [];
    rerender(<TwistyCube {...props} targetPattern={batched.applyMove('R')} />);
    rerender(<TwistyCube {...props} targetPattern={batched.applyMove('R2')} />);
    expect(drawing.current?.isIdentical(batched.applyMove('R2'))).toBe(true);
    expect(drawing.moves).toEqual(['R', 'R']);
  });
});
