import { act, renderHook } from '@testing-library/react';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmartCubeCommand, SmartCubeEvent } from 'smartcube-web-bluetooth';

vi.mock('smartcube-web-bluetooth', () => ({
  connectSmartCube: vi.fn(),
  cubeTimestampCalcSkew: vi.fn(() => 0),
  getCachedMacForDevice: vi.fn(),
}));

import { connectSmartCube } from 'smartcube-web-bluetooth';
import { useSmartcubeConnection } from '../../src/hooks/useSmartcubeConnection';
import { patternToFacelets, solvedFacelets, solvedPattern } from '../../src/lib/cube-utils';

let events: Subject<SmartCubeEvent>;
let size: 2 | 3;
let deviceName: string;
let timestamp: number;
let sendCommand: ReturnType<typeof vi.fn>;

function emitMove(move: string) {
  events.next({
    type: 'MOVE', move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0,
    timestamp: ++timestamp, localTimestamp: timestamp, cubeTimestamp: timestamp,
  });
}

beforeEach(() => {
  events = new Subject<SmartCubeEvent>();
  size = 2;
  deviceName = 'Smart cube';
  timestamp = 0;
  sendCommand = vi.fn(async (command: SmartCubeCommand) => {
    if (command.type === 'REQUEST_FACELETS') {
      events.next({ type: 'FACELETS', facelets: solvedFacelets(size), timestamp: ++timestamp });
    }
  });
  vi.mocked(connectSmartCube).mockImplementation(async () => ({
    deviceName, deviceMAC: '', protocol: { id: 'test', name: 'Test' },
    capabilities: { gyroscope: false, battery: false, facelets: true, hardware: false, reset: true },
    events$: events.asObservable(), sendCommand, disconnect: vi.fn(async () => undefined),
  }));
});

describe('smartcube puzzle size', () => {
  it.each(['GAN 251', 'MoYu MY22'])('detects a %s 24-facelet state as a 2×2', async (name) => {
    deviceName = name;
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.connected).toBe(true);
    expect(result.current.cubeSize).toBe(2);
    expect(result.current.currentPattern?.patternData.EDGES).toBeUndefined();
    expect(patternToFacelets(result.current.currentPattern!)).toBe(solvedFacelets(2));
    await act(async () => { await result.current.connectOrDisconnect(); });
  });

  it('processes opposite 2×2 turns immediately without combining them into a slice', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    await act(async () => { emitMove('R'); });
    expect(result.current.lastProcessedMove?.visualMove).toBe('R');
    await act(async () => { emitMove("L'"); });
    expect(result.current.lastProcessedMove?.visualMove).toBe("L'");
    expect(result.current.lastProcessedMove?.rawMoves).toHaveLength(1);
    const expected = (await solvedPattern(2)).applyAlg("R L'");
    expect(result.current.currentPattern?.isIdentical(expected)).toBe(true);
    await act(async () => { await result.current.connectOrDisconnect(); });
  });

  it('accepts unsolved facelets and keeps reset on the detected 2×2 puzzle', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    const pattern = (await solvedPattern(2)).applyAlg('R U F2');
    await act(async () => {
      events.next({ type: 'FACELETS', facelets: patternToFacelets(pattern), timestamp: ++timestamp });
    });
    expect(result.current.currentPattern?.isIdentical(pattern)).toBe(true);
    await act(async () => { await result.current.resetState(); });
    expect(sendCommand).toHaveBeenCalledWith({ type: 'REQUEST_RESET' });
    expect(result.current.currentFacelets).toBe(solvedFacelets(2));
    expect(patternToFacelets(result.current.currentPattern!)).toBe(solvedFacelets(2));
    await act(async () => { await result.current.connectOrDisconnect(); });
  });

  it('switches back to a 3×3 on disconnect and reconnect', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.cubeSize).toBe(3);
    expect(result.current.currentPattern).toBeNull();
    size = 3;
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.cubeSize).toBe(3);
    expect(result.current.currentPattern?.patternData.EDGES.pieces).toHaveLength(12);
    await act(async () => { await result.current.connectOrDisconnect(); });
  });
});
