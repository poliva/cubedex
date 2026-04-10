import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { TwistyPlayer } from 'cubing/twisty';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

export interface TwistyCubeProps {
  alg: string;
  sizePx?: number;
  visualization: string;
  hintFacelets: string;
  controlPanel: string;
  experimentalStickering: string;
  setupAlg?: string;
  setupAnchor?: 'start' | 'end';
  background?: 'none' | 'checkered';
  dragInput?: 'auto' | 'none';
  backView?: 'none' | 'side-by-side' | 'top-right';
  cameraLatitude?: number;
  cameraLongitude?: number;
  resetToken?: string | number;
  appendMoveKey?: string;
  appendMove?: string;
  gyroscopeEnabled?: boolean;
  cubeQuaternion?: SmartcubeQuaternion | null;
  cubeQuaternionRef?: MutableRefObject<SmartcubeQuaternion | null>;
  enableExternalOrientationLoop?: boolean;
  nudgeRenderOnMount?: boolean;
  className?: string;
}

const DR_LOCK_ORIENTATION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0),
);

function toVisualization(value: string) {
  switch (value) {
    case '2D':
      return '2D';
    case '3D':
      return '3D';
    case 'experimental-2D-LL':
      return 'experimental-2D-LL';
    case 'experimental-2D-LL-face':
      return 'experimental-2D-LL-face';
    case 'PG3D':
    default:
      return 'PG3D';
  }
}

export function TwistyCube({
  alg,
  sizePx,
  visualization,
  hintFacelets,
  controlPanel,
  experimentalStickering,
  setupAlg = '',
  setupAnchor = 'start',
  background = 'none',
  dragInput = 'auto',
  backView = 'none',
  cameraLatitude,
  cameraLongitude,
  resetToken,
  appendMoveKey,
  appendMove,
  gyroscopeEnabled = false,
  cubeQuaternion = null,
  cubeQuaternionRef,
  enableExternalOrientationLoop = true,
  nudgeRenderOnMount = false,
  className,
}: TwistyCubeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const appendedMoveKeyRef = useRef('');
  const animationFrameRef = useRef<number | null>(null);
  const puzzleObjectRef = useRef<THREE.Object3D | null>(null);
  const vantageRef = useRef<{ render?: () => void } | null>(null);
  const latestQuaternionRef = useRef<THREE.Quaternion | null>(null);
  const latestGyroscopeEnabledRef = useRef(false);
  const forceRefreshRef = useRef(false);
  const latestEnableLoopRef = useRef(true);
  const targetQuaternionRef = useRef(new THREE.Quaternion());

  useEffect(() => {
    latestGyroscopeEnabledRef.current = gyroscopeEnabled;
    latestEnableLoopRef.current = enableExternalOrientationLoop;
    const q = cubeQuaternionRef?.current ?? cubeQuaternion;
    latestQuaternionRef.current = q
      ? new THREE.Quaternion(q.x, q.y, q.z, q.w)
      : null;
  }, [cubeQuaternion, cubeQuaternionRef, enableExternalOrientationLoop, gyroscopeEnabled]);

  useEffect(() => {
    forceRefreshRef.current = true;
  }, [visualization]);

  useEffect(() => {
    if (!hostRef.current || playerRef.current) {
      return;
    }

    const existing = hostRef.current.querySelector('twisty-player') as (TwistyPlayer & HTMLElement) | null;
    const player = existing ?? new TwistyPlayer({
      puzzle: '3x3x3',
      visualization: toVisualization(visualization),
      alg,
      experimentalSetupAnchor: setupAnchor,
      background,
      controlPanel: controlPanel === 'bottom-row' ? 'bottom-row' : 'none',
      viewerLink: 'none',
      hintFacelets: hintFacelets === 'floating' ? 'floating' : 'none',
      experimentalDragInput: dragInput,
      tempoScale: 5,
      experimentalStickering,
      backView,
    });

    player.experimentalSetupAlg = setupAlg;
    if (cameraLatitude != null) {
      player.cameraLatitude = cameraLatitude;
    }
    if (cameraLongitude != null) {
      player.cameraLongitude = cameraLongitude;
    }
    playerRef.current = player;
    if (!existing) {
      hostRef.current.append(player);
    }
    hostRef.current.style.overflow = 'visible';
    forceRefreshRef.current = true;

    if (nudgeRenderOnMount) {
      // Twisty sometimes initializes before it has a stable size; nudge a render to avoid stale/blank frames.
      queueMicrotask(() => {
        void (async () => {
          try {
            const vantages = await player.experimentalCurrentVantages();
            const vantage = [...vantages][0] as { render?: () => void } | undefined;
            vantage?.render?.();
          } catch {
            // ignore
          }
        })();
      });
    }

    async function animateOrientation() {
      const activePlayer = playerRef.current;
      if (!activePlayer) {
        return;
      }

      if (!latestEnableLoopRef.current) {
        animationFrameRef.current = null;
        return;
      }

      if (!puzzleObjectRef.current || !vantageRef.current || forceRefreshRef.current) {
        try {
          const vantageList = await activePlayer.experimentalCurrentVantages();
          vantageRef.current = [...vantageList][0] ?? null;
          puzzleObjectRef.current = await activePlayer.experimentalCurrentThreeJSPuzzleObject();
          forceRefreshRef.current = false;
        } catch {
          puzzleObjectRef.current = null;
          vantageRef.current = null;
        }
      }

      const puzzleObject = puzzleObjectRef.current;
      if (puzzleObject) {
        const liveQuaternion = cubeQuaternionRef?.current ?? null;
        if (latestGyroscopeEnabledRef.current && liveQuaternion) {
          targetQuaternionRef.current.set(liveQuaternion.x, liveQuaternion.y, liveQuaternion.z, liveQuaternion.w);
          puzzleObject.quaternion.slerp(targetQuaternionRef.current, 0.25);
        } else {
          puzzleObject.quaternion.slerp(DR_LOCK_ORIENTATION, 0.25);
        }
        vantageRef.current?.render?.();
      }

      animationFrameRef.current = window.requestAnimationFrame(animateOrientation);
    }

    if (enableExternalOrientationLoop) {
      animationFrameRef.current = window.requestAnimationFrame(animateOrientation);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      puzzleObjectRef.current = null;
      vantageRef.current = null;
      // Important: do NOT manually detach `player` from the DOM here.
      // React will remove the subtree during unmount; manual removal can race and trigger NotFoundError.
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    // Prevent replaying a previously-processed smartcube move when the cube resets due to
    // algorithm/selection changes (appendMoveKey is still "old" until the next physical move).
    //
    // Important: do NOT include appendMoveKey in this effect's deps, otherwise every physical move
    // would reset player.alg and the cube would appear to "not follow" the smartcube.
    appendedMoveKeyRef.current = appendMoveKey ?? '';
    player.alg = alg;
  }, [alg, resetToken]);

  useEffect(() => {
    const player = playerRef.current as (TwistyPlayer & HTMLElement) | null;
    if (!player) {
      return;
    }

    if (sizePx == null) {
      player.style.removeProperty('width');
      player.style.removeProperty('height');
      player.style.removeProperty('max-width');
      player.style.removeProperty('max-height');
      player.style.removeProperty('overflow');
      return;
    }

    /* Fill host (width capped by parent min(100%, sizePx)); max-* caps upscaling on wide hosts */
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.maxWidth = `${sizePx}px`;
    player.style.maxHeight = `${sizePx}px`;
    player.style.boxSizing = 'border-box';
    player.style.overflow = 'visible';
  }, [sizePx]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    player.visualization = toVisualization(visualization);
    player.controlPanel = controlPanel === 'bottom-row' ? 'bottom-row' : 'none';
    player.hintFacelets = hintFacelets === 'floating' ? 'floating' : 'none';
    player.experimentalStickering = experimentalStickering;
    player.experimentalSetupAlg = setupAlg;
    player.experimentalSetupAnchor = setupAnchor;
    player.experimentalDragInput = dragInput;
    player.backView = backView;
    if (cameraLatitude != null) {
      player.cameraLatitude = cameraLatitude;
    }
    if (cameraLongitude != null) {
      player.cameraLongitude = cameraLongitude;
    }
  }, [
    backView,
    cameraLatitude,
    cameraLongitude,
    controlPanel,
    dragInput,
    experimentalStickering,
    hintFacelets,
    setupAlg,
    setupAnchor,
    visualization,
  ]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !appendMove || !appendMoveKey) {
      return;
    }
    if (appendedMoveKeyRef.current === appendMoveKey) {
      return;
    }

    appendedMoveKeyRef.current = appendMoveKey;
    player.experimentalAddMove(appendMove, { cancel: false });
  }, [appendMove, appendMoveKey]);

  return <div ref={hostRef} className={className} />;
}
