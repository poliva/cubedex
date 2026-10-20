import { act, renderHook } from '@testing-library/react';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { SmartCubeCommand, SmartCubeEvent } from 'smartcube-web-bluetooth';

vi.mock('smartcube-web-bluetooth', () => ({
  connectSmartCube: vi.fn(),
  cubeTimestampCalcSkew: vi.fn(() => 0),
  getCachedMacForDevice: vi.fn(),
}));

import { connectSmartCube } from 'smartcube-web-bluetooth';
import { useSmartcubeConnection } from '../../src/hooks/useSmartcubeConnection';
import { faceletsToPattern, patternToFacelets, solvedFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { GyroDiagnostics } from '../../src/lib/gyro-diagnostics';
import { HOME_ORIENTATION, guidanceFrameRotation } from '../../src/lib/cube-orientation';
import { fixOrientation } from '../../src/lib/scramble';

const buildFlags = vi.hoisted(() => ({ gyroTesting: true }));
vi.mock('../../src/lib/build-flags', () => ({ get GYRO_TESTING_ENABLED() { return buildFlags.gyroTesting; } }));

let events: Subject<SmartCubeEvent>;
let size: 2 | 3;
let deviceName: string;
let batterySupported: boolean;
let timestamp: number;
let physicalFacelets: string;
let sendCommand: ReturnType<typeof vi.fn>;

function emitMove(move: string) {
  events.next({
    type: 'MOVE', move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0,
    timestamp: ++timestamp, localTimestamp: timestamp, cubeTimestamp: timestamp,
  });
}

beforeEach(() => {
  buildFlags.gyroTesting = true;
  events = new Subject<SmartCubeEvent>();
  size = 2;
  deviceName = 'Smart cube';
  batterySupported = false;
  timestamp = 0;
  physicalFacelets = solvedFacelets(2);
  sendCommand = vi.fn(async (command: SmartCubeCommand) => {
    if (command.type === 'REQUEST_FACELETS') {
      events.next({ type: 'FACELETS', source: 'device', facelets: size === 2 ? physicalFacelets : solvedFacelets(size), timestamp: ++timestamp });
    }
  });
  vi.mocked(connectSmartCube).mockImplementation(async () => ({
    deviceName, deviceMAC: '', protocol: { id: 'test', name: 'Test' },
    capabilities: { gyroscope: false, battery: batterySupported, facelets: true, hardware: false, reset: true },
    events$: events.asObservable(), sendCommand, disconnect: vi.fn(async () => undefined),
  }));
});

it('marks a fresh gyro reference after Reset Gyro so guided grips can recalibrate', async () => {
  const { result } = renderHook(() => useSmartcubeConnection(false));
  await act(async () => { await result.current.connectOrDisconnect(); });
  const quaternion = { x: .2, y: .3, z: -.1, w: .9 };
  act(() => events.next({ type: 'GYRO', quaternion, timestamp: ++timestamp }));
  const before = result.current.cubeQuaternionRef.current!;
  expect(before).not.toBeNull();
  act(() => result.current.resetGyro());
  expect(result.current.cubeQuaternionRef.current).toBeNull();
  act(() => events.next({ type: 'GYRO', quaternion, timestamp: ++timestamp }));
  const after = result.current.cubeQuaternionRef.current!;
  expect(after.basisVersion).toBeGreaterThan(before.basisVersion!);
  expect([after.x, after.y, after.z, after.w]).toEqual([before.x, before.y, before.z, before.w]);
});

describe('gyro drift recordings and connection integration', () => {
  let now: number;
  const turn = (axis: 'x' | 'y', degrees: number) => new Quaternion().setFromAxisAngle(
    new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, 0), degrees * Math.PI / 180);
  const gyro = (q: Quaternion, at: number) => {
    now = at;
    act(() => events.next({ type: 'GYRO', timestamp: ++timestamp, quaternion: { x: q.x, y: -q.z, z: q.y, w: q.w } }));
  };
  beforeEach(() => {
    now = 0;
    size = 3;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  it('records remaining heading error in the OLD basis at the first post-reset sample', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => result.current.connectOrDisconnect());
    const base = turn('x', 35);
    gyro(base, 0);
    gyro(base.clone().multiply(turn('y', 5)), 100);
    now = 120;
    act(() => result.current.resetGyro());
    // The next sample arrives with a slightly larger error than at the click.
    gyro(base.clone().multiply(turn('y', 7)), 140);
    const report = new GyroDiagnostics(localStorage).report();
    const comparison = report.entries.find(e => e.event === 'manual-reset-comparison')!;
    expect(comparison.data).toMatchObject({ delayAfterClickMs: 20,
      residualWithoutAutoCorrection: { yawDeg: expect.closeTo(7, 5) },
      residualAfterAutoCorrection: { yawDeg: expect.closeTo(7, 5) } });
    const pose = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(pose.x, pose.y, pose.z, pose.w).angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
  });

  it('records applied tilt correction and quantifies its benefit on manual reset', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => result.current.connectOrDisconnect());
    gyro(new Quaternion(), 0);
    for (let at = 100; at <= 2400; at += 20) gyro(turn('x', 6), at);
    const pose = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(pose.x, pose.y, pose.z, pose.w).angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    now = 2420;
    act(() => result.current.resetGyro());
    gyro(turn('x', 6), 2440);
    const entries = new GyroDiagnostics(localStorage).report().entries;
    expect(entries.find(e => e.event === 'correction-applied')?.data.appliedDeg).toBeCloseTo(6);
    const comparison = entries.find(e => e.event === 'manual-reset-comparison')!;
    expect(comparison.data).toMatchObject({
      residualWithoutAutoCorrection: { tiltDeg: expect.closeTo(6, 5) },
      residualAfterAutoCorrection: { angleDeg: expect.closeTo(0, 5) } });
  });

  it('corrects and resets gyro without accessing the testing log in normal builds', async () => {
    buildFlags.gyroTesting = false;
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const download = vi.spyOn(GyroDiagnostics.prototype, 'download').mockImplementation(() => {});
    const clear = vi.spyOn(GyroDiagnostics.prototype, 'clear');
    const { result, unmount } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => result.current.connectOrDisconnect());
    gyro(new Quaternion(), 0);
    for (let at = 100; at <= 2400; at += 20) gyro(turn('x', 6), at);
    const pose = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(pose.x, pose.y, pose.z, pose.w).angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    act(() => result.current.resetGyro());
    gyro(turn('x', 6), 2420);
    act(() => { result.current.exportGyroDiagnostics(); result.current.clearGyroDiagnostics(); });
    const reset = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(reset.x, reset.y, reset.z, reset.w).angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
    unmount();
    expect(read.mock.calls.some(([key]) => key === 'cubedex.gyroDiagnostics.v1')).toBe(false);
    expect(write.mock.calls.some(([key]) => key === 'cubedex.gyroDiagnostics.v1')).toBe(false);
    expect(download).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('does not apply drift corrections with the setting off and safely ignores corrupt samples', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(true, false));
    await act(async () => result.current.connectOrDisconnect());
    gyro(new Quaternion(), 0);
    for (let at = 100; at <= 2400; at += 20) gyro(turn('x', 6), at);
    const before = result.current.cubeQuaternionRef.current!;
    gyro(new Quaternion(NaN, 0, 0, 1), 2420);
    expect(result.current.cubeQuaternionRef.current).toBe(before);
    expect(new Quaternion(before.x, before.y, before.z, before.w).angleTo(HOME_ORIENTATION) * 180 / Math.PI).toBeCloseTo(6);
    const download = vi.spyOn(GyroDiagnostics.prototype, 'download').mockImplementation(() => {});
    act(() => result.current.exportGyroDiagnostics());
    expect(download).toHaveBeenCalledOnce();
  });

  it.each([2, 3] as const)('corrects heading after real %i× move events in the training sticker frame', async cubeSize => {
    size = cubeSize;
    physicalFacelets = solvedFacelets(cubeSize);
    const { result } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => result.current.connectOrDisconnect());
    const start = result.current.currentPattern!;
    gyro(new Quaternion(), 0);
    gyro(new Quaternion(), 80);
    act(() => result.current.handleGyroTrainingEvent({ phase: 'ready', algorithm: 'D', pattern: start }));
    const canonicalEnd = start.applyMove('D');
    if (cubeSize === 2) physicalFacelets = patternToFacelets(fixOrientation(canonicalEnd));
    now = 100;
    await act(async () => { emitMove('D'); });
    const frame = guidanceFrameRotation(canonicalEnd, result.current.currentPattern!)!;
    expect(frame).not.toBeNull();
    now = 110;
    act(() => result.current.handleGyroTrainingEvent({ phase: 'complete', pattern: canonicalEnd }));
    const end = turn('y', 6).multiply(frame.clone().invert());
    for (let at = 120; at <= 1600; at += 20) gyro(end, at);
    const pose = result.current.cubeQuaternionRef.current!;
    const shown = new Quaternion(pose.x, pose.y, pose.z, pose.w).multiply(frame);
    expect(shown.angleTo(HOME_ORIENTATION.clone().multiply(turn('y', 3)))).toBeLessThan(1e-6);
    const download = vi.spyOn(GyroDiagnostics.prototype, 'download').mockImplementation(function (this: GyroDiagnostics) { this.flush(); });
    act(() => result.current.exportGyroDiagnostics());
    expect(download).toHaveBeenCalledOnce();
    const entries = new GyroDiagnostics(localStorage).report().entries;
    expect(entries.some(e => e.event === 'correction-decision' && e.data.source === 'algorithm' && e.data.reason === 'accepted')).toBe(true);
  });

  it.each([2, 3] as const)('preserves the calibrated %i× heading through guidance and the next case', async cubeSize => {
    size = cubeSize;
    physicalFacelets = solvedFacelets(cubeSize);
    const { result } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => result.current.connectOrDisconnect());
    gyro(new Quaternion(), 0);
    const sensor = result.current.currentPattern!;
    const target = sensor.applyAlg('y');
    const frame = guidanceFrameRotation(sensor, target)!;
    const drifted = turn('y', 37).multiply(frame);
    gyro(drifted, 100);
    const basisVersion = result.current.cubeQuaternionRef.current!.basisVersion;
    now = 110;
    act(() => result.current.handleGyroTrainingEvent({ phase: 'guided-recovery-start' }));
    act(() => result.current.handleGyroTrainingEvent({ phase: 'guided-recovery-complete', pattern: target }));
    let pose = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(pose.x, pose.y, pose.z, pose.w).angleTo(HOME_ORIENTATION.clone().multiply(drifted))).toBeLessThan(1e-6);
    expect(pose.basisVersion).toBe(basisVersion);
    act(() => result.current.handleGyroTrainingEvent({ phase: 'ready', algorithm: 'R U', pattern: target }));
    gyro(drifted, 180);
    pose = result.current.cubeQuaternionRef.current!;
    expect(new Quaternion(pose.x, pose.y, pose.z, pose.w).angleTo(HOME_ORIENTATION.clone().multiply(drifted))).toBeLessThan(1e-6);
    const download = vi.spyOn(GyroDiagnostics.prototype, 'download').mockImplementation(function (this: GyroDiagnostics) { this.flush(); });
    act(() => result.current.exportGyroDiagnostics());
    expect(download).toHaveBeenCalledOnce();
    const confirmation = new GyroDiagnostics(localStorage).report().entries.find(e => e.event === 'guided-reference');
    expect(confirmation?.data).toMatchObject({ applied: false, reason: 'observed-grip-only', headingAdjustmentDeg: 0 });
  });
});

describe('smartcube battery refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    deviceName = 'GAN16ui_FF89';
    batterySupported = true;
    // Keep these tests focused on battery traffic, without asynchronous facelet conversion.
    sendCommand.mockImplementation(async () => {});
  });
  afterEach(() => vi.useRealTimers());

  const batteryRequests = () => sendCommand.mock.calls.filter(([c]) => c.type === 'REQUEST_BATTERY').length;

  it('recovers a missing startup reply and refreshes the displayed level every minute', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(batteryRequests()).toBe(1);
    expect(result.current.battery.level).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(batteryRequests()).toBe(2);
    act(() => events.next({ type: 'BATTERY', batteryLevel: 100, timestamp: ++timestamp }));
    expect(result.current.battery.level).toBe(100);
    expect(result.current.info.batteryLevel).toBe('100%');
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(batteryRequests()).toBe(2);
    sendCommand.mockImplementation(async command => {
      if (command.type === 'REQUEST_BATTERY') events.next({ type: 'BATTERY', batteryLevel: 99, timestamp: ++timestamp });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.battery.level).toBe(99);
    expect(result.current.info.batteryLevel).toBe('99%');
  });

  it('bounds startup retries and backs off to once a minute without a reply', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(batteryRequests()).toBe(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(batteryRequests()).toBe(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(batteryRequests()).toBe(5);
  });

  it('keeps the connection usable after a battery write failure and retries', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sendCommand.mockImplementation(async command => {
      if (command.type === 'REQUEST_BATTERY') throw new Error('GATT busy');
    });
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.connected).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(batteryRequests()).toBe(2);
    sendCommand.mockImplementation(async command => {
      if (command.type === 'REQUEST_BATTERY') events.next({ type: 'BATTERY', batteryLevel: 0, timestamp: ++timestamp });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.battery.level).toBe(0);
    expect(result.current.battery.color).toBe('red');
  });

  it.each(['disconnect', 'unmount'] as const)('stops battery requests on %s', async action => {
    const { result, unmount } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    if (action === 'disconnect') {
      await act(async () => { await result.current.connectOrDisconnect(); });
      expect(result.current.battery.level).toBeNull();
    } else {
      unmount();
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(batteryRequests()).toBe(1);
  });

  it('does not request battery from devices without battery support', async () => {
    batterySupported = false;
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(batteryRequests()).toBe(0);
  });
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

  it('processes authoritative opposite 2×2 states without combining them into a slice', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    physicalFacelets = patternToFacelets((await solvedPattern(2)).applyMove('R'));
    await act(async () => { emitMove('R'); });
    expect(result.current.lastProcessedMove?.visualMove).toBe('R');
    physicalFacelets = patternToFacelets((await faceletsToPattern(physicalFacelets)).applyMove("L'"));
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
      events.next({ type: 'FACELETS', source: 'device', facelets: patternToFacelets(pattern), timestamp: ++timestamp });
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

describe('authoritative 2×2 state refresh', () => {
  it('uses device stickers for aliased opposite turns, rejecting synthetic facelets', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(true));
    await act(async () => { await result.current.connectOrDisconnect(); });
    const actual = (await solvedPattern(2)).applyAlg('L U');
    physicalFacelets = patternToFacelets(actual);
    await act(async () => { emitMove('R'); });
    expect(result.current.lastProcessedMove?.currentPattern?.isIdentical(actual)).toBe(true);
    const aliased = (await solvedPattern(2)).applyAlg('R U');
    await act(async () => {
      events.next({ type: 'FACELETS', source: 'moves', facelets: patternToFacelets(aliased), timestamp: ++timestamp });
    });
    expect(result.current.currentPattern?.isIdentical(actual)).toBe(true);
    await act(async () => {
      const refreshed = await result.current.refreshPattern();
      expect(refreshed.isIdentical(actual)).toBe(true);
    });
    expect(sendCommand).not.toHaveBeenCalledWith({ type: 'REQUEST_RESET' });
  });

  it('keeps progress pending until a real snapshot arrives and can retry a failed request', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    sendCommand.mockImplementation(async () => {});
    await act(async () => { emitMove('U'); });
    expect(result.current.stateSyncing).toBe(true);
    expect(result.current.lastProcessedMove).toBeNull();
    const actual = (await solvedPattern(2)).applyMove('D');
    await act(async () => {
      events.next({ type: 'FACELETS', source: 'moves', facelets: patternToFacelets(actual), timestamp: ++timestamp });
    });
    expect(result.current.lastProcessedMove).toBeNull();
    await act(async () => {
      events.next({ type: 'FACELETS', source: 'device', facelets: patternToFacelets(actual), timestamp: ++timestamp });
    });
    expect(result.current.lastProcessedMove?.currentPattern?.isIdentical(actual)).toBe(true);
    sendCommand.mockRejectedValueOnce(new Error('Read failed'));
    await act(async () => { await expect(result.current.refreshPattern()).rejects.toThrow('Read failed'); });
    expect(result.current.stateSyncError).toBe('Read failed');
  });

  it('aborts a recovery consumer and ignores an in-flight read after disconnect', async () => {
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    sendCommand.mockImplementation(async () => {});
    const abort = new AbortController();
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.refreshPattern(abort.signal).catch(error => error.name); });
    abort.abort();
    expect(await pending).toBe('AbortError');
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.currentPattern).toBeNull();
    expect(result.current.stateSyncing).toBe(false);
  });
});

it('matches GAN facelet counters across the 8-bit move-counter rollover', async () => {
  const { result } = renderHook(() => useSmartcubeConnection(false));
  await act(async () => { await result.current.connectOrDisconnect(); });
  sendCommand.mockImplementation(async () => {});
  await act(async () => {
    events.next({ type: 'MOVE', serial: 1, move: 'R', face: 1, direction: 0,
      timestamp: ++timestamp, localTimestamp: timestamp, cubeTimestamp: timestamp });
  });
  const actual = (await solvedPattern(2)).applyMove('R');
  await act(async () => {
    events.next({ type: 'FACELETS', source: 'device', serial: 257,
      facelets: patternToFacelets(actual), timestamp: ++timestamp });
  });
  expect(result.current.lastProcessedMove?.currentPattern?.isIdentical(actual)).toBe(true);
  expect(result.current.stateSyncing).toBe(false);
});

describe('2×2 identification before snapshot validation', () => {
  it.each(['WCU_MY22_1037', 'GAN251ui_ABC', 'ganic251_ABC'])
    ('identifies %s even when the initial device report is delayed', async name => {
      deviceName = name;
      sendCommand.mockImplementation(async () => {});
      const { result } = renderHook(() => useSmartcubeConnection(false));
      await act(async () => { await result.current.connectOrDisconnect(); });
      expect(result.current.connected).toBe(true);
      expect(result.current.cubeSize).toBe(2);
      expect(result.current.currentPattern).toBeNull();
      await act(async () => { await result.current.connectOrDisconnect(); });
    });

  it('detects 24-sticker reports without trusting missing or synthetic provenance', async () => {
    sendCommand.mockImplementation(async () => {
      events.next({ type: 'FACELETS', facelets: solvedFacelets(2), timestamp: ++timestamp });
    });
    const { result } = renderHook(() => useSmartcubeConnection(false));
    await act(async () => { await result.current.connectOrDisconnect(); });
    expect(result.current.cubeSize).toBe(2);
    expect(result.current.currentPattern).toBeNull();
    expect(result.current.stateSyncError).toMatch(/Bluetooth driver needs updating/);
    await act(async () => {
      events.next({ type: 'FACELETS', source: 'moves', facelets: physicalFacelets, timestamp: ++timestamp });
    });
    expect(result.current.cubeSize).toBe(2);
    expect(result.current.currentPattern).toBeNull();
    await act(async () => {
      events.next({ type: 'FACELETS', source: 'device', facelets: physicalFacelets, timestamp: ++timestamp });
    });
    expect(result.current.currentPattern).not.toBeNull();
    expect(result.current.stateSyncError).toBeNull();
    await act(async () => { await result.current.connectOrDisconnect(); });
  });
});
