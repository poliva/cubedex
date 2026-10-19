import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { TwistyPlayer } from 'cubing/twisty';
import type { KPattern } from 'cubing/kpuzzle';
import { patternToPlayerAlg } from '../lib/scramble';
import { get2x2VisualDelta } from '../lib/training-visual';
import type { PuzzleId } from '../lib/puzzles';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

export interface TwistyCubeProps {
  puzzle?: PuzzleId;
  alg: string;
  targetPattern?: KPattern | null;
  autoplay?: boolean;
  tempoScale?: number;
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
  orientationResetToken?: string | number;
  orientationResetAlg?: string | null;
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
  puzzle = '3x3x3',
  alg,
  targetPattern = null,
  autoplay = false,
  tempoScale = 5,
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
  orientationResetToken,
  orientationResetAlg = null,
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
  const targetPatternRef = useRef<KPattern | null>(null);
  const targetSeedRef = useRef<{ alg: string; resetToken: string | number | undefined } | null>(null);
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
  }, [visualization, puzzle]);

  useEffect(() => {
    if (!hostRef.current || playerRef.current) {
      return;
    }

    const existing = hostRef.current.querySelector('twisty-player') as (TwistyPlayer & HTMLElement) | null;
    const player = existing ?? new TwistyPlayer({
      puzzle,
      visualization: toVisualization(visualization),
      alg,
      experimentalSetupAnchor: setupAnchor,
      background,
      controlPanel: controlPanel === 'bottom-row' ? 'bottom-row' : 'none',
      viewerLink: 'none',
      hintFacelets: hintFacelets === 'floating' ? 'floating' : 'none',
      experimentalDragInput: dragInput,
      tempoScale,
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
      player.pause();
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

    player.puzzle = puzzle;
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
    puzzle,
    hintFacelets,
    setupAlg,
    setupAnchor,
    visualization,
  ]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (orientationResetAlg != null && !targetPattern) {
      player.alg = orientationResetAlg;
    }
    if (cameraLatitude != null) {
      player.cameraLatitude = cameraLatitude;
    }
    if (cameraLongitude != null) {
      player.cameraLongitude = cameraLongitude;
    }
    vantageRef.current?.render?.();
  }, [cameraLatitude, cameraLongitude, orientationResetAlg, orientationResetToken]);

  useEffect(() => {
    const player = playerRef.current;
    const duplicateMove = Boolean(appendMoveKey) && appendedMoveKeyRef.current === appendMoveKey;
    if (targetPattern) {
      // The target already includes this event. Do not replay it if the user
      // leaves training for the editor before another physical turn arrives.
      appendedMoveKeyRef.current = appendMoveKey ?? '';
      return;
    }
    if (!player || !appendMove || !appendMoveKey) {
      return;
    }
    if (duplicateMove) {
      return;
    }

    appendedMoveKeyRef.current = appendMoveKey;
    for (const move of appendMove.trim().split(/\s+/)) {
      if (!move) {
        continue;
      }
      player.experimentalAddMove(move, { cancel: false });
    }
  }, [appendMove, appendMoveKey, targetPattern]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !targetPattern) {
      targetPatternRef.current = null;
      targetSeedRef.current = null;
      return;
    }
    const previous = targetPatternRef.current;
    const seed = targetSeedRef.current;
    const delta = previous && seed?.alg === alg && seed.resetToken === resetToken
      ? get2x2VisualDelta(previous, targetPattern) : null;
    targetPatternRef.current = targetPattern;
    targetSeedRef.current = { alg, resetToken };
    if (delta === null) {
      // Case changes and batched turns replace the picture exactly. Never
      // animate a stale raw axis sequence over a different reference frame.
      player.pause();
      player.alg = patternToPlayerAlg(targetPattern);
    } else {
      for (const move of delta.split(/\s+/).filter(Boolean)) {
        player.experimentalAddMove(move, { cancel: false });
      }
    }
  }, [targetPattern, alg, resetToken]);

  useEffect(() => {
    const player = playerRef.current;
    if (!autoplay || !player || !alg) return;
    player.jumpToStart();
    player.play();
    return () => player.pause();
  }, [autoplay, alg, resetToken]);

  return <div ref={hostRef} className={className} />;
}
