import { memo } from 'react';
import type { MutableRefObject } from 'react';
import { TwistyCube } from '../components/TwistyCube';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

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
  appendMoveKey,
  appendMove,
  gyroscopeEnabled,
  cubeQuaternionRef,
}: {
  alg: string;
  sizePx: number;
  visualization: string;
  hintFacelets: string;
  controlPanel: string;
  experimentalStickering: string;
  setupAlg: string;
  backView: 'none' | 'side-by-side' | 'top-right';
  resetToken: string;
  appendMoveKey?: string;
  appendMove?: string;
  gyroscopeEnabled: boolean;
  cubeQuaternionRef: MutableRefObject<SmartcubeQuaternion | null>;
}) {
  return (
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
      appendMoveKey={appendMoveKey}
      appendMove={appendMove}
      gyroscopeEnabled={gyroscopeEnabled}
      cubeQuaternionRef={cubeQuaternionRef}
      className="twisty-cube-host"
    />
  );
}

export const MainCubeArea = memo(MainCubeAreaComponent);

