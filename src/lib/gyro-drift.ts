import { Alg, Move } from 'cubing/alg';
import { Quaternion, Vector3 } from 'three';

export const GYRO_ESTIMATOR_VERSION = 4;

// All angles are in degrees and all times in milliseconds. Keep these in the
// exported report so recordings remain interpretable after thresholds change.
export const GYRO_DRIFT_THRESHOLDS = {
  steadyMs: 600,
  steadySpreadDeg: 0.8,
  steadySpeedDegPerSecond: 12,
  maxSampleGapMs: 200,
  maxSampleAgeMs: 200,
  minCorrectionDeg: 0.3,
  maxTableTiltDeg: 10,
  endpointSteadyMs: 150,
  endpointMinSamples: 3,
  endpointYawSpreadDeg: 0.8,
  endpointYawSpeedDegPerSecond: 12,
  endpointTimeoutMs: 3000,
  maxEndpointYawDeg: 10,
  maxEndpointTiltChangeDeg: 8,
  endpointGain: 0.5,
  maxEndpointCorrectionDeg: 3,
  correctionSpeedDegPerSecond: 4,
} as const;

export type GyroQuaternion = { x: number; y: number; z: number; w: number };
export type GyroLog = (event: string, data: Record<string, unknown>) => void;
const DEG = 180 / Math.PI;
const UP = new Vector3(0, 1, 0);
const FACE_NORMALS = [new Vector3(0, 1, 0), new Vector3(0, -1, 0),
  new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const FACE_NAMES = ['U', 'D', 'R', 'L', 'F', 'B'];

export function gyroQuaternion(q: GyroQuaternion) {
  if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) return null;
  const result = new Quaternion(q.x, q.y, q.z, q.w);
  return result.lengthSq() > 1e-8 ? result.normalize() : null;
}

export function quaternionData(q: GyroQuaternion): GyroQuaternion {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** World-up twist, with null for the upside-down singularity. */
function yawDegrees(q: Quaternion) {
  if (Math.hypot(q.y, q.w) < 1e-8) return null;
  const yaw = 2 * Math.atan2(q.y, q.w) * DEG;
  return ((yaw + 180) % 360 + 360) % 360 - 180;
}

export function gyroPoseMetrics(q: Quaternion) {
  const short = q.clone().normalize();
  if (short.w < 0) short.set(-short.x, -short.y, -short.z, -short.w);
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, short.w)));
  const scale = Math.hypot(short.x, short.y, short.z);
  return {
    angleDeg: angle * DEG,
    tiltDeg: UP.clone().applyQuaternion(short).angleTo(UP) * DEG,
    yawDeg: yawDegrees(short),
    rotationVectorDeg: scale < 1e-8 ? { x: 0, y: 0, z: 0 }
      : { x: short.x / scale * angle * DEG, y: short.y / scale * angle * DEG, z: short.z / scale * angle * DEG },
  };
}

export function gyroAlgorithmEligibility(algorithm: string): string | null {
  try {
    let moves = 0;
    for (const node of new Alg(algorithm).experimentalExpand()) {
      if (node instanceof Move) {
        if (!/^[URFDLB](?:2'?|')?$/.test(node.toString())) return 'rotations-slices-or-wide-moves';
        moves++;
      }
      if (moves > 1000) return 'algorithm-too-long';
    }
    return moves ? null : 'empty-algorithm';
  } catch {
    return 'invalid-algorithm';
  }
}

type Sample = { q: Quaternion; at: number };
type Attempt = { algorithm: string; reason: string | null; start: Quaternion | null; at: number };
type End = { attempt: Attempt; frame: Quaternion; at: number };
type HeadingWindow = { correction: Quaternion; frame: Quaternion; start: Quaternion;
  points: Array<{ at: number; yawDeg: number }>; steady: boolean; tiltDeg: number | null };
type Correction = { source: 'table' | 'algorithm'; from: Quaternion; target: Quaternion; at: number; requestedDeg: number; appliedAt: number };

function shortDegrees(angle: number) { return ((angle + 180) % 360 + 360) % 360 - 180; }

/** Physical coordinates: white up / green front is identity. No camera tilt. */
export class GyroDriftCorrector {
  readonly correction = new Quaternion();
  private enabled = true;
  private last: Sample | null = null;
  private steadyAnchor: Sample | null = null;
  private lastMoveAt = -Infinity;
  private tableConsidered = false;
  private armed: { algorithm: string; reason: string | null } | null = null;
  private attempt: Attempt | null = null;
  private end: End | null = null;
  private heading: HeadingWindow | null = null;
  private pending: Correction | null = null;
  private recent: Array<Record<string, unknown>> = [];
  private recentAt = -Infinity;
  private sampleLogAt = -Infinity;
  private lastDecision: Record<string, unknown> | null = null;

  constructor(private log: GyroLog = () => {}) {}

  setEnabled(enabled: boolean, now: number) {
    if (enabled === this.enabled) return;
    this.finishCorrection('setting-changed', now);
    this.enabled = enabled;
    this.steadyAnchor = null;
    this.tableConsidered = false;
    // Retain the accumulated reference to avoid a jump when switching off.
    this.cancelAttempt('setting-changed', now);
    this.log('setting', { enabled, at: now, correction: quaternionData(this.correction) });
  }

  snapshot(now: number) {
    return {
      enabled: this.enabled, sampleAgeMs: this.last ? now - this.last.at : null,
      uncorrected: this.last ? quaternionData(this.last.q) : null,
      corrected: this.last ? quaternionData(this.apply(this.last.q)) : null,
      correction: quaternionData(this.correction), lastDecision: this.lastDecision,
      pendingEndpoint: this.end ? { at: this.end.at, algorithm: this.end.attempt.algorithm } : null,
      headingStability: this.heading ? { steady: this.heading.steady, tiltDeg: this.heading.tiltDeg,
        points: [...this.heading.points] } : null,
      recentSamples: [...this.recent],
    };
  }

  reset(reason: string, now: number) {
    this.finishCorrection(reason, now);
    this.cancelAttempt(reason, now);
    this.log('reference-cleared', { reason, at: now, ...this.snapshot(now) });
    this.correction.identity();
    this.heading = null;
    this.last = this.steadyAnchor = null;
    this.lastMoveAt = -Infinity;
    this.tableConsidered = false;
    this.recent = [];
    this.recentAt = this.sampleLogAt = -Infinity;
    this.lastDecision = null;
  }

  apply(q: Quaternion) { return q.clone().premultiply(this.correction).normalize(); }

  armAlgorithm(algorithm: string, reason: string | null, now: number) {
    // The next case can be shown before the preceding endpoint has settled.
    // Preserve that endpoint until the next physical move, not the next render.
    if (this.attempt || this.armed) this.cancelAttempt('case-changed', now);
    this.armed = { algorithm, reason: reason ?? gyroAlgorithmEligibility(algorithm) };
    this.log('algorithm-ready', { at: now, ...this.armed });
  }

  noteMove(now: number, startFrame: Quaternion | null) {
    this.finishCorrection('face-move', now);
    if (this.end) this.skipEnd('next-move-before-settling', now);
    if (this.armed) {
      const { algorithm, reason } = this.armed;
      const fresh = this.last && now - this.last.at <= GYRO_DRIFT_THRESHOLDS.maxSampleAgeMs;
      const start = fresh && startFrame ? this.apply(this.last!.q).multiply(startFrame) : null;
      this.attempt = { algorithm, reason: reason ?? (!startFrame ? 'unknown-sticker-frame' : !fresh ? 'missing-fresh-start-sample' : null), start, at: now };
      this.armed = null;
      this.log('algorithm-start', { ...this.attempt, start: start && quaternionData(start),
        frame: startFrame && quaternionData(startFrame), ...this.snapshot(now) });
    }
    this.lastMoveAt = now;
    this.steadyAnchor = null;
    this.tableConsidered = false;
  }

  completeAlgorithm(frame: Quaternion | null, now: number) {
    if (!this.attempt) return;
    const attempt = this.attempt;
    this.attempt = null;
    this.log('algorithm-complete', { at: now, algorithm: attempt.algorithm, reason: attempt.reason,
      durationMs: now - attempt.at, start: attempt.start && quaternionData(attempt.start),
      frame: frame && quaternionData(frame), endpoint: frame && this.last ? quaternionData(this.apply(this.last.q).multiply(frame)) : null,
      ...this.snapshot(now) });
    if (attempt.reason || !frame) {
      this.decision('algorithm', attempt.reason ?? 'unknown-sticker-frame', now, { algorithm: attempt.algorithm });
      return;
    }
    this.end = { attempt, frame: frame.clone(), at: now };
    this.heading = { correction: this.correction.clone(), frame: frame.clone(), start: attempt.start!.clone(),
      points: [], steady: false, tiltDeg: null };
    // Require new samples after the endpoint; never infer rest from silence.
    this.steadyAnchor = null;
  }

  cancelAttempt(reason: string, now: number) {
    if (this.pending?.source === 'algorithm') this.finishCorrection(reason, now);
    if (this.attempt || this.armed) this.log('algorithm-cancelled', { reason, at: now,
      algorithm: this.attempt?.algorithm ?? this.armed?.algorithm });
    this.attempt = this.armed = null;
    if (this.end) this.skipEnd(reason, now);
  }

  guidanceStarted(now: number, mode: 'setup' | 'recovery' = 'recovery') {
    this.cancelAttempt(`guided-${mode}`, now);
    this.finishCorrection(`guided-${mode}`, now);
    this.log(`guided-${mode}-start`, { at: now, ...this.snapshot(now) });
  }

  guidanceCancelled(now: number, mode: 'setup' | 'recovery' = 'recovery') {
    this.log(`guided-${mode}-cancel`, { at: now, ...this.snapshot(now) });
  }

  /** Matching stickers confirms a frame, not an exact physical holding angle. */
  observeGuidedGrip(frame: Quaternion | null, now: number, mode: 'setup' | 'recovery' = 'recovery') {
    this.cancelAttempt('guided-grip-confirmed', now);
    this.finishCorrection('guided-grip-confirmed', now);
    const before = this.snapshot(now);
    const pose = this.last && frame ? this.apply(this.last.q).multiply(frame.clone().invert()) : null;
    const metrics = pose && gyroPoseMetrics(pose);
    const reason = !frame ? 'unknown-sticker-frame'
      : !this.last || now - this.last.at > GYRO_DRIFT_THRESHOLDS.maxSampleAgeMs ? 'missing-fresh-sample'
      : 'observed-grip-only';
    this.lastDecision = { source: `guided-${mode}`, reason, at: now, applied: false,
      // Guidance accepts normal hand tilts/regrips. Keep the connect/reset
      // reference; a broad grip check cannot establish a new gyro zero.
      headingAdjustmentDeg: 0,
      frame: frame && quaternionData(frame), picturedGripBefore: metrics,
      correction: quaternionData(this.correction) };
    this.log('guided-reference', { ...this.lastDecision, before });
    this.steadyAnchor = null;
    this.tableConsidered = false;
  }

  update(q: Quaternion, now: number): Quaternion {
    const previous = this.last;
    const gap = previous ? now - previous.at : Infinity;
    const angle = previous ? previous.q.angleTo(q) * DEG : Infinity;
    const validGap = gap > 0 && gap <= GYRO_DRIFT_THRESHOLDS.maxSampleGapMs;
    const steady = validGap && angle / (gap / 1000) <= GYRO_DRIFT_THRESHOLDS.steadySpeedDegPerSecond
      && this.steadyAnchor != null && this.steadyAnchor.q.angleTo(q) * DEG <= GYRO_DRIFT_THRESHOLDS.steadySpreadDeg;
    this.updateHeading(q, now, validGap);
    const pendingSteady = this.pending?.source === 'algorithm'
      ? this.heading?.steady && this.heading.tiltDeg != null && this.heading.tiltDeg <= GYRO_DRIFT_THRESHOLDS.maxEndpointTiltChangeDeg
      : steady;
    if (this.pending?.source === 'algorithm' && !pendingSteady) {
      this.finishCorrection(validGap ? 'heading-motion' : 'sample-gap', now);
    }
    if (!steady) {
      if (!pendingSteady) this.finishCorrection(validGap ? 'motion' : 'sample-gap', now);
      this.steadyAnchor = { q: q.clone(), at: now };
      this.tableConsidered = false;
    }
    this.last = { q: q.clone(), at: now };
    const steadyMs = now - Math.max(this.steadyAnchor!.at, this.lastMoveAt);

    if (this.end) {
      if (now - this.end.at > GYRO_DRIFT_THRESHOLDS.endpointTimeoutMs) this.skipEnd('endpoint-did-not-settle', now);
      else if (this.heading?.steady) this.considerEnd(now);
    }
    if (!this.attempt && !this.end && !this.pending && !this.tableConsidered && steadyMs >= GYRO_DRIFT_THRESHOLDS.steadyMs) {
      this.tableConsidered = true;
      this.considerTable(now, steadyMs);
    }
    const canApply = this.pending?.source === 'algorithm'
      ? this.heading?.steady && this.heading.tiltDeg != null && this.heading.tiltDeg <= GYRO_DRIFT_THRESHOLDS.maxEndpointTiltChangeDeg
      : steady;
    if (this.pending && canApply && validGap) {
      const remaining = this.correction.angleTo(this.pending.target);
      const elapsed = Math.min(gap, now - this.pending.appliedAt);
      const step = GYRO_DRIFT_THRESHOLDS.correctionSpeedDegPerSecond / DEG * elapsed / 1000;
      this.correction.slerp(this.pending.target, remaining > 1e-8 ? Math.min(1, step / remaining) : 1).normalize();
      this.pending.appliedAt = now;
      if (this.correction.angleTo(this.pending.target) < 1e-6) this.finishCorrection('completed', now);
    }
    const corrected = this.apply(q);
    const sample = { at: now, uncorrected: quaternionData(q), corrected: quaternionData(corrected), steadyMs,
      sampleGapMs: Number.isFinite(gap) ? gap : null, angularSpeedDegPerSecond: validGap ? angle / (gap / 1000) : null };
    if (now - this.recentAt >= 100) {
      this.recent.push(sample);
      if (this.recent.length > 30) this.recent.shift();
      this.recentAt = now;
    }
    if (now - this.sampleLogAt >= 1000) {
      this.sampleLogAt = now;
      this.log('sample', sample);
    }
    return corrected;
  }

  private updateHeading(q: Quaternion, now: number, validGap: boolean) {
    const heading = this.heading;
    if (!heading) return;
    // Freeze the correction used for measurement: our own smooth adjustment
    // must not appear as sensor motion or destabilize the heading window.
    const pose = q.clone().premultiply(heading.correction).multiply(heading.frame)
      .multiply(heading.start.clone().invert());
    const metrics = gyroPoseMetrics(pose);
    const yaw = metrics.yawDeg;
    heading.tiltDeg = metrics.tiltDeg;
    heading.steady = false;
    if (yaw == null) { heading.points = []; return; }
    const previous = heading.points.at(-1);
    if (!validGap || (previous && Math.abs(shortDegrees(yaw - previous.yawDeg)) / ((now - previous.at) / 1000)
      > GYRO_DRIFT_THRESHOLDS.endpointYawSpeedDegPerSecond)) heading.points = [];
    heading.points.push({ at: now, yawDeg: yaw });
    // Retain the shortest recent window spanning 150ms, plus enough real
    // samples for slower BLE streams. Never manufacture evidence from silence.
    while (heading.points.length > GYRO_DRIFT_THRESHOLDS.endpointMinSamples
      && now - heading.points[1].at >= GYRO_DRIFT_THRESHOLDS.endpointSteadyMs) heading.points.shift();
    const base = heading.points[0];
    const values = heading.points.map(point => shortDegrees(point.yawDeg - base.yawDeg));
    heading.steady = heading.points.length >= GYRO_DRIFT_THRESHOLDS.endpointMinSamples
      && now - base.at >= GYRO_DRIFT_THRESHOLDS.endpointSteadyMs
      && Math.max(...values) - Math.min(...values) <= GYRO_DRIFT_THRESHOLDS.endpointYawSpreadDeg;
  }

  private decision(source: string, reason: string, now: number, data: Record<string, unknown>) {
    this.lastDecision = { source, reason, at: now, ...data };
    this.log('correction-decision', { ...this.lastDecision, enabled: this.enabled, recentSamples: [...this.recent] });
  }

  private considerTable(now: number, steadyMs: number) {
    const q = this.apply(this.last!.q);
    const candidates = FACE_NORMALS.map(normal => normal.clone().applyQuaternion(q));
    const face = candidates.reduce((best, v, i) => v.y > candidates[best].y ? i : best, 0);
    const tilt = candidates[face].angleTo(UP) * DEG;
    const data = { steadyMs, face: FACE_NAMES[face], tiltDeg: tilt, pose: quaternionData(q) };
    const reason = tilt > GYRO_DRIFT_THRESHOLDS.maxTableTiltDeg ? 'face-not-flat-enough'
      : tilt < GYRO_DRIFT_THRESHOLDS.minCorrectionDeg ? 'below-deadband' : !this.enabled ? 'disabled' : 'accepted';
    this.decision('table', reason, now, data);
    if (reason === 'accepted') this.startCorrection('table', new Quaternion().setFromUnitVectors(candidates[face], UP), now);
  }

  private considerEnd(now: number) {
    const { attempt, frame } = this.end!;
    const end = this.apply(this.last!.q).multiply(frame);
    const delta = end.clone().multiply(attempt.start!.clone().invert()).normalize();
    const metrics = gyroPoseMetrics(delta);
    const yaw = metrics.yawDeg;
    const reason = yaw == null ? 'ambiguous-heading'
      : Math.abs(yaw) > GYRO_DRIFT_THRESHOLDS.maxEndpointYawDeg ? 'heading-change-too-large'
      : metrics.tiltDeg > GYRO_DRIFT_THRESHOLDS.maxEndpointTiltChangeDeg ? 'grip-tilt-changed'
      : Math.abs(yaw) < GYRO_DRIFT_THRESHOLDS.minCorrectionDeg ? 'below-deadband'
      : !this.enabled ? 'disabled' : 'accepted';
    this.decision('algorithm', reason, now, { ...this.endpointEvidence(now), algorithm: attempt.algorithm,
      start: quaternionData(attempt.start!), end: quaternionData(end), frame: quaternionData(frame), delta: metrics });
    this.end = null;
    this.tableConsidered = true; // Do not combine two assumptions at the same endpoint.
    if (reason === 'accepted') {
      const correction = -Math.sign(yaw!) * Math.min(Math.abs(yaw!) * GYRO_DRIFT_THRESHOLDS.endpointGain,
        GYRO_DRIFT_THRESHOLDS.maxEndpointCorrectionDeg);
      this.startCorrection('algorithm', new Quaternion().setFromAxisAngle(UP, correction / DEG), now);
    } else this.heading = null;
  }

  private skipEnd(reason: string, now: number) {
    this.decision('algorithm', reason, now, { algorithm: this.end!.attempt.algorithm, ...this.endpointEvidence(now) });
    this.end = null;
    this.heading = null;
  }

  private endpointEvidence(now: number) {
    const endpoint = this.end!;
    const points = this.heading?.points ?? [];
    const base = points[0];
    const yawOffsets = base ? points.map(point => shortDegrees(point.yawDeg - base.yawDeg)) : [];
    const pose = this.last ? this.apply(this.last.q).multiply(endpoint.frame) : null;
    // Keep scalar evidence with the decision even if the shared raw samples
    // are evicted. A pre-completion or stale pose is explicitly identified.
    return {
      durationMs: now - endpoint.attempt.at, endpointWaitMs: now - endpoint.at,
      sampleAgeMs: this.last ? now - this.last.at : null,
      sampleAfterCompletion: this.last ? this.last.at > endpoint.at : false,
      delta: pose ? gyroPoseMetrics(pose.multiply(endpoint.attempt.start!.clone().invert())) : null,
      headingEvidence: { sampleCount: points.length, spanMs: base ? points.at(-1)!.at - base.at : 0,
        yawSpreadDeg: base ? Math.max(...yawOffsets) - Math.min(...yawOffsets) : null,
        steady: this.heading?.steady ?? false },
    };
  }

  private startCorrection(source: Correction['source'], delta: Quaternion, now: number) {
    this.pending = { source, from: this.correction.clone(), target: this.correction.clone().premultiply(delta).normalize(),
      at: now, appliedAt: now, requestedDeg: delta.angleTo(new Quaternion()) * DEG };
    this.log('correction-start', { at: now, source, requestedDeg: this.pending.requestedDeg,
      from: quaternionData(this.pending.from), target: quaternionData(this.pending.target) });
  }

  private finishCorrection(reason: string, now: number) {
    if (!this.pending) return;
    this.log('correction-applied', { at: now, source: this.pending.source, reason,
      durationMs: now - this.pending.at, requestedDeg: this.pending.requestedDeg,
      appliedDeg: this.pending.from.angleTo(this.correction) * DEG,
      from: quaternionData(this.pending.from),
      ...this.snapshot(now) });
    if (this.pending.source === 'algorithm') this.heading = null;
    this.pending = null;
  }
}
