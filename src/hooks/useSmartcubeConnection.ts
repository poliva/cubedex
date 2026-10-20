import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import type { Subscription } from 'rxjs';
import * as THREE from 'three';
import type { KPattern } from 'cubing/kpuzzle';
import {
  connectSmartCube,
  cubeTimestampCalcSkew,
  getCachedMacForDevice,
  type MacAddressProvider,
  type SmartCubeConnection,
  type SmartCubeEvent,
  type SmartCubeMoveEvent,
} from 'smartcube-web-bluetooth';
import { faceletsToPattern, patternToFacelets, solvedPattern, solvedFacelets, type CubeSize } from '../lib/cube-utils';
import { readOption, writeOption } from '../lib/storage';
import { HOME_ORIENTATION, guidanceFrameRotation } from '../lib/cube-orientation';
import { GyroDriftCorrector, gyroPoseMetrics, gyroQuaternion, quaternionData } from '../lib/gyro-drift';
import { GyroDiagnostics } from '../lib/gyro-diagnostics';
import { GYRO_TESTING_ENABLED } from '../lib/build-flags';
import {
  getSliceForPair,
  IDENTITY,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
  type FacePerm,
} from '../lib/smartcube-parity';

let wakeLockHandle: WakeLockSentinel | null = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockHandle = await navigator.wakeLock.request('screen');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`${error.name}, ${error.message}`);
    }
  }
}

async function releaseWakeLock() {
  if (wakeLockHandle) {
    await wakeLockHandle.release();
    wakeLockHandle = null;
  }
}

function handleVisibilityChange() {
  if (wakeLockHandle) {
    if (document.visibilityState === 'visible') {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
  }
}

interface SmartcubeDeviceInfo {
  deviceName: string;
  deviceMAC: string;
  deviceProtocol: string;
  hardwareName: string;
  hardwareVersion: string;
  softwareVersion: string;
  productDate: string;
  gyroSupported: string;
  batteryLevel: string;
  skew: string;
  quaternion: string;
  velocity: string;
}

interface SmartcubeBatteryState {
  level: number | null;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'default';
}

export interface SmartcubeQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  /** Changes when Reset Gyro establishes a new sensor reference. */
  basisVersion?: number;
}

interface SmartcubeProcessedMove {
  key: string;
  move: string;
  rawMoves: Array<{
    face: number;
    direction: number;
    move: string;
    localTimestamp: number | null;
    cubeTimestamp: number | null;
  }>;
  visualMove: string;
  currentPattern: KPattern | null;
  isBugged: boolean;
}

export type GyroTrainingEvent =
  | { phase: 'ready'; algorithm: string; pattern: KPattern | null; reason?: string }
  | { phase: 'complete'; pattern: KPattern }
  | { phase: 'guided-recovery-start' }
  | { phase: 'guided-recovery-cancel' }
  | { phase: 'guided-recovery-complete'; pattern: KPattern }
  | { phase: 'guided-setup-start' }
  | { phase: 'guided-setup-cancel' }
  | { phase: 'guided-setup-complete'; pattern: KPattern }
  | { phase: 'context'; alwaysScrambleTo: boolean }
  | { phase: 'cancel'; reason: string };

export interface SmartcubeConnectionState {
  cubeSize: CubeSize;
  connected: boolean;
  connecting: boolean;
  disconnectToken: number;
  connectLabel: string;
  battery: SmartcubeBatteryState;
  info: SmartcubeDeviceInfo;
  currentFacelets: string | null;
  currentPattern: KPattern | null;
  lastProcessedMove: SmartcubeProcessedMove | null;
  showAllBluetoothDevices: boolean;
  setShowAllBluetoothDevices: (value: boolean) => void;
  connectOrDisconnect: () => Promise<void>;
  resetState: () => Promise<void>;
  refreshPattern: (signal?: AbortSignal) => Promise<KPattern>;
  stateSyncError: string | null;
  stateSyncing: boolean;
  resetGyro: () => void;
  handleGyroTrainingEvent: (event: GyroTrainingEvent) => void;
  exportGyroDiagnostics: () => void;
  clearGyroDiagnostics: () => void;
  resetOrientation: () => void;
  gyroSupported: boolean;
  gyroSupportResolved: boolean;
  gyroscopeToggleDisabled: boolean;
  cubeQuaternion: SmartcubeQuaternion | null;
  cubeQuaternionRef: MutableRefObject<SmartcubeQuaternion | null>;
}

const EMPTY_INFO: SmartcubeDeviceInfo = {
  deviceName: '- n/a -',
  deviceMAC: '- n/a -',
  deviceProtocol: '- n/a -',
  hardwareName: '- n/a -',
  hardwareVersion: '- n/a -',
  softwareVersion: '- n/a -',
  productDate: '- n/a -',
  gyroSupported: '- n/a -',
  batteryLevel: '- n/a -',
  skew: '- n/a -',
  quaternion: '- n/a -',
  velocity: '- n/a -',
};

function storedSmartCubeDeviceSelection(): 'filtered' | 'any' {
  return readOption('smartcubeDeviceSelection') === 'any' ? 'any' : 'filtered';
}

function batteryColor(level: number): SmartcubeBatteryState['color'] {
  if (level >= 75) return 'green';
  if (level >= 50) return 'yellow';
  if (level >= 20) return 'orange';
  return 'red';
}

export function useSmartcubeConnection(gyroscopeEnabled: boolean, autoCorrectGyroDrift = true): SmartcubeConnectionState {
  const cubeSizeRef = useRef<CubeSize>(3);
  const [cubeSize, setCubeSize] = useState<CubeSize>(3);
  const connRef = useRef<SmartCubeConnection | null>(null);
  const pending2x2MovesRef = useRef<Array<SmartCubeMoveEvent & { timestamp: number }>>([]);
  const pending2x2SnapshotRef = useRef<{ pattern: KPattern; event: SmartCubeEvent & { type: 'FACELETS' } } | null>(null);
  const snapshotVersionRef = useRef(0);
  const refreshRef = useRef<{ promise: Promise<KPattern>; resolve: (pattern: KPattern) => void; reject: (error: Error) => void; timer: number } | null>(null);
  const [stateSyncing, setStateSyncing] = useState(false);
  const [stateSyncError, setStateSyncError] = useState<string | null>(null);

  const refreshPattern = useCallback((signal?: AbortSignal): Promise<KPattern> => {
    const connection = connRef.current;
    if (!connection?.capabilities.facelets) return Promise.reject(new Error('Current sticker state is unavailable. Reconnect the cube and retry.'));
    if (!refreshRef.current) {
      setStateSyncing(true);
      setStateSyncError(null);
      let resolve!: (pattern: KPattern) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<KPattern>((yes, no) => { resolve = yes; reject = no; });
      const fail = (error: Error) => {
        if (refreshRef.current?.promise !== promise) return;
        window.clearTimeout(refreshRef.current.timer);
        refreshRef.current = null;
        setStateSyncing(false);
        setStateSyncError(error.message);
        reject(error);
      };
      const timer = window.setTimeout(() => fail(new Error('Could not read the cube. Keep it still and retry.')), 5000);
      refreshRef.current = { promise, resolve, reject, timer };
      void connection.sendCommand({ type: 'REQUEST_FACELETS' }).catch((error: unknown) => fail(new Error(error instanceof Error ? error.message : 'Could not read the cube.')));
    }
    const promise = refreshRef.current!.promise;
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Recovery cancelled', 'AbortError'));
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }, []);

  useEffect(() => () => {
    snapshotVersionRef.current += 1;
    subscriptionRef.current?.unsubscribe();
    pending2x2MovesRef.current = [];
    pending2x2SnapshotRef.current = null;
    if (sliceBufferRef.current) window.clearTimeout(sliceBufferRef.current.timer);
    if (refreshRef.current) {
      window.clearTimeout(refreshRef.current.timer);
      refreshRef.current.reject(new Error('Cube disconnected.'));
      refreshRef.current = null;
    }
  }, []);
  const subscriptionRef = useRef<Subscription | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const currentPatternRef = useRef<KPattern | null>(null);
  const sliceBufferRef = useRef<{ event: SmartCubeEvent; timer: number } | null>(null);
  const sliceOrientationRef = useRef<FacePerm>({ ...IDENTITY });
  const gyroscopeEnabledRef = useRef(gyroscopeEnabled);
  const recentMovesRef = useRef<SmartCubeMoveEvent[]>([]);
  const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
  const gyroBasisVersionRef = useRef(0);
  const diagnosticsRef = useRef<GyroDiagnostics | null>(null);
  if (GYRO_TESTING_ENABLED && !diagnosticsRef.current) {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Recording still works in memory. */ }
    diagnosticsRef.current = new GyroDiagnostics(storage);
  }
  const driftRef = useRef<GyroDriftCorrector | null>(null);
  if (!driftRef.current) driftRef.current = new GyroDriftCorrector(diagnosticsRef.current?.record);
  const gyroTrainingPatternRef = useRef<KPattern | null>(null);
  const pendingGyroResetRef = useRef<{
    basis: THREE.Quaternion; correction: THREE.Quaternion; clickedAt: number; before: Record<string, unknown>;
  } | null>(null);
  const previousFaceletsRef = useRef<string>('');
  const isBuggedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnectToken, setDisconnectToken] = useState(0);
  const [connectLabel, setConnectLabel] = useState('Connect');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const [info, setInfo] = useState<SmartcubeDeviceInfo>(EMPTY_INFO);
  const [currentFacelets, setCurrentFacelets] = useState<string | null>(null);
  const [currentPattern, setCurrentPattern] = useState<KPattern | null>(null);
  const [lastProcessedMove, setLastProcessedMove] = useState<SmartcubeProcessedMove | null>(null);
  const [showAllBluetoothDevices, setShowAllBluetoothDevicesState] = useState(
    storedSmartCubeDeviceSelection() === 'any',
  );
  const cubeQuaternionRef = useRef<SmartcubeQuaternion | null>(null);
  const [cubeQuaternion, setCubeQuaternion] = useState<SmartcubeQuaternion | null>(null);
  const cubeQuaternionRefMirrorThrottleRef = useRef<number>(0);
  const gyroInfoThrottleRef = useRef<number>(0);
  const gyroInfoRef = useRef<{ quaternionText: string; velocityText: string | null }>({ quaternionText: '', velocityText: null });

  useEffect(() => {
    const connection = connRef.current;
    if (!connected || !connection?.capabilities.battery) return;

    // A completed GATT write does not guarantee a battery reply. Retry missing
    // startup replies, then refresh while connected so the display stays current.
    let cancelled = false;
    let retries = 0;
    const nextDelay = () => batteryLevel == null && retries < 3 ? 2000 : 60_000;
    const requestBattery = async () => {
      if (cancelled || connRef.current !== connection) return;
      retries++;
      try {
        await connection.sendCommand({ type: 'REQUEST_BATTERY' });
      } catch (error) {
        console.warn('Could not refresh smartcube battery', error);
      }
      if (!cancelled && connRef.current === connection) {
        timer = window.setTimeout(() => void requestBattery(), nextDelay());
      }
    };
    let timer = window.setTimeout(() => void requestBattery(), nextDelay());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connected, batteryLevel]);

  useEffect(() => {
    writeOption(
      'smartcubeDeviceSelection',
      showAllBluetoothDevices ? 'any' : 'filtered',
    );
  }, [showAllBluetoothDevices]);

  useEffect(() => {
    gyroscopeEnabledRef.current = gyroscopeEnabled;
  }, [gyroscopeEnabled]);

  useEffect(() => {
    driftRef.current!.setEnabled(gyroscopeEnabled && autoCorrectGyroDrift, performance.now());
  }, [gyroscopeEnabled, autoCorrectGyroDrift]);

  useEffect(() => {
    if (!GYRO_TESTING_ENABLED) return;
    const flush = () => diagnosticsRef.current?.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      flush();
    };
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    function handlePageHide() {
      if (connecting && !connRef.current) {
        connectAbortRef.current?.abort();
      }
    }

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [connecting]);

  const setShowAllBluetoothDevices = useCallback((value: boolean) => {
    setShowAllBluetoothDevicesState(value);
  }, []);

  const customMacAddressProvider: MacAddressProvider = useCallback(async (device, isFallbackCall) => {
    const promptDefault = getCachedMacForDevice(device) ?? '';
    if (!isFallbackCall) {
      return null;
    }

    const flagHint =
      typeof device.watchAdvertisements !== 'function'
        ? '\n\nOn Chrome, automatic discovery may work if you enable\nchrome://flags/#enable-experimental-web-platform-features'
        : '';

    return window.prompt(
      `Unable to determine cube MAC address!\nPlease enter MAC address manually:${flagHint}`,
      promptDefault,
    );
  }, []);

  const clearSliceBuffer = useCallback(() => {
    if (sliceBufferRef.current) {
      window.clearTimeout(sliceBufferRef.current.timer);
      sliceBufferRef.current = null;
    }
  }, []);

  const resetGyro = useCallback(() => {
    const now = performance.now();
    if (GYRO_TESTING_ENABLED && gyroBasisRef.current) {
      pendingGyroResetRef.current = { basis: gyroBasisRef.current.clone(), correction: driftRef.current!.correction.clone(),
        clickedAt: now, before: driftRef.current!.snapshot(now) };
      diagnosticsRef.current?.record('manual-reset-request', { at: now, ...pendingGyroResetRef.current.before });
    } else {
      diagnosticsRef.current?.record('manual-reset-request', { at: now, reason: 'no-reference-yet' });
    }
    driftRef.current!.reset('manual-reset', now);
    gyroTrainingPatternRef.current = null;
    gyroBasisRef.current = null;
    cubeQuaternionRef.current = null;
    setCubeQuaternion(null);
    diagnosticsRef.current?.flush();
  }, []);

  const handleGyroTrainingEvent = useCallback((event: GyroTrainingEvent) => {
    const now = performance.now();
    if (event.phase === 'ready') {
      gyroTrainingPatternRef.current = event.pattern;
      driftRef.current!.armAlgorithm(event.algorithm, event.reason ?? null, now);
    } else if (event.phase === 'complete') {
      const device = currentPatternRef.current;
      driftRef.current!.completeAlgorithm(device ? guidanceFrameRotation(event.pattern, device) : null, now);
      gyroTrainingPatternRef.current = null;
    } else if (event.phase === 'context') {
      diagnosticsRef.current?.record('training-context', { at: now, alwaysScrambleTo: event.alwaysScrambleTo });
    } else if (event.phase === 'guided-recovery-start' || event.phase === 'guided-setup-start') {
      driftRef.current!.guidanceStarted(now, event.phase === 'guided-setup-start' ? 'setup' : 'recovery');
      gyroTrainingPatternRef.current = null;
    } else if (event.phase === 'guided-recovery-cancel' || event.phase === 'guided-setup-cancel') {
      driftRef.current!.guidanceCancelled(now, event.phase === 'guided-setup-cancel' ? 'setup' : 'recovery');
    } else if (event.phase === 'guided-recovery-complete' || event.phase === 'guided-setup-complete') {
      const device = currentPatternRef.current;
      // Guidance's frame maps device stickers to the pictured target. This is
      // the inverse of the frame used to render algorithm progress on a 2×2.
      driftRef.current!.observeGuidedGrip(device ? guidanceFrameRotation(device, event.pattern) : null, now,
        event.phase === 'guided-setup-complete' ? 'setup' : 'recovery');
      gyroTrainingPatternRef.current = null;
    } else {
      driftRef.current!.cancelAttempt(event.reason, now);
      gyroTrainingPatternRef.current = null;
    }
  }, []);
  const exportGyroDiagnostics = useCallback(() => {
    diagnosticsRef.current?.record('estimator-snapshot', driftRef.current!.snapshot(performance.now()));
    diagnosticsRef.current?.download();
  }, []);
  const clearGyroDiagnostics = useCallback(() => diagnosticsRef.current?.clear(), []);

  const resetOrientation = useCallback(() => {
    clearSliceBuffer();
    sliceOrientationRef.current = { ...IDENTITY };
  }, [clearSliceBuffer]);

  const disconnect = useCallback(() => {
    driftRef.current!.reset('disconnect', performance.now());
    diagnosticsRef.current?.flush();
    pendingGyroResetRef.current = null;
    gyroTrainingPatternRef.current = null;
    snapshotVersionRef.current += 1;
    pending2x2MovesRef.current = [];
    pending2x2SnapshotRef.current = null;
    if (refreshRef.current) {
      window.clearTimeout(refreshRef.current.timer);
      refreshRef.current.reject(new Error('Cube disconnected.'));
      refreshRef.current = null;
    }
    setStateSyncError(null);
    setStateSyncing(false);
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    clearSliceBuffer();
    connRef.current = null;
    cubeSizeRef.current = 3;
    setCubeSize(3);
    currentPatternRef.current = null;
    sliceOrientationRef.current = { ...IDENTITY };
    recentMovesRef.current = [];
    gyroBasisRef.current = null;
    previousFaceletsRef.current = '';
    isBuggedRef.current = false;
    setConnected(false);
    setConnecting(false);
    setConnectLabel('Connect');
    setBatteryLevel(null);
    setInfo(EMPTY_INFO);
    setCurrentFacelets(null);
    setCurrentPattern(null);
    setLastProcessedMove(null);
    cubeQuaternionRef.current = null;
    setCubeQuaternion(null);
    setDisconnectToken((value) => value + 1);
    void releaseWakeLock();
  }, [clearSliceBuffer]);

  const processResolvedMove = useCallback(async (event: SmartCubeMoveEvent & { timestamp: number }, rawMoves: SmartCubeMoveEvent[], visualMove?: string) => {
    let trackerPattern = currentPatternRef.current;
    if (!trackerPattern) {
      trackerPattern = await solvedPattern(cubeSizeRef.current);
    }

    const currentFacelets = patternToFacelets(trackerPattern);
    const isBuggedState = currentFacelets === previousFaceletsRef.current && !isBuggedRef.current;
    if (isBuggedState) {
      isBuggedRef.current = true;
    }
    previousFaceletsRef.current = currentFacelets;

    for (const rawMove of rawMoves) {
      trackerPattern = trackerPattern.applyMove(rawMove.move);
      recentMovesRef.current.push(rawMove);
    }
    currentPatternRef.current = trackerPattern;
    setCurrentPattern(trackerPattern);

    if (recentMovesRef.current.length > 256) {
      recentMovesRef.current = recentMovesRef.current.slice(-256);
    }
    if (recentMovesRef.current.length > 10) {
      const skew = cubeTimestampCalcSkew(recentMovesRef.current);
      setInfo((current) => ({ ...current, skew: `${skew}%` }));
    }

    const fixSliceOrientation = true;
    const effectiveVisualMove = visualMove
      ? fixSliceOrientation
        ? visualMove
        : rawMoves.map((entry) => entry.move).join(' ')
      : remapMoveForPlayer(event.move, sliceOrientationRef.current);
    const nextSliceOrientation = visualMove && fixSliceOrientation
      ? updateSliceOrientation(sliceOrientationRef.current, visualMove)
      : sliceOrientationRef.current;
    if (visualMove && fixSliceOrientation) {
      sliceOrientationRef.current = nextSliceOrientation;
    }

    const computedKey = `${event.timestamp}:${effectiveVisualMove}:${rawMoves.map((entry) => entry.move).join(',')}`;

    // flushSync forces a synchronous commit so two MOVEs arriving back-to-back (e.g. R'+L
    // for an M' in gyroscope mode) each produce their own render.  Without it, React 18's
    // concurrent scheduler coalesces rapid state updates and App.tsx's effect only sees
    // the second move's key, silently dropping the first.
    flushSync(() => {
      setLastProcessedMove({
        key: computedKey,
        move: event.move,
        rawMoves: rawMoves.map((entry) => ({
          face: entry.face,
          direction: entry.direction,
          move: entry.move,
          localTimestamp: entry.localTimestamp,
          cubeTimestamp: entry.cubeTimestamp,
        })),
        visualMove: effectiveVisualMove,
        currentPattern: trackerPattern,
        isBugged: isBuggedRef.current,
      });
    });
  }, []);

  const flushBufferedMove = useCallback(async () => {
    if (!sliceBufferRef.current || sliceBufferRef.current.event.type !== 'MOVE') {
      clearSliceBuffer();
      return;
    }

    const bufferedEvent = sliceBufferRef.current.event;
    clearSliceBuffer();
    await processResolvedMove(bufferedEvent, [bufferedEvent]);
  }, [clearSliceBuffer, processResolvedMove]);

  const publish2x2Snapshot = useCallback(() => {
    const snapshot = pending2x2SnapshotRef.current;
    if (!snapshot) return false;
    const { pattern, event } = snapshot;
    const queue = pending2x2MovesRef.current;
    const end = event.serial == null ? queue.length - 1 : queue.findIndex(move => move.serial != null && (move.serial & 0xff) === (event.serial! & 0xff));
    const moves = end < 0 ? [] : queue.splice(0, end + 1);
    const last = moves.at(-1);
    if (!last) return false;
    pending2x2SnapshotRef.current = null;
    flushSync(() => setLastProcessedMove({
      key: `${event.timestamp}:${snapshotVersionRef.current}`, move: last.move, rawMoves: moves,
      visualMove: moves.map(move => move.move).join(' '), currentPattern: pattern, isBugged: false,
    }));
    return true;
  }, []);

  const handleCubeEvent = useCallback((event: SmartCubeEvent) => {
    if (event.type === 'HARDWARE') {
      diagnosticsRef.current?.updateDevice({ hardwareName: event.hardwareName, hardwareVersion: event.hardwareVersion,
        softwareVersion: event.softwareVersion, productDate: event.productDate });
      setInfo((current) => ({
        ...current,
        deviceProtocol: connRef.current?.protocol.name || '- n/a -',
        hardwareName: event.hardwareName || '- n/a -',
        hardwareVersion: event.hardwareVersion || '- n/a -',
        softwareVersion: event.softwareVersion || '- n/a -',
        productDate: event.productDate || '- n/a -',
        gyroSupported: event.gyroSupported === true ? 'YES' : 'NO',
      }));
      return;
    }

    if (event.type === 'BATTERY') {
      setBatteryLevel(event.batteryLevel);
      setInfo((current) => ({
        ...current,
        batteryLevel: `${event.batteryLevel}%`,
      }));
      return;
    }

    if (event.type === 'GYRO') {
      const rawQuaternion = gyroQuaternion({ x: event.quaternion.x, y: event.quaternion.z,
        z: -event.quaternion.y, w: event.quaternion.w });
      if (!rawQuaternion) {
        diagnosticsRef.current?.record('invalid-sample', { quaternion: event.quaternion });
        return;
      }
      // This data is primarily for display/debug panels; updating it at gyro-rate
      // causes large React rerender storms. Keep a ref updated always, and
      // throttle state updates.
      gyroInfoRef.current = {
        quaternionText: `x: ${event.quaternion.x.toFixed(3)}, y: ${event.quaternion.y.toFixed(3)}, z: ${event.quaternion.z.toFixed(3)}, w: ${event.quaternion.w.toFixed(3)}`,
        velocityText: event.velocity ? `x: ${event.velocity.x}, y: ${event.velocity.y}, z: ${event.velocity.z}` : null,
      };
      const infoNow = Date.now();
      if (infoNow - gyroInfoThrottleRef.current > 250) {
        gyroInfoThrottleRef.current = infoNow;
        setInfo((current) => ({
          ...current,
          gyroSupported: current.gyroSupported === '- n/a -' ? 'YES' : current.gyroSupported,
          quaternion: gyroInfoRef.current.quaternionText,
          velocity: gyroInfoRef.current.velocityText ?? current.velocity,
        }));
      }

      const gyroNow = performance.now();
      const reset = pendingGyroResetRef.current;
      if (reset) {
        const oldPose = rawQuaternion.clone().premultiply(reset.basis);
        const oldCorrectedPose = oldPose.clone().premultiply(reset.correction);
        diagnosticsRef.current?.record('manual-reset-comparison', {
          at: gyroNow, delayAfterClickMs: gyroNow - reset.clickedAt, beforeClick: reset.before,
          rawAfterClick: quaternionData(rawQuaternion), oldReferencePose: quaternionData(oldPose),
          oldCorrectedPose: quaternionData(oldCorrectedPose),
          residualWithoutAutoCorrection: gyroPoseMetrics(oldPose), residualAfterAutoCorrection: gyroPoseMetrics(oldCorrectedPose),
          requiredCorrection: quaternionData(oldCorrectedPose.clone().invert()),
          newReferencePose: quaternionData(new THREE.Quaternion()),
          assumption: 'white-up-green-front-at-reset',
        });
        pendingGyroResetRef.current = null;
        diagnosticsRef.current?.flush();
      }
      if (!gyroBasisRef.current) {
        gyroBasisRef.current = rawQuaternion.clone().conjugate();
        gyroBasisVersionRef.current += 1;
        diagnosticsRef.current?.record('reference-established', { at: gyroNow, raw: quaternionData(rawQuaternion),
          basisVersion: gyroBasisVersionRef.current });
      }

      const physicalQuaternion = rawQuaternion.clone().premultiply(gyroBasisRef.current);
      const displayQuaternion = driftRef.current!.update(physicalQuaternion, gyroNow).premultiply(HOME_ORIENTATION);
      const next = {
        x: displayQuaternion.x,
        y: displayQuaternion.y,
        z: displayQuaternion.z,
        w: displayQuaternion.w,
        basisVersion: gyroBasisVersionRef.current,
      };

      // Store in ref so consumers (e.g. cube renderer) can read without rerendering App.
      cubeQuaternionRef.current = next;

      // Keep the persisted option state in sync, but throttle to reduce whole-app rerenders.
      const now2 = Date.now();
      if (now2 - cubeQuaternionRefMirrorThrottleRef.current > 250) {
        cubeQuaternionRefMirrorThrottleRef.current = now2;
        setCubeQuaternion(next);
      }
      return;
    }

    if (event.type === 'FACELETS') {
      if (event.facelets.length !== 24 && event.facelets.length !== 54) return;
      const size = event.facelets.length === 24 ? 2 : 3;
      if (size !== cubeSizeRef.current) {
        driftRef.current!.cancelAttempt('puzzle-size-changed', performance.now());
        diagnosticsRef.current?.updateDevice({ cubeSize: size });
        clearSliceBuffer();
        sliceOrientationRef.current = { ...IDENTITY };
        currentPatternRef.current = null;
        pending2x2MovesRef.current = [];
        pending2x2SnapshotRef.current = null;
        previousFaceletsRef.current = '';
        isBuggedRef.current = false;
        cubeSizeRef.current = size;
        setCubeSize(size);
      }
      // Sticker count identifies the puzzle even when this report cannot be
      // used as a physical state. Never leave a MY22 at the 3×3 default just
      // because a cached/older driver omits snapshot provenance.
      if (size === 2 && event.source !== 'device') {
        if (event.source == null) {
          setStateSyncError('The Bluetooth driver needs updating. Restart the dev server, reload Cubedex, and reconnect the cube.');
        }
        return;
      }
      // MoYu32 (and possibly other protocols) may emit FACELETS immediately after each MOVE.
      // If a slice candidate is buffered, leave it alone so the pair-detection window (100 ms
      // timer + next MOVE) can still fire.  Only clear when there is nothing useful buffered.
      const hasBufferedMove = sliceBufferRef.current?.event.type === 'MOVE';
      if (!hasBufferedMove) {
        clearSliceBuffer();
      }
      setCurrentFacelets(event.facelets);
      // Skip the faceletsToPattern update while a move is buffered.  faceletsToPattern is
      // async and resolves on the microtask queue — always before the next MOVE macro-task.
      // If we let it run, currentPatternRef gets overwritten with the intermediate
      // post-first-half state (e.g. post-R2 for an M2), so processResolvedMove would
      // incorrectly apply the first raw move a second time.  processResolvedMove tracks
      // the pattern itself and will call setCurrentPattern when the pair resolves.
      if (!hasBufferedMove) {
        const version = ++snapshotVersionRef.current;
        const connection = connRef.current;
        void faceletsToPattern(event.facelets).then((pattern) => {
          if (version !== snapshotVersionRef.current || connection !== connRef.current) return;
          currentPatternRef.current = pattern;
          setCurrentPattern(pattern);
          setStateSyncError(null);
          setStateSyncing(false);
          const pending = refreshRef.current;
          if (pending) {
            window.clearTimeout(pending.timer);
            refreshRef.current = null;
            pending.resolve(pattern);
          }
          if (size === 2) {
            pending2x2SnapshotRef.current = { pattern, event };
            publish2x2Snapshot();
            // Without a counter a snapshot can only confirm turns that had
            // arrived before it; it cannot be paired with future telemetry.
            if (event.serial == null) pending2x2SnapshotRef.current = null;
            const queue = pending2x2MovesRef.current;
            const lastSerial = queue.at(-1)?.serial;
            const ahead = event.serial != null && lastSerial != null
              && ((event.serial - lastSerial) & 0xff) > 0 && ((event.serial - lastSerial) & 0xff) < 128;
            // Wait for telemetry already represented by this snapshot. Reading
            // it repeatedly cannot recover its move names or hardware timing.
            if (queue.length && !ahead) void refreshPattern().catch(() => {});
          }
        }).catch((error) => console.error('Invalid smartcube facelets', error));
      }
      return;
    }

    if (event.type === 'DISCONNECT') {
      disconnect();
      return;
    }

    if (event.type !== 'MOVE') {
      return;
    }

    const startPattern = gyroTrainingPatternRef.current;
    const devicePattern = currentPatternRef.current;
    driftRef.current!.noteMove(performance.now(), startPattern && devicePattern
      ? guidanceFrameRotation(startPattern, devicePattern) : null);
    gyroTrainingPatternRef.current = null;

    if (cubeSizeRef.current === 2) {
      pending2x2MovesRef.current.push(event);
      // Requested sticker reports can arrive before the corresponding turn
      // notification. Pair late telemetry with that report without another read.
      if (publish2x2Snapshot() && !pending2x2MovesRef.current.length) return;
      // Do not infer a physical state from ambiguous U/R/F axis telemetry.
      void refreshPattern().catch(() => {});
      return;
    }

    const currentGyroscopeEnabled = gyroscopeEnabledRef.current;
    const sliceCandidate = isSliceCandidate(event.move);

    if (!currentGyroscopeEnabled && cubeSizeRef.current === 3) {
      if (sliceCandidate) {
        if (sliceBufferRef.current?.event.type === 'MOVE') {
          const bufferedEvent = sliceBufferRef.current.event;
          clearSliceBuffer();
          const sliceMove = getSliceForPair(bufferedEvent.move, event.move);
          if (sliceMove) {
            void processResolvedMove(event, [bufferedEvent, event], sliceMove);
          } else {
            // Not a slice pair.  Flush the buffered event, then re-buffer the
            // incoming event so each gets its own React render and the effect in
            // App.tsx sees both moves.  A chained .then() would let React 18's
            // automatic batching collapse both setLastProcessedMove calls into one
            // render, silently dropping the first move.
            void processResolvedMove(bufferedEvent, [bufferedEvent]);
            sliceBufferRef.current = {
              event,
              timer: window.setTimeout(() => {
                void flushBufferedMove();
              }, 100),
            };
          }
          return;
        }

        sliceBufferRef.current = {
          event,
          timer: window.setTimeout(() => {
            void flushBufferedMove();
          }, 100),
        };
        return;
      }

      if (sliceBufferRef.current) {
        // Same React-18 batching concern: schedule the non-slice-candidate move
        // in a macrotask so it renders separately from the flushed buffer event.
        void flushBufferedMove();
        window.setTimeout(() => void processResolvedMove(event, [event]), 0);
        return;
      }
    } else if (sliceBufferRef.current) {
      void flushBufferedMove();
      return;
    }
    void processResolvedMove(event, [event]);
  }, [clearSliceBuffer, disconnect, flushBufferedMove, processResolvedMove, publish2x2Snapshot, refreshPattern]);

  const connectOrDisconnect = useCallback(async () => {
    if (connRef.current) {
      await connRef.current.disconnect();
      disconnect();
      return;
    }

    if (connecting) {
      connectAbortRef.current?.abort();
      setConnectLabel('Connect');
      setConnecting(false);
      connectAbortRef.current = null;
      return;
    }

    const abortController = new AbortController();
    connectAbortRef.current = abortController;
    setConnecting(true);

    let newConn: SmartCubeConnection | undefined;
    try {
      newConn = await connectSmartCube({
        macAddressProvider: customMacAddressProvider,
        enableAddressSearch: true,
        deviceSelection: showAllBluetoothDevices ? 'any' : 'filtered',
        signal: abortController.signal,
        onStatus: (msg) => {
          setConnectLabel(msg);
        },
      });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      if (!aborted) {
        console.error(error);
        const msg = error instanceof Error ? error.message : String(error);
        window.alert(msg);
      }
      setConnectLabel('Connect');
    } finally {
      setConnecting(false);
      connectAbortRef.current = null;
    }

    if (!newConn) {
      return;
    }

    connRef.current = newConn;
    // Known 2×2 models can be identified before the first requested snapshot
    // arrives. Facelet reports still determine size for other device names.
    if (/^(?:WCU_MY22_|gan(?:251ui|ic251)(?:[_-]|$))/i.test(newConn.deviceName)) {
      cubeSizeRef.current = 2;
      setCubeSize(2);
    }
    diagnosticsRef.current?.startSession({ deviceName: newConn.deviceName, protocol: newConn.protocol.name,
      protocolId: newConn.protocol.id, cubeSize: cubeSizeRef.current });
    subscriptionRef.current = connRef.current.events$.subscribe(handleCubeEvent);

    if (connRef.current.capabilities.hardware) {
      await connRef.current.sendCommand({ type: 'REQUEST_HARDWARE' });
    }
    if (connRef.current.capabilities.facelets) {
      await connRef.current.sendCommand({ type: 'REQUEST_FACELETS' });
    }
    if (connRef.current.capabilities.battery) {
      try {
        await connRef.current.sendCommand({ type: 'REQUEST_BATTERY' });
      } catch (error) {
        console.warn('Could not read smartcube battery', error);
      }
    }

    setInfo((current) => ({
      ...current,
      deviceName: connRef.current?.deviceName || '- n/a -',
      deviceMAC: connRef.current?.deviceMAC || '- n/a -',
      deviceProtocol: connRef.current?.protocol.name || '- n/a -',
      gyroSupported: connRef.current?.capabilities.hardware
        ? current.gyroSupported
        : connRef.current?.capabilities.gyroscope
          ? 'YES'
          : 'NO',
    }));

    setConnected(true);
    setConnectLabel('Disconnect');
    void requestWakeLock();
  }, [connecting, customMacAddressProvider, disconnect, handleCubeEvent, showAllBluetoothDevices]);

  const resetState = useCallback(async () => {
    driftRef.current!.cancelAttempt('cube-state-reset', performance.now());
    gyroTrainingPatternRef.current = null;
    await connRef.current?.sendCommand({ type: 'REQUEST_RESET' });
    if (connRef.current?.capabilities.facelets) {
      await connRef.current.sendCommand({ type: 'REQUEST_FACELETS' });
    }
    clearSliceBuffer();
    sliceOrientationRef.current = { ...IDENTITY };
    currentPatternRef.current = await solvedPattern(cubeSizeRef.current);
    setCurrentFacelets(solvedFacelets(cubeSizeRef.current));
    setCurrentPattern(currentPatternRef.current);
    setLastProcessedMove(null);
  }, [clearSliceBuffer]);

  const battery = useMemo<SmartcubeBatteryState>(
    () => ({
      level: batteryLevel,
      color: batteryLevel == null ? 'default' : batteryColor(batteryLevel),
    }),
    [batteryLevel],
  );

  const gyroSupported = info.gyroSupported === 'YES' || Boolean(connRef.current?.capabilities.gyroscope);
  const gyroSupportResolved = info.gyroSupported !== '- n/a -' || !Boolean(connRef.current?.capabilities.hardware);
  const gyroscopeToggleDisabled = connected && !gyroSupported;

  return useMemo(() => ({
    cubeSize,
    connected,
    connecting,
    disconnectToken,
    connectLabel,
    battery,
    info,
    currentFacelets,
    currentPattern,
    lastProcessedMove,
    showAllBluetoothDevices,
    setShowAllBluetoothDevices,
    connectOrDisconnect,
    resetState,
    refreshPattern,
    stateSyncError,
    stateSyncing,
    resetGyro,
    handleGyroTrainingEvent,
    exportGyroDiagnostics,
    clearGyroDiagnostics,
    resetOrientation,
    gyroSupported,
    gyroSupportResolved,
    gyroscopeToggleDisabled,
    cubeQuaternion,
    cubeQuaternionRef,
  }), [
    battery,
    cubeSize,
    connectLabel,
    connectOrDisconnect,
    connected,
    connecting,
    cubeQuaternion,
    currentFacelets,
    currentPattern,
    disconnectToken,
    gyroSupportResolved,
    gyroSupported,
    gyroscopeToggleDisabled,
    info,
    lastProcessedMove,
    resetGyro,
    handleGyroTrainingEvent,
    exportGyroDiagnostics,
    clearGyroDiagnostics,
    resetOrientation,
    resetState,
    refreshPattern,
    stateSyncError,
    stateSyncing,
    setShowAllBluetoothDevices,
    showAllBluetoothDevices,
  ]);
}
