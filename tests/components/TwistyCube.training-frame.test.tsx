import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import * as THREE from 'three';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { projectTrainingPattern } from '../../src/lib/training-visual';
import { TwistyCube } from '../../src/components/TwistyCube';
import { MainCubeArea } from '../../src/views/MainCubeArea';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { useScrambleState } from '../../src/hooks/useScrambleState';
import { getCaseCards } from '../../src/lib/case-cards';
import { align2x2RecoveryPattern, alignForGuidance, fixOrientation, get2x2RecoveryMoves } from '../../src/lib/scramble';
import { guidanceFrameRotation, HOME_ORIENTATION } from '../../src/lib/cube-orientation';
import { referenceViewOrientation, type TrainingCubeView } from '../../src/lib/training-cube-view';

const drawing = vi.hoisted(() => ({
  solved: null as KPattern | null,
  current: null as KPattern | null,
  moves: [] as string[],
  resets: 0,
  alg: '',
  setupAlg: '',
  player: null as Record<string, unknown> | null,
  object: null as THREE.Object3D | null,
  renders: 0,
}));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: class {
    constructor() {
      const player = document.createElement('div');
      drawing.alg = '';
      drawing.setupAlg = '';
      drawing.player = player as unknown as Record<string, unknown>;
      const object = new THREE.Object3D();
      drawing.object = object;
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
        experimentalCurrentVantages: async () => [{ render: () => { drawing.renders++; } }],
        experimentalCurrentThreeJSPuzzleObject: async () => object,
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
  function orientationFrames() {
    const pending = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      pending.set(++id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(frame => { pending.delete(frame); });
    return {
      pending,
      async advance(count = 1) {
        for (let i = 0; i < count; i++) {
          const callbacks = [...pending.values()];
          pending.clear();
          await act(async () => { for (const callback of callbacks) callback(i * 16); });
        }
      },
    };
  }

  it.each([2, 3] as const)('keeps size %i tilt live while ready and preserves it through execution and completion', async size => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const frames = orientationFrames();
    drawing.solved = await solvedPattern(size);
    const picture = drawing.solved.applyAlg('R U F');
    const frame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const turn = (axis: 'x' | 'y', degrees: number) => new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, 0), degrees * Math.PI / 180);
    const drifted = HOME_ORIENTATION.clone().multiply(turn('y', 40)).multiply(turn('x', 20));
    const cubeQuaternionRef = { current: drifted.clone().multiply(frame.clone().invert()) };
    const trainingViewRef = { current: { phase: 'ready', anchor: null } as TrainingCubeView };
    const props = { puzzle: size === 2 ? '2x2x2' as const : '3x3x3' as const, alg: '', targetPattern: picture,
      fixedOrientation: true, sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: '', backView: 'none' as const, resetToken: 'reference-view',
      orientationResetToken: 0, orientationResetAlg: null, gyroscopeEnabled: true, gyroFrameQuaternion: frame,
      cubeQuaternionRef, trainingViewRef, viewAngleDeg: 10 };
    const { rerender, unmount } = render(<MainCubeArea {...props} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(10).multiply(turn('x', 20)))).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(picture)).toBe(true);
    // New sensor packets must move the waiting cube without a React render.
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(turn('y', 80)).multiply(turn('x', -30))
      .multiply(frame.clone().invert());
    await frames.advance(64);
    const inspection = referenceViewOrientation(10).multiply(turn('y', 40)).multiply(turn('x', -30));
    expect(drawing.object!.quaternion.angleTo(inspection)).toBeLessThan(1e-6);
    const anchor = cubeQuaternionRef.current.clone().multiply(frame);
    trainingViewRef.current = { phase: 'executing', anchor };
    // Preserve the inspection offset even if the sticker layout remounts Twisty.
    rerender(<MainCubeArea {...props} fixedOrientation={false} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(inspection)).toBeLessThan(1e-6);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    cubeQuaternionRef.current = anchor.clone().multiply(rotation).multiply(frame.clone().invert());
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(10).multiply(turn('y', 40)).multiply(turn('x', 60)))).toBeLessThan(1e-6);
    trainingViewRef.current = { phase: 'ready', anchor: null };
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(10).multiply(turn('y', 40)).multiply(turn('x', 60)))).toBeLessThan(1e-6);
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(turn('y', 40)).multiply(frame.clone().invert());
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(10))).toBeLessThan(1e-6);
    rerender(<MainCubeArea {...props} viewAngleDeg={25} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(25))).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(picture)).toBe(true);
    unmount();
    expect(frames.pending.size).toBe(0);
  });

  it('drops the old training center when stabilization is disabled and re-enabled', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const frames = orientationFrames();
    drawing.solved = await solvedPattern(3);
    const turn = (degrees: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), degrees * Math.PI / 180);
    const cubeQuaternionRef = { current: HOME_ORIENTATION.clone().multiply(turn(40)) };
    const trainingViewRef = { current: { phase: 'ready', anchor: null } as TrainingCubeView };
    const props = { puzzle: '3x3x3' as const, alg: '', targetPattern: drawing.solved, fixedOrientation: true,
      sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none', experimentalStickering: 'full',
      setupAlg: '', backView: 'none' as const, resetToken: 'toggle-training-view', orientationResetToken: 0,
      orientationResetAlg: null, gyroscopeEnabled: true, cubeQuaternionRef, trainingViewRef, viewAngleDeg: 0 };
    const { rerender } = render(<MainCubeArea {...props} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(0))).toBeLessThan(1e-6);
    rerender(<MainCubeArea {...props} trainingViewRef={undefined} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(0).multiply(turn(40)))).toBeLessThan(1e-6);
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(turn(80));
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(0).multiply(turn(80)))).toBeLessThan(1e-6);
    rerender(<MainCubeArea {...props} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(referenceViewOrientation(0))).toBeLessThan(1e-6);
  });

  it('changes camera longitude rather than latitude for the signed view angle without gyro', async () => {
    drawing.solved = await solvedPattern(3);
    const props = { puzzle: '3x3x3' as const, alg: 'R U', targetPattern: drawing.solved,
      fixedOrientation: true, sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: '', backView: 'none' as const, resetToken: 'camera-view',
      orientationResetToken: 0, orientationResetAlg: null, gyroscopeEnabled: false, cubeQuaternionRef: { current: null } };
    const { rerender } = render(<MainCubeArea {...props} viewAngleDeg={25} />);
    expect(drawing.player?.cameraLatitude).toBe(30);
    expect(drawing.player?.cameraLongitude).toBe(25);
    rerender(<MainCubeArea {...props} viewAngleDeg={-25} />);
    expect(drawing.player?.cameraLatitude).toBe(30);
    expect(drawing.player?.cameraLongitude).toBe(-25);
  });

  it.each([2, 3] as const)('preserves the calibrated %i× hand pose through prepared training and gyro resets', async size => {
    const frames = orientationFrames();
    const solved = await solvedPattern(size);
    drawing.solved = solved;
    drawing.moves = [];
    const physical = solved.applyAlg('x y R F2 U');
    const frame = guidanceFrameRotation(physical, fixOrientation(physical))!;
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, -.2, .1));
    const anchor = HOME_ORIENTATION.clone().multiply(tilt).multiply(frame.clone().invert());
    const cubeQuaternionRef = { current: anchor.clone() as THREE.Quaternion | null };
    const props = {
      puzzle: size === 2 ? '2x2x2' as const : '3x3x3' as const, alg: "R U' R'",
      targetPattern: physical, fixedOrientation: true, sizePx: 420, visualization: '3D',
      hintFacelets: 'none', controlPanel: 'none', experimentalStickering: 'full',
      setupAlg: '', backView: 'none' as const, resetToken: 'after-guidance', gyroFrameQuaternion: frame,
      orientationResetToken: 0, orientationResetAlg: null, gyroscopeEnabled: true, cubeQuaternionRef,
    };
    const { rerender, unmount } = render(<StrictMode><MainCubeArea {...props}
      fixedOrientation={false} gyroFrameQuaternion={undefined} cubeQuaternionRef={{ current: HOME_ORIENTATION.clone() }} /></StrictMode>);
    await frames.advance(48);
    const connectedOrientation = drawing.object!.quaternion.clone();
    expect(connectedOrientation.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    rerender(<StrictMode><MainCubeArea {...props} /></StrictMode>);
    await frames.advance(48);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(tilt))).toBeLessThan(1e-6);
    expect(drawing.player?.cameraLatitude).toBe(0);
    expect(drawing.player?.cameraLongitude).toBe(0);
    expect(drawing.current!.isIdentical(physical)).toBe(true);
    // Gyro packets update a ref without triggering a React render.
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.23, .42, .14));
    const displayedRotation = HOME_ORIENTATION.clone().multiply(rotation).multiply(tilt);
    cubeQuaternionRef.current = displayedRotation.clone().multiply(frame.clone().invert());
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(displayedRotation)).toBeLessThan(.001);
    const next = physical.applyMove('B');
    rerender(<StrictMode><MainCubeArea {...props} targetPattern={next} /></StrictMode>);
    await frames.advance();
    expect(drawing.current!.isIdentical(next)).toBe(true);
    expect(drawing.object!.quaternion.angleTo(displayedRotation)).toBeLessThan(.001);
    // Reset Gyro can deliver its new reference before the next render frame.
    // A basis change must not erase a pose already measured in the new basis.
    const afterReset = HOME_ORIENTATION.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.6, .7, -.2)));
    cubeQuaternionRef.current = Object.assign(afterReset.clone().multiply(frame.clone().invert()), { basisVersion: 1 });
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(afterReset)).toBeLessThan(.001);
    expect(drawing.current!.isIdentical(next)).toBe(true);
    cubeQuaternionRef.current = null;
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(connectedOrientation)).toBeLessThan(.001);
    cubeQuaternionRef.current = Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 2 });
    await frames.advance(48);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(frame))).toBeLessThan(.001);
    unmount();
    expect(frames.pending.size).toBe(0);
  });

  it('starts and stops gyro tracking when toggled after guidance, including a late first sensor packet', async () => {
    const frames = orientationFrames();
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    const physical = solved.applyAlg('R U F');
    const cubeQuaternionRef = { current: null as THREE.Quaternion | null };
    const props = {
      puzzle: '2x2x2' as const, alg: '', targetPattern: physical, fixedOrientation: true,
      sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: '', backView: 'none' as const, resetToken: 'recovery',
      orientationResetToken: 0, orientationResetAlg: null, gyroscopeEnabled: false, cubeQuaternionRef,
    };
    const { rerender } = render(<MainCubeArea {...props} />);
    expect(frames.pending.size).toBe(0);
    rerender(<MainCubeArea {...props} gyroscopeEnabled />);
    await frames.advance(48);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    const anchor = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, -.7, .1));
    cubeQuaternionRef.current = anchor.clone();
    await frames.advance(48);
    expect(drawing.object!.quaternion.angleTo(anchor)).toBeLessThan(1e-6);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .8);
    const grip = HOME_ORIENTATION.clone().invert().multiply(anchor);
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(rotation).multiply(grip);
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(cubeQuaternionRef.current)).toBeLessThan(.001);
    rerender(<MainCubeArea {...props} />);
    expect(frames.pending.size).toBe(0);
    expect(drawing.object!.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
    rerender(<MainCubeArea {...props} gyroscopeEnabled />);
    await frames.advance(48);
    expect(drawing.object!.quaternion.angleTo(cubeQuaternionRef.current)).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(physical)).toBe(true);
  });

  it.each(['x', 'y', 'z'] as const)('keeps physical %s rotations on the same axis after V perm recovery past f\'', async axis => {
    const frames = orientationFrames();
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const algorithm = defaults.PLL.flatMap(subset => subset.algorithms).find(card => card.name === 'V Perm')!.algorithm;
    const moves = new Alg(algorithm).expand().toString().split(/\s+/);
    const solved = await solvedPattern(3);
    drawing.solved = solved;
    drawing.moves = [];
    const start = solved.applyAlg(new Alg(algorithm).invert());
    const recovered = start.applyAlg(moves.slice(0, moves.indexOf("f'") + 1).join(' '));
    const grip = guidanceFrameRotation(fixOrientation(recovered), recovered)!;
    const cubeQuaternionRef = { current: HOME_ORIENTATION.clone().multiply(grip) };
    const props = {
      puzzle: '3x3x3' as const, alg: '', targetPattern: recovered, fixedOrientation: true,
      sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'PLL', setupAlg: '', backView: 'none' as const,
      resetToken: 'v-perm-recovered', orientationResetToken: 0, orientationResetAlg: null,
      gyroFrameQuaternion: grip.clone().invert(),
      gyroscopeEnabled: true, cubeQuaternionRef,
    };
    const { rerender } = render(<MainCubeArea {...props} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(recovered)).toBe(true);
    // Rotate about the pictured axis. Sensor packets retain the device's
    // rolled frame from f', which must not turn an x motion into y'.
    for (const degrees of [-90, 90, 30]) {
      const turn = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0),
        degrees * Math.PI / 180,
      );
      const expected = HOME_ORIENTATION.clone().multiply(turn);
      cubeQuaternionRef.current = expected.clone().multiply(grip);
      await frames.advance(64);
      expect(drawing.object!.quaternion.angleTo(expected)).toBeLessThan(1e-6);
      expect(drawing.current!.isIdentical(recovered)).toBe(true);
    }
    // A subsequent layer turn changes stickers without resetting the gyro.
    const next = recovered.applyMove(moves[moves.indexOf("f'") + 1]);
    const pose = drawing.object!.quaternion.clone();
    rerender(<MainCubeArea {...props} targetPattern={next} />);
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(pose)).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(next)).toBe(true);
    // A new gyro basis can arrive without a render or an intervening null.
    cubeQuaternionRef.current = Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 1 });
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(grip.clone().invert()))).toBeLessThan(1e-6);
    const turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), Math.PI / 3,
    );
    const expected = HOME_ORIENTATION.clone().multiply(turn).multiply(grip.clone().invert());
    cubeQuaternionRef.current = Object.assign(HOME_ORIENTATION.clone().multiply(turn), { basisVersion: 1 });
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(expected)).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(next)).toBe(true);
  });

  it('retains absolute gyro tracking outside the guidance grip', async () => {
    const frames = orientationFrames();
    drawing.solved = await solvedPattern(3);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, -.8, .1));
    const cubeQuaternionRef = { current: rotation.clone() };
    render(<MainCubeArea puzzle="3x3x3" alg="R U" sizePx={420} visualization="3D"
      hintFacelets="none" controlPanel="none" experimentalStickering="full" setupAlg=""
      backView="none" resetToken="ordinary-training" orientationResetToken={0}
      orientationResetAlg={null} gyroscopeEnabled cubeQuaternionRef={cubeQuaternionRef} />);
    await frames.advance(24);
    expect(drawing.object!.quaternion.angleTo(rotation)).toBeLessThan(.001);
  });

  it('does not adopt the current hand angle as zero on repeated Always Scramble To remounts', async () => {
    const frames = orientationFrames();
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    const physical = solved.applyAlg('R U F D L B');
    const frame = guidanceFrameRotation(physical, fixOrientation(physical))!;
    for (const [i, degrees] of [20, -15, 8, -25].entries()) {
      const hand = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), degrees * Math.PI / 180);
      const shown = HOME_ORIENTATION.clone().multiply(hand);
      const cubeQuaternionRef = { current: shown.clone().multiply(frame.clone().invert()) };
      const props = {
        puzzle: '2x2x2' as const, alg: '', targetPattern: physical, fixedOrientation: true,
        sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
        experimentalStickering: 'full', setupAlg: '', backView: 'none' as const,
        resetToken: `auto-setup-${i}`, orientationResetToken: 0, orientationResetAlg: null,
        gyroscopeEnabled: true, cubeQuaternionRef, gyroFrameQuaternion: frame,
      };
      const { unmount } = render(<MainCubeArea {...props} />);
      await frames.advance(64);
      expect(drawing.object!.quaternion.angleTo(shown)).toBeLessThan(1e-6);
      // Return to the calibrated grip without a remount or React render.
      cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(frame.clone().invert());
      await frames.advance(64);
      expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
      unmount();
    }
  });

  it.each([false, true])('keeps the next PBL view and R turn steady while preserving hand tilts (guided %s)', async fixedOrientation => {
    const frames = orientationFrames();
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const cards = getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL']);
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    let physical = solved;
    for (const card of cards.slice(0, 4)) physical = physical.applyAlg(card.algorithm);
    expect(cards[3].name).toBe('Adj Adj - 2 bars');
    const sensorFrame = (pattern: KPattern) => guidanceFrameRotation(pattern, fixOrientation(pattern))!;
    const gyroFrame = sensorFrame(physical);
    const cubeQuaternionRef = { current: HOME_ORIENTATION.clone().multiply(gyroFrame.clone().invert()) };
    const picture = solved.applyAlg(new Alg(cards[4].algorithm).invert());
    const props = {
      puzzle: '2x2x2' as const, alg: '', targetPattern: picture, fixedOrientation,
      sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: '', backView: 'none' as const,
      resetToken: 'after-adj-adj', orientationResetToken: 0, orientationResetAlg: null,
      gyroscopeEnabled: true, cubeQuaternionRef, gyroFrameQuaternion: gyroFrame,
    };
    const { rerender } = render(<MainCubeArea {...props} />);
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    expect(drawing.current!.isIdentical(picture)).toBe(true);
    physical = physical.applyMove('R');
    const nextFrame = sensorFrame(physical);
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(nextFrame.clone().invert());
    rerender(<MainCubeArea {...props} targetPattern={picture.applyMove('R')} gyroFrameQuaternion={nextFrame} />);
    await frames.advance(64);
    expect(drawing.moves).toEqual(['R']);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    // Keep real hand motion; only the sticker report's frame is compensated.
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, -.3, .1));
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(tilt).multiply(nextFrame.clone().invert());
    await frames.advance(64);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(tilt))).toBeLessThan(1e-6);
    // New sticker packets may briefly arrive before training reconciles them.
    rerender(<MainCubeArea {...props} targetPattern={picture.applyMove('R')} gyroFrameQuaternion={null} />);
    await frames.advance();
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(tilt))).toBeLessThan(1e-6);
  });

  it('renders a guided OLL-4 f turn as a back-layer turn plus one physical gyro rotation', async () => {
    const frames = orientationFrames();
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const oll4 = defaults.OLL.flatMap(subset => subset.algorithms).find(card => card.name.startsWith('OLL-4 '))!;
    const solved = await solvedPattern(3);
    drawing.solved = solved;
    drawing.moves = [];
    const start = solved.applyAlg('z2').applyAlg(new Alg(oll4.algorithm).invert());
    const cubeQuaternionRef = { current: HOME_ORIENTATION.clone() };
    const props = {
      puzzle: '3x3x3' as const, alg: '', targetPattern: start, fixedOrientation: true,
      sizePx: 420, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'OLL', setupAlg: '', backView: 'none' as const,
      resetToken: 'oll4-wand', orientationResetToken: 0, orientationResetAlg: null,
      gyroscopeEnabled: true, cubeQuaternionRef,
    };
    const { rerender } = render(<MainCubeArea {...props} />);
    await frames.advance(48);
    const physical = start.applyMove('f');
    const gyroTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(gyroTurn);
    rerender(<MainCubeArea {...props} targetPattern={alignForGuidance(physical, start)} />);
    await frames.advance(64);
    expect(drawing.moves).toEqual(['B']);
    expect(drawing.object!.quaternion.angleTo(HOME_ORIENTATION.clone().multiply(gyroTurn))).toBeLessThan(1e-6);
    expect(drawing.current!.applyMove('z').isIdentical(physical)).toBe(true);
    expect(drawing.current!.applyAlg('z2').isIdentical(physical)).toBe(false);
  });

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
    const picture = projectTrainingPattern(card.algorithm, training.caseStartPattern!,
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

  it.each([false, true])('keeps the confirmed setup stickers with the training camera (gyro %s)', async gyroscopeEnabled => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    const physical = solved.applyAlg("x y R F2 U");
    const props = {
      puzzle: '2x2x2' as const, alg: "R U' R'", resetToken: 'wand-setup',
      targetPattern: physical, fixedOrientation: true, sizePx: 420,
      visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', setupAlg: '', backView: 'none' as const,
      orientationResetToken: 1, orientationResetAlg: 'U2',
      appendMoveKey: 'setup-last-turn', appendMove: 'F', gyroscopeEnabled,
      cubeQuaternionRef: { current: { x: 1, y: 0, z: 0, w: 0 } },
    };
    const { rerender } = render(<StrictMode><MainCubeArea {...props} /></StrictMode>);
    expect(drawing.current?.isIdentical(physical)).toBe(true);
    expect(drawing.setupAlg).toBe('');
    expect(drawing.player?.cameraLatitude).toBe(gyroscopeEnabled ? 0 : 30);
    expect(drawing.player?.cameraLongitude).toBe(gyroscopeEnabled ? 0 : 30);
    expect(drawing.player?.experimentalDragInput).toBe('none');
    expect(drawing.moves).toEqual([]);
    const next = physical.applyMove('B');
    rerender(<StrictMode><MainCubeArea {...props} targetPattern={next} appendMoveKey="first-algorithm-turn" appendMove="F" /></StrictMode>);
    expect(drawing.current?.isIdentical(next)).toBe(true);
    expect(drawing.moves).toEqual(['B']);
  });

  it.each([2, 3].flatMap(size => [false, true].flatMap(whiteOnBottom =>
    [false, true].map(gyroscopeEnabled => ({ size: size as 2 | 3, whiteOnBottom, gyroscopeEnabled })))))
    ('preserves the display reference after guidance and restores the next $size×$size case (white bottom $whiteOnBottom, gyro $gyroscopeEnabled)', async ({ size, whiteOnBottom, gyroscopeEnabled }) => {
    const solved = await solvedPattern(size);
    drawing.solved = solved;
    drawing.moves = [];
    const algorithm = "R U R' U'";
    const inverse = new Alg(algorithm).invert().toString();
    const physical = solved.applyAlg(inverse);
    const props = {
      puzzle: size === 2 ? '2x2x2' as const : '3x3x3' as const, alg: inverse, targetPattern: physical,
      fixedOrientation: true, sizePx: 420, visualization: '3D', hintFacelets: 'none',
      controlPanel: 'none', experimentalStickering: 'full', setupAlg: whiteOnBottom ? 'z2' : '',
      backView: 'none' as const, resetToken: 'guided-case', orientationResetToken: 1,
      // A reset from before guidance must not replace a later case on remount.
      orientationResetAlg: '', gyroscopeEnabled, cubeQuaternionRef: { current: null },
      appendMoveKey: 'setup-final-turn', appendMove: 'F',
    };
    const { rerender } = render(<StrictMode><MainCubeArea {...props} /></StrictMode>);
    const reference = solved.applyAlg(props.setupAlg);
    expect(drawing.current?.isIdentical(reference.applyAlg(inverse))).toBe(true);
    const moved = physical.applyMove('R');
    rerender(<StrictMode><MainCubeArea {...props} targetPattern={moved}
      appendMoveKey="solve-first-turn" appendMove="R" /></StrictMode>);
    expect(drawing.current?.isIdentical(reference.applyAlg(`${inverse} R`))).toBe(true);
    rerender(<StrictMode><MainCubeArea {...props} targetPattern={solved}
      appendMoveKey="solve-final-turn" appendMove="U'" /></StrictMode>);
    expect(drawing.current?.isIdentical(reference)).toBe(true);
    const nextInverse = new Alg("F R U R' U' F'").invert().toString();
    rerender(<StrictMode><MainCubeArea {...props} alg={nextInverse} targetPattern={null}
      fixedOrientation={false} resetToken="next-case" appendMoveKey="solve-final-turn" appendMove="U'" /></StrictMode>);
    expect(drawing.current?.isIdentical(reference.applyAlg(nextInverse))).toBe(true);
    expect(drawing.current?.isIdentical(reference)).toBe(false);
  });

  it('applies an orientation reset only when requested, preserving later cases and camera changes', async () => {
    const solved = await solvedPattern(3);
    drawing.solved = solved;
    const props = {
      alg: 'R U', visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', enableExternalOrientationLoop: false,
      orientationResetToken: 0, orientationResetAlg: null as string | null,
      cameraLatitude: 0, cameraLongitude: 0,
    };
    const { rerender } = render(<TwistyCube {...props} />);
    rerender(<TwistyCube {...props} orientationResetToken={1} orientationResetAlg="F" />);
    expect(drawing.current?.isIdentical(solved.applyAlg('F'))).toBe(true);
    rerender(<TwistyCube {...props} alg="B U" resetToken="next-case"
      orientationResetToken={1} orientationResetAlg="F" cameraLatitude={30} cameraLongitude={30} />);
    expect(drawing.current?.isIdentical(solved.applyAlg('B U'))).toBe(true);
  });

  it('renders selected-case rotation and animates state-derived turns without appending raw aliases twice', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    drawing.resets = 0;
    const algorithm = "R U R'";
    const start = solved.applyAlg('R F2 U');
    const initial = projectTrainingPattern(algorithm, start, start.applyAlg("y'"));
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

    const after = projectTrainingPattern(algorithm, start, start.applyAlg("R y'"));
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
    const next = projectTrainingPattern(nextAlgorithm, nextStart, nextStart.applyAlg('y2'));
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
