import { act, renderHook } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { Subject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { connectSmartCube, type SmartCubeCommand, type SmartCubeEvent } from 'smartcube-web-bluetooth';
import { useSmartcubeConnection } from '../../src/hooks/useSmartcubeConnection';
import { useTrainingState } from '../../src/hooks/useTrainingState';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';

vi.mock('smartcube-web-bluetooth', async importOriginal => ({
  ...await importOriginal<typeof import('smartcube-web-bluetooth')>(),
  connectSmartCube: vi.fn(),
}));

it.each([40, 244])('completes Adj Adj - 2 bars with an early final snapshot (counter %i)', async initialSerial => {
  const algorithm = "R2 U' B2' U2' R2' U' R2";
  const solved = await solvedPattern(2);
  let physical = solved.applyAlg(new Alg(algorithm).invert());
  let snapshot = physical;
  let serial = initialSerial;
  let snapshotSerial = serial;
  let timestamp = 1000;
  const events = new Subject<SmartCubeEvent>();
  const sendCommand = vi.fn(async (command: SmartCubeCommand) => {
    if (command.type === 'REQUEST_FACELETS') events.next({
      type: 'FACELETS', source: 'device', serial: snapshotSerial,
      facelets: patternToFacelets(snapshot), timestamp: ++timestamp,
    });
  });
  vi.mocked(connectSmartCube).mockResolvedValue({
    deviceName: 'WCU_MY22_1037', deviceMAC: '', protocol: { id: 'moyu32', name: 'MoYu32' },
    capabilities: { gyroscope: false, battery: false, facelets: true, hardware: false, reset: false },
    events$: events.asObservable(), sendCommand, disconnect: vi.fn(async () => undefined),
  });
  const cube = renderHook(() => useSmartcubeConnection(false));
  await act(async () => cube.result.current.connectOrDisconnect());
  const training = renderHook(() => useTrainingState([], '2x2x2:PBL', {
    puzzle: '2x2x2', selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: false,
    randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
    prioritizeFailedCases: false, smartReviewScheduling: false,
    smartcubeConnected: true, currentPattern: cube.result.current.currentPattern,
  }));
  await act(async () => training.result.current.trainCurrent(physical, { algorithm }));
  let lastKey: string | undefined;
  let completed = false;
  const tokens = algorithm.split(' ');
  for (const [index, token] of tokens.entries()) {
    const halfTurn = /2'?$/.test(token);
    const quarter = halfTurn ? token[0] : token;
    for (let part = 0; part < (halfTurn ? 2 : 1); part++) {
      physical = physical.applyMove(quarter);
      serial = (serial + 1) & 0xff;
      const earlyFinalSnapshot = index === tokens.length - 1 && part === 0;
      snapshot = earlyFinalSnapshot ? physical.applyMove(quarter) : physical;
      snapshotSerial = earlyFinalSnapshot ? (serial + 1) & 0xff : serial;
      // MY22 names a physical B turn using an F-axis alias. Only the device
      // stickers can establish the physical state for training.
      const reported = quarter.replace('B', 'F');
      await act(async () => {
        timestamp += 100;
        events.next({ type: 'MOVE', serial, move: reported, face: 'URFDLB'.indexOf(reported[0]),
          direction: reported.endsWith("'") ? 2 : 0,
          timestamp, localTimestamp: timestamp, cubeTimestamp: timestamp });
      });
      // Forward the same processed-move contract used by App's training effect.
      const processed = cube.result.current.lastProcessedMove;
      if (processed && processed.key !== lastKey) {
        lastKey = processed.key;
        act(() => { completed = training.result.current.handleSmartcubeMove(
          processed.currentPattern!, processed.move, processed.rawMoves, processed.isBugged,
        ); });
      }
      expect(completed).toBe(index === tokens.length - 1 && part === 1);
      expect(training.result.current.recoveryTarget).toBeNull();
    }
  }
  expect(cube.result.current.currentPattern?.isIdentical(solved)).toBe(true);
  expect(cube.result.current.lastProcessedMove?.rawMoves).toHaveLength(2);
  expect(training.result.current.timerState).toBe('STOPPED');
  // One startup read and one per turn, except the already confirmed final turn.
  expect(sendCommand).toHaveBeenCalledTimes(12);
});
