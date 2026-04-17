import { memo } from 'react';
import type { MutableRefObject } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TwistyCube } from '../components/TwistyCube';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

interface MainCubeAreaProps {
  alg: string;
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
  cubeQuaternionRef: MutableRefObject<SmartcubeQuaternion | null>;
}

function MainCubeAreaComponent({
  alg,
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
  cubeQuaternionRef,
}: MainCubeAreaProps) {
  return (
    <ErrorBoundary resetKey={`${resetToken}:${orientationResetToken}:${alg}`}>
      <TwistyCube
        alg={alg}
        sizePx={sizePx}
        visualization={visualization}
        hintFacelets={hintFacelets}
        controlPanel={controlPanel}
        experimentalStickering={experimentalStickering}
        setupAlg={setupAlg}
        cameraLatitude={0}
        cameraLongitude={0}
        backView={backView}
        resetToken={resetToken}
        orientationResetToken={orientationResetToken}
        orientationResetAlg={orientationResetAlg}
        appendMoveKey={appendMoveKey}
        appendMove={appendMove}
        gyroscopeEnabled={gyroscopeEnabled}
        cubeQuaternionRef={cubeQuaternionRef}
        className="twisty-cube-host"
      />
    </ErrorBoundary>
  );
}

export const MainCubeArea = memo(MainCubeAreaComponent);

