import { useId } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { GripRotation } from '../lib/cube-orientation';
import { TwistyCube } from './TwistyCube';

function RotationArrow({ axis, direction }: Pick<GripRotation, 'axis' | 'direction'>) {
  const marker = useId().replace(/:/g, '');
  const normal = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const start = axis === 'y' ? new Vector3(0, 0, 1.45) : new Vector3(0, 1.45, 0);
  const right = new Vector3(Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6));
  const up = new Vector3(-.25, Math.cos(Math.PI / 6), -Math.sqrt(3) / 4);
  const points = Array.from({ length: 33 }, (_, i) => {
    const angle = direction * (-75 + i * 150 / 32) * Math.PI / 180;
    const point = start.clone().applyQuaternion(new Quaternion().setFromAxisAngle(normal, angle));
    return `${60 + 34 * point.dot(right)},${60 - 34 * point.dot(up)}`;
  });
  return <svg className="grip-rotation-arrow" viewBox="0 0 120 120" aria-hidden="true" data-axis={axis} data-direction={direction}>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
    </marker></defs>
    <path d={`M ${points.join(' L ')}`} fill="none" stroke="var(--surface)" strokeWidth="8" strokeLinecap="round" />
    <path d={`M ${points.join(' L ')}`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" markerEnd={`url(#${marker})`} />
  </svg>;
}

export function GripRotationWarning({ rotation, setupAlg, size, onResetGyro }: {
  rotation: GripRotation;
  setupAlg: string;
  size: 2 | 3;
  onResetGyro: () => void;
}) {
  return <div className="grip-warning" role="alert" aria-label="Cube orientation warning">
    <div className="grip-warning__preview" aria-hidden="true">
      <span>Your grip</span>
      <div className="grip-warning__cube">
        <TwistyCube puzzle={size === 2 ? '2x2x2' : '3x3x3'} setupAlg={setupAlg} alg=""
          visualization="3D" hintFacelets="none" controlPanel="none" experimentalStickering="full"
          cameraLatitude={30} cameraLongitude={30} dragInput="none" backView="none"
          gyroscopeEnabled cubeQuaternion={rotation.visualQuaternion} enableExternalOrientationLoop
          className="grip-warning__player" />
        <RotationArrow axis={rotation.axis} direction={rotation.direction} />
      </div>
    </div>
    <div className="grip-warning__instructions">
      <strong>Rotate the whole cube</strong>
      <p>{rotation.instruction} Match the large picture below. Keep the layers still.</p>
    </div>
    <div className="grip-warning__reset">
      <span>Preview wrong? Hold white on top and green in front, then reset.</span>
      <button type="button" className="recovery-button" onClick={onResetGyro}>Reset Gyro</button>
    </div>
  </div>;
}
