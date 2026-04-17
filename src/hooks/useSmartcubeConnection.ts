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
import { faceletsToPattern, patternToFacelets, solvedPattern } from '../lib/cube-utils';
import { readOption, writeOption } from '../lib/legacy-storage';
import {
  getSliceForPair,
  IDENTITY,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
  type FacePerm,
} from '../lib/smartcube-parity';

const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

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

export interface SmartcubeDeviceInfo {
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

export interface SmartcubeBatteryState {
  level: number | null;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'default';
}

export interface SmartcubeQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SmartcubeProcessedMove {
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

export interface SmartcubeConnectionState {
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
  resetGyro: () => void;
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

const HOME_ORIENTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -5 * Math.PI / 180, 0));

function storedSmartCubeDeviceSelection(): 'filtered' | 'any' {
  return readOption('smartcubeDeviceSelection') === 'any' ? 'any' : 'filtered';
}

function batteryColor(level: number): SmartcubeBatteryState['color'] {
  if (level >= 75) return 'green';
  if (level >= 50) return 'yellow';
  if (level >= 20) return 'orange';
  return 'red';
}

export function useSmartcubeConnection(gyroscopeEnabled: boolean): SmartcubeConnectionState {
  const connRef = useRef<SmartCubeConnection | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const currentPatternRef = useRef<KPattern | null>(null);
  const sliceBufferRef = useRef<{ event: SmartCubeEvent; timer: number } | null>(null);
  const sliceOrientationRef = useRef<FacePerm>({ ...IDENTITY });
  const recentMovesRef = useRef<SmartCubeMoveEvent[]>([]);
  const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
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
    writeOption(
      'smartcubeDeviceSelection',
      showAllBluetoothDevices ? 'any' : 'filtered',
    );
  }, [showAllBluetoothDevices]);

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
    gyroBasisRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    clearSliceBuffer();
    connRef.current = null;
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
      trackerPattern = await solvedPattern();
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

    const effectiveVisualMove = visualMove
      ? visualMove
      : remapMoveForPlayer(event.move, sliceOrientationRef.current);
    if (visualMove) {
      sliceOrientationRef.current = updateSliceOrientation(sliceOrientationRef.current, visualMove);
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

  const handleCubeEvent = useCallback((event: SmartCubeEvent) => {
    if (event.type === 'HARDWARE') {
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

      const rawQuaternion = new THREE.Quaternion(
        event.quaternion.x,
        event.quaternion.z,
        -event.quaternion.y,
        event.quaternion.w,
      ).normalize();

      if (!gyroBasisRef.current) {
        gyroBasisRef.current = rawQuaternion.clone().conjugate();
      }

      const displayQuaternion = rawQuaternion.clone().premultiply(gyroBasisRef.current).premultiply(HOME_ORIENTATION);
      const next = {
        x: displayQuaternion.x,
        y: displayQuaternion.y,
        z: displayQuaternion.z,
        w: displayQuaternion.w,
      };

      // Store in ref so consumers (e.g. cube renderer) can read without rerendering App.
      cubeQuaternionRef.current = next;

      // Keep legacy state updated, but throttle to reduce whole-app rerenders.
      const now2 = Date.now();
      if (now2 - cubeQuaternionRefMirrorThrottleRef.current > 250) {
        cubeQuaternionRefMirrorThrottleRef.current = now2;
        setCubeQuaternion(next);
      }
      return;
    }

    if (event.type === 'FACELETS') {
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
        void faceletsToPattern(event.facelets).then((pattern) => {
          currentPatternRef.current = pattern;
          setCurrentPattern(pattern);
        });
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

    if (!gyroscopeEnabled) {
      const sliceCandidate = isSliceCandidate(event.move);

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
  }, [clearSliceBuffer, disconnect, flushBufferedMove, gyroscopeEnabled, processResolvedMove]);

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
    subscriptionRef.current = connRef.current.events$.subscribe(handleCubeEvent);

    if (connRef.current.capabilities.hardware) {
      await connRef.current.sendCommand({ type: 'REQUEST_HARDWARE' });
    }
    if (connRef.current.capabilities.facelets) {
      await connRef.current.sendCommand({ type: 'REQUEST_FACELETS' });
    }
    if (connRef.current.capabilities.battery) {
      await connRef.current.sendCommand({ type: 'REQUEST_BATTERY' });
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
    await connRef.current?.sendCommand({ type: 'REQUEST_RESET' });
    if (connRef.current?.capabilities.facelets) {
      await connRef.current.sendCommand({ type: 'REQUEST_FACELETS' });
    }
    clearSliceBuffer();
    sliceOrientationRef.current = { ...IDENTITY };
    currentPatternRef.current = await solvedPattern();
    setCurrentFacelets(SOLVED_FACELETS);
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

  return {
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
    resetGyro,
    gyroSupported,
    gyroSupportResolved,
    gyroscopeToggleDisabled,
    cubeQuaternion,
    cubeQuaternionRef,
  };
}
