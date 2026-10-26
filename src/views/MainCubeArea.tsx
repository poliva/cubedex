import { memo, useRef } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { PuzzleId } from '../lib/puzzles';
import type { MutableRefObject } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TwistyCube } from '../components/TwistyCube';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';
import { TrainingCubeOrientation, type TrainingCubeView } from '../lib/training-cube-view';

interface MainCubeAreaProps {
  puzzle?: PuzzleId;
  alg: string;
  targetPattern?: KPattern | null;
  /** Keep the pictured stickers fixed; gyro poses retain the connection reference. */
  fixedOrientation?: boolean;
  sizePx: number;
  visualization: string;
  hintFacelets: string;
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
  trainingViewRef?: MutableRefObject<TrainingCubeView>;
  viewAngleDeg?: number;
}

function MainCubeAreaComponent({
  puzzle,
  alg,
  targetPattern,
  fixedOrientation = false,
  sizePx,
  visualization,
  hintFacelets,
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
  trainingViewRef,
  viewAngleDeg,
}: MainCubeAreaProps) {
  // Sticker-layout changes can remount Twisty during the first turn. Keep the
  // inspection heading so that remount does not reset the user's side view.
  const trainingOrientationRef = useRef(new TrainingCubeOrientation());
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
        experimentalStickering={experimentalStickering}
        setupAlg={setupAlg}
        cameraLatitude={fixedOrientation && !gyroscopeEnabled ? 30 : 0}
        cameraLongitude={fixedOrientation && !gyroscopeEnabled ? viewAngleDeg ?? 30 : 0}
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
        trainingViewRef={trainingViewRef}
        trainingOrientationRef={trainingOrientationRef}
        viewAngleDeg={viewAngleDeg}
        className="twisty-cube-host"
      />
    </ErrorBoundary>
  );
}

export const MainCubeArea = memo(MainCubeAreaComponent);

