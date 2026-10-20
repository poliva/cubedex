import { memo } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { PuzzleId } from '../lib/puzzles';
import type { MutableRefObject } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TwistyCube } from '../components/TwistyCube';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

interface MainCubeAreaProps {
  puzzle?: PuzzleId;
  alg: string;
  targetPattern?: KPattern | null;
  /** Keep the pictured stickers fixed; gyro poses retain the connection reference. */
  fixedOrientation?: boolean;
  sizePx: number;
  visualization: string;
  hintFacelets: string;
  controlPanel: string;
  experimentalStickering: string;
  setupAlg: string;
  backView: 'none' | 'side-by-side' | 'top-right';
  resetToken: string;
  orientationResetToken: number;
  orientationResetAlg: string | null;
  appendMoveKey?: string;
  appendMove?: string;
  gyroscopeEnabled: boolean;
  gyroFrameQuaternion?: SmartcubeQuaternion | null;
  cubeQuaternionRef: MutableRefObject<SmartcubeQuaternion | null>;
}

function MainCubeAreaComponent({
  puzzle,
  alg,
  targetPattern,
  fixedOrientation = false,
  sizePx,
  visualization,
  hintFacelets,
  controlPanel,
  experimentalStickering,
  setupAlg,
  backView,
  resetToken,
  orientationResetToken,
  orientationResetAlg,
  appendMoveKey,
  appendMove,
  gyroscopeEnabled,
  gyroFrameQuaternion,
  cubeQuaternionRef,
}: MainCubeAreaProps) {
  return (
    <ErrorBoundary resetKey={`${puzzle}:${resetToken}:${orientationResetToken}:${alg}`}>
      <TwistyCube
        key={`${puzzle}:${fixedOrientation}`}
        puzzle={puzzle}
        alg={alg}
        targetPattern={targetPattern}
        sizePx={sizePx}
        visualization={visualization}
        hintFacelets={hintFacelets}
        controlPanel={controlPanel}
        experimentalStickering={experimentalStickering}
        setupAlg={fixedOrientation ? '' : setupAlg}
        cameraLatitude={fixedOrientation && !gyroscopeEnabled ? 30 : 0}
        cameraLongitude={fixedOrientation && !gyroscopeEnabled ? 30 : 0}
        dragInput={fixedOrientation ? 'none' : 'auto'}
        enableExternalOrientationLoop={!fixedOrientation || gyroscopeEnabled}
        backView={backView}
        resetToken={resetToken}
        orientationResetToken={orientationResetToken}
        orientationResetAlg={orientationResetAlg}
        appendMoveKey={appendMoveKey}
        appendMove={appendMove}
        gyroscopeEnabled={gyroscopeEnabled}
        fixedOrientation={fixedOrientation}
        gyroFrameQuaternion={gyroFrameQuaternion}
        cubeQuaternionRef={cubeQuaternionRef}
        className="twisty-cube-host"
      />
    </ErrorBoundary>
  );
}

export const MainCubeArea = memo(MainCubeAreaComponent);

