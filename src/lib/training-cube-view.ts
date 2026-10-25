import { Quaternion, Vector3 } from 'three';
import { HOME_ORIENTATION } from './cube-orientation';
import type { SmartcubeQuaternion } from '../hooks/useSmartcubeConnection';

export type TrainingCubeView = {
  phase: 'free' | 'ready' | 'executing';
  /** Captured synchronously at the first face move, before its sticker frame changes. */
  anchor: SmartcubeQuaternion | null;
};

export const DEFAULT_VIEW_ANGLE_DEG = 0;
export const MIN_VIEW_ANGLE_DEG = -45;
export const MAX_VIEW_ANGLE_DEG = 45;
export const READY_YAW_RECENTER_MS = 30_000;

export function referenceViewOrientation(angleDeg: number) {
  return new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 15 * Math.PI / 180)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -angleDeg * Math.PI / 180));
}

/** Heading about world up, excluding live tilt. Undefined at an exact inverted swing. */
function heading(q: Quaternion) {
  const length = Math.hypot(q.y, q.w);
  return length > 1e-6 ? new Quaternion(0, q.y / length, 0, q.w / length) : null;
}

/** Presentation only. Follow full live rotations and gently recenter heading between attempts.
 * The view transform never feeds the gyro learner. */
export class TrainingCubeOrientation {
  private anchor: SmartcubeQuaternion | null = null;
  private offset = new Quaternion();
  private basisVersion: number | undefined;
  private lastRelative = new Quaternion();
  private readyHeading = new Quaternion();
  private readyOffset = new Quaternion();
  private readyInitialized = false;
  private readyAt: number | null = null;
  private readyBasis: number | undefined;
  private readyView: TrainingCubeView | null = null;

  private readyPose(measured: Quaternion, live: SmartcubeQuaternion, view: TrainingCubeView, at: number) {
    const yaw = heading(measured);
    if (!this.readyInitialized || this.readyBasis !== live.basisVersion) {
      if (yaw) {
        this.readyHeading.copy(yaw);
        this.readyInitialized = true;
      }
    } else if (yaw) {
      // A case change is not a gyro reset. Keep the same center through
      // completion/regripping, without counting execution time as ready time.
      const gap = this.readyView === view && this.readyAt != null ? at - this.readyAt : 0;
      // Rendering frequency must not change the feel or extrapolate a paused tab.
      if (gap > 0 && gap <= 200) this.readyHeading.slerp(yaw, 1 - Math.exp(-gap / READY_YAW_RECENTER_MS));
    }
    // Keep the full quaternion delta: clipping its heading locks inspection and
    // makes the displayed pose jump when the shortest heading crosses +/-180°.
    this.readyOffset.copy(this.readyHeading).invert();
    this.readyView = view;
    this.readyBasis = live.basisVersion;
    this.readyAt = at;
    this.readyHeading.normalize();
    this.lastRelative.copy(this.readyOffset).multiply(measured).normalize();
  }

  target(live: SmartcubeQuaternion | null, frame: Quaternion, view: TrainingCubeView, angleDeg: number, at = performance.now()) {
    const reference = referenceViewOrientation(angleDeg);
    const measured = live ? HOME_ORIENTATION.clone().invert()
      .multiply(new Quaternion(live.x, live.y, live.z, live.w)).multiply(frame) : null;
    if (view.phase === 'ready') {
      this.anchor = null;
      if (measured && live) this.readyPose(measured, live, view, at);
      return reference.multiply(this.lastRelative);
    }
    if (view.phase === 'free') {
      this.anchor = null;
      this.lastRelative.identity();
      this.readyView = null;
      this.readyInitialized = false;
      return measured ? reference.multiply(measured) : reference;
    }
    if (this.anchor !== view.anchor) {
      this.anchor = view.anchor;
      if (view.anchor) {
        const start = HOME_ORIENTATION.clone().invert().multiply(
          new Quaternion(view.anchor.x, view.anchor.y, view.anchor.z, view.anchor.w));
        if (!this.readyInitialized || this.readyBasis !== view.anchor.basisVersion) {
          this.readyHeading.copy(heading(start) ?? this.readyHeading);
          this.readyOffset.copy(this.readyHeading).invert();
          this.readyBasis = view.anchor.basisVersion;
          this.readyInitialized = true;
        }
        // Keep the displayed inspection yaw at the first face turn. Re-zeroing
        // the entire starting heading here would make that turn visibly snap.
        if (this.readyView && this.readyBasis === view.anchor.basisVersion) this.offset.copy(this.readyOffset);
        else this.offset.copy(this.readyHeading).invert();
      }
      this.basisVersion = view.anchor?.basisVersion;
    }
    if (!measured || !live) return reference.multiply(this.lastRelative);
    if (!view.anchor) {
      this.readyPose(measured, live, view, at);
      return reference.multiply(this.lastRelative);
    }
    this.readyView = null;
    if (this.basisVersion !== live.basisVersion) {
      // Reset Gyro changes sensor coordinates, not the running virtual pose.
      this.offset.copy(this.lastRelative).multiply(measured.clone().invert());
      this.basisVersion = live.basisVersion;
    }
    this.lastRelative.copy(this.offset).multiply(measured).normalize();
    return reference.multiply(this.lastRelative);
  }
}
