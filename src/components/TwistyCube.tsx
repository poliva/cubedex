import { useEffect, useRef } from 'react';
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
  resetToken?: string | number;
  appendMoveKey?: string;
  appendMove?: string;
  gyroscopeEnabled?: boolean;
  cubeQuaternion?: SmartcubeQuaternion | null;
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
  resetToken,
  appendMoveKey,
  appendMove,
  gyroscopeEnabled = false,
  cubeQuaternion = null,
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

  useEffect(() => {
    latestGyroscopeEnabledRef.current = gyroscopeEnabled;
    latestQuaternionRef.current = cubeQuaternion
      ? new THREE.Quaternion(cubeQuaternion.x, cubeQuaternion.y, cubeQuaternion.z, cubeQuaternion.w)
      : null;
  }, [cubeQuaternion, gyroscopeEnabled]);

  useEffect(() => {
    forceRefreshRef.current = true;
  }, [visualization]);

  useEffect(() => {
    if (!hostRef.current || playerRef.current) {
      return;
    }

    const player = new TwistyPlayer({
      puzzle: '3x3x3',
      visualization: toVisualization(visualization),
      alg,
      experimentalSetupAnchor: setupAnchor,
      background,
      controlPanel: controlPanel === 'bottom-row' ? 'bottom-row' : 'none',
      viewerLink: 'none',
      hintFacelets: hintFacelets === 'floating' ? 'floating' : 'none',
      experimentalDragInput: dragInput,
      cameraLatitude: 0,
      cameraLongitude: 0,
      tempoScale: 5,
      experimentalStickering,
      backView,
    });

    player.experimentalSetupAlg = setupAlg;
    playerRef.current = player;
    hostRef.current.append(player);
    hostRef.current.style.overflow = 'visible';
    forceRefreshRef.current = true;

    async function animateOrientation() {
      const activePlayer = playerRef.current;
      if (!activePlayer) {
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
        if (latestGyroscopeEnabledRef.current && latestQuaternionRef.current) {
          puzzleObject.quaternion.slerp(latestQuaternionRef.current, 0.25);
        } else {
          puzzleObject.quaternion.slerp(DR_LOCK_ORIENTATION, 0.25);
        }
        vantageRef.current?.render?.();
      }

      animationFrameRef.current = window.requestAnimationFrame(animateOrientation);
    }

    animationFrameRef.current = window.requestAnimationFrame(animateOrientation);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      puzzleObjectRef.current = null;
      vantageRef.current = null;
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    appendedMoveKeyRef.current = '';
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

    player.style.width = `${sizePx}px`;
    player.style.height = `${sizePx}px`;
    player.style.maxWidth = 'none';
    player.style.maxHeight = 'none';
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
  }, [backView, controlPanel, dragInput, experimentalStickering, hintFacelets, setupAlg, setupAnchor, visualization]);

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
