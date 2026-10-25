import { Alg, Move } from 'cubing/alg';
import { Quaternion, Vector3 } from 'three';
import { GyroGripDriftEstimator } from './gyro-grip-drift';
import { GyroMotionDriftEstimator } from './gyro-motion-drift';
import { GYRO_HOME_THRESHOLDS, GyroHomeGripObserver, type GyroHomeObservation } from './gyro-home-grip';

// All angles are in degrees and all times in milliseconds.
export const GYRO_DRIFT_THRESHOLDS = {
  steadyMs: 600,
  steadySpreadDeg: 0.8,
  steadySpeedDegPerSecond: 12,
  maxSampleGapMs: 200,
  maxSampleAgeMs: 200,
  startWindowMs: 450,
  startSteadyMs: 150,
  startMinSamples: 3,
  startSpreadDeg: 0.8,
  startSpeedDegPerSecond: 12,
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
const DEG = 180 / Math.PI;
const UP = new Vector3(0, 1, 0);
const FACE_NORMALS = [new Vector3(0, 1, 0), new Vector3(0, -1, 0),
  new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const FACE_NAMES = ['U', 'D', 'R', 'L', 'F', 'B'];

export function gyroQuaternion(q: GyroQuaternion) {
  if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) return null;
  const result = new Quaternion(q.x, q.y, q.z, q.w);
  return Number.isFinite(result.lengthSq()) && result.lengthSq() > 1e-8 ? result.normalize() : null;
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
type StartEvidence = { reason: string; sampleCount: number; spanMs: number; sampleAgeMs: number | null;
  spreadDeg: number | null; maxSpeedDegPerSecond: number | null; confidence: number };
type Attempt = { id: number; algorithm: string; reason: string | null; start: Quaternion | null;
  startEvidence: StartEvidence; gripEligible: boolean; at: number };
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
  private startSamples: Sample[] = [];
  private startEvidence: StartEvidence | null = null;
  private attemptId = 0;
  private lastDecision: Record<string, unknown> | null = null;
  private tableFrameRequired = false;
  private tableFrame: Quaternion | null = null;
  private resetTableFrame: Quaternion | null = null;
  private tablePictureFacelets: string | null = null;
  private resetPictureFacelets: string | null = null;
  private assertedResetPicture: string | null = null;
  private movedSinceReset = false;
  private rejectedSamples = { invalid: 0, duplicate: 0, outOfOrder: 0 };
  private usualGrip: GyroGripDriftEstimator | null;
  private motionHeading: GyroMotionDriftEstimator | null;
  private homeGrip: GyroHomeGripObserver | null;
  private pendingHome: { observation: GyroHomeObservation; reference: string } | null = null;
  private homeGuidance = false;

  constructor(options: { adaptiveHeading?: boolean } = {}) {
    this.motionHeading = options.adaptiveHeading ? new GyroMotionDriftEstimator() : null;
    this.homeGrip = options.adaptiveHeading ? new GyroHomeGripObserver() : null;
    this.usualGrip = this.motionHeading ? new GyroGripDriftEstimator(o => {
      const wasReady = this.motionHeading?.snapshot().ready;
      this.motionHeading?.completeObservation(o);
      if (!wasReady && this.motionHeading?.snapshot().ready) {
        this.motionHeading.synchronizeAppliedHeading(-(yawDegrees(this.correction) ?? 0));
      }
    }) : null;
  }

  setEnabled(enabled: boolean, now: number) {
    if (enabled === this.enabled) return;
    this.clearLearning('setting-changed', now);
    this.enabled = enabled;
  }

  snapshot(now: number) {
    return {
      enabled: this.enabled, sampleAt: this.last?.at ?? null, sampleAgeMs: this.last ? now - this.last.at : null,
      uncorrected: this.last ? quaternionData(this.last.q) : null,
      corrected: this.last ? quaternionData(this.apply(this.last.q)) : null,
      correction: quaternionData(this.correction), lastDecision: this.lastDecision,
      startEvidence: this.startEvidence,
      motionHeading: this.motionHeading?.snapshot(now) ?? null,
      homeGrip: this.homeGripSnapshot(),
      headingReference: this.tableReference(),
      rejectedSamples: { ...this.rejectedSamples },
      armedAlgorithm: this.armed,
      activeAttempt: this.attempt ? { ...this.attempt, start: this.attempt.start && quaternionData(this.attempt.start) } : null,
      activeCorrection: this.pending ? { source: this.pending.source, at: this.pending.at, appliedAt: this.pending.appliedAt,
        requestedDeg: this.pending.requestedDeg, from: quaternionData(this.pending.from), target: quaternionData(this.pending.target) } : null,
      pendingEndpoint: this.end ? { at: this.end.at, algorithm: this.end.attempt.algorithm,
        attemptId: this.end.attempt.id, frame: quaternionData(this.end.frame), start: quaternionData(this.end.attempt.start!) } : null,
      headingStability: this.heading ? { steady: this.heading.steady, tiltDeg: this.heading.tiltDeg,
        points: [...this.heading.points] } : null,
    };
  }

  private clearLearning(reason: string, now: number) {
    this.finishCorrection(reason, now);
    this.cancelAttempt(reason, now);
    this.usualGrip?.reset();
    this.motionHeading?.reset(now);
    this.homeGrip?.reset();
    this.pendingHome = null;
    this.correction.identity();
    this.heading = null;
    this.steadyAnchor = null;
    this.lastMoveAt = -Infinity;
    this.tableConsidered = false;
    this.startSamples = [];
    this.startEvidence = null;
    this.lastDecision = null;
  }

  reset(reason: string, now: number) {
    this.clearLearning(reason, now);
    this.homeGuidance = false;
    this.resetTableFrame = null;
    this.assertedResetPicture = reason === 'manual-reset' ? this.tablePictureFacelets : null;
    this.resetPictureFacelets = null;
    this.movedSinceReset = false;
    this.last = null;
    this.rejectedSamples = { invalid: 0, duplicate: 0, outOfOrder: 0 };
  }

  apply(q: Quaternion) { return q.clone().premultiply(this.correction).normalize(); }

  currentOrientation() { return this.last ? this.apply(this.last.q) : null; }

  headingCorrectionDegrees() { return yawDegrees(this.correction) ?? 0; }

  /** Measurement metadata only. A face turn invalidates the current frame;
   * requested, matched device stickers must establish it again. */
  setTableFrame(frame: Quaternion | null, _now: number, required = true, context: Record<string, unknown> = {}) {
    this.tableFrameRequired = required;
    this.tableFrame = frame && gyroQuaternion(frame);
    this.tablePictureFacelets = this.tableFrame && typeof context.pictureFacelets === 'string'
      && /^[URFDLB]{24}$/.test(context.pictureFacelets) ? context.pictureFacelets : null;
    if (this.last && !this.movedSinceReset && !this.resetTableFrame && this.tableFrame
      && (!this.tablePictureFacelets || this.tablePictureFacelets === this.assertedResetPicture)) {
      this.resetTableFrame = this.tableFrame.clone();
      this.resetPictureFacelets = this.tablePictureFacelets;
    }
    if (!required) {
      this.tableFrame = this.resetTableFrame = null;
      this.tablePictureFacelets = this.resetPictureFacelets = this.assertedResetPicture = null;
    }
  }

  tableReference() {
    const available = !this.tableFrameRequired || !!(this.tableFrame && this.resetTableFrame);
    return { required: this.tableFrameRequired, available,
      reason: available ? 'known-reference-frame' : !this.resetTableFrame ? 'unknown-reset-frame' : 'unknown-current-frame',
      frame: this.tableFrame && quaternionData(this.tableFrame),
      pose: this.tablePictureFacelets ? 'pictured-stickers' : 'white-up-green-front',
      pictureFacelets: this.tablePictureFacelets, resetPictureFacelets: this.resetPictureFacelets,
      resetFrame: this.resetTableFrame && quaternionData(this.resetTableFrame) };
  }

  armAlgorithm(algorithm: string, reason: string | null, now: number) {
    if (!this.enabled) return;
    // The next case can be shown before the preceding endpoint has settled.
    // Preserve that endpoint until the next physical move, not the next render.
    if (this.attempt || this.armed) this.cancelAttempt('case-changed', now);
    this.armed = { algorithm, reason: reason ?? gyroAlgorithmEligibility(algorithm) };
  }

  noteMove(now: number, startFrame: Quaternion | null, move: Record<string, unknown> = {}) {
    const homeReference = this.homeReferenceKey();
    this.movedSinceReset = true;
    if (this.tableFrameRequired) {
      this.tableFrame = null;
      this.tablePictureFacelets = null;
    }
    if (!this.enabled) return;
    this.usualGrip?.finishPending(now);
    this.finishCorrection('face-move', now);
    if (this.end) this.skipEnd('next-move-before-settling', now);
    // Drain the previous attempt before assigning its successor's budget. A
    // short ready hold can be used here without asking the user to keep waiting.
    this.deliverPendingHome(now, 'next-move', homeReference);
    if (this.armed) {
      const { algorithm, reason } = this.armed;
      const anchor = this.selectStart(now);
      this.startEvidence = anchor.evidence;
      const start = anchor.q && startFrame ? this.apply(anchor.q).multiply(startFrame) : null;
      this.attempt = { id: ++this.attemptId, algorithm,
        reason: reason ?? (!startFrame ? 'unknown-sticker-frame' : !anchor.q ? anchor.evidence.reason : null),
        start, startEvidence: anchor.evidence, gripEligible: reason == null && startFrame != null, at: now };
      if (this.attempt.gripEligible) {
        this.usualGrip?.beginAttempt(this.attempt.id, algorithm, startFrame!, now, move.cubeSize !== 2);
        if (this.last && now - this.last.at <= GYRO_DRIFT_THRESHOLDS.maxSampleAgeMs) {
          this.usualGrip?.observeStart(this.attempt.id, algorithm, startFrame!, this.startSamples, now);
        }
      }
      this.armed = null;
    }
    this.lastMoveAt = now;
    this.startSamples = [];
    this.steadyAnchor = null;
    this.tableConsidered = false;
  }

  completeAlgorithm(frame: Quaternion | null, now: number) {
    if (!this.enabled || !this.attempt) return;
    const attempt = this.attempt;
    this.attempt = null;
    if (attempt.gripEligible && frame) this.usualGrip?.completeAttempt(attempt.id, attempt.algorithm, frame, now);
    else this.usualGrip?.cancelAttempt('unknown-or-ineligible-frame', now);
    if (this.motionHeading?.snapshot(now).ready) {
      this.decision('algorithm', 'motion-heading-active', now, { algorithm: attempt.algorithm, attemptId: attempt.id });
      return;
    }
    if (attempt.reason || !frame) {
      this.decision('algorithm', attempt.reason ?? 'unknown-sticker-frame', now, { algorithm: attempt.algorithm,
        attemptId: attempt.id, startEvidence: attempt.startEvidence });
      return;
    }
    this.end = { attempt, frame: frame.clone(), at: now };
    this.heading = { correction: this.correction.clone(), frame: frame.clone(), start: attempt.start!.clone(),
      points: [], steady: false, tiltDeg: null };
    // Require new samples after the endpoint; never infer rest from silence.
    this.steadyAnchor = null;
  }

  cancelAttempt(reason: string, now: number) {
    this.discardPendingHome(reason, now);
    this.usualGrip?.cancelAttempt(reason, now);
    if (this.pending?.source === 'algorithm') this.finishCorrection(reason, now);
    this.attempt = this.armed = null;
    if (this.end) this.skipEnd(reason, now);
  }

  guidanceStarted(now: number, mode: 'setup' | 'recovery' = 'recovery') {
    this.homeGuidance = true;
    this.cancelAttempt(`guided-${mode}`, now);
    this.finishCorrection(`guided-${mode}`, now);
  }

  guidanceCancelled(_now: number, _mode: 'setup' | 'recovery' = 'recovery') {
    this.homeGuidance = false;
  }

  /** Matching stickers confirms a frame, not an exact physical holding angle. */
  observeGuidedGrip(frame: Quaternion | null, now: number, mode: 'setup' | 'recovery' = 'recovery') {
    this.homeGuidance = false;
    if (!this.enabled) return;
    this.cancelAttempt('guided-grip-confirmed', now);
    this.finishCorrection('guided-grip-confirmed', now);
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
    this.steadyAnchor = null;
    this.tableConsidered = false;
  }

  update(q: Quaternion, now: number): Quaternion {
    const normalized = gyroQuaternion(q);
    const rejected = !normalized || !Number.isFinite(now) ? 'invalid'
      : this.last && now === this.last.at ? 'duplicate'
      : this.last && now < this.last.at ? 'outOfOrder' : null;
    if (rejected) {
      this.rejectedSamples[rejected]++;
      return this.last ? this.apply(this.last.q) : this.correction.clone();
    }
    q = normalized!;
    if (!this.last) {
      // The connection establishes its gyro basis at this first packet, which
      // may follow the reset click and intervening face turns.
      if (!this.resetTableFrame) {
        const asserted = !this.tablePictureFacelets || this.tablePictureFacelets === this.assertedResetPicture;
        this.resetTableFrame = asserted ? this.tableFrame?.clone() ?? null : null;
        this.resetPictureFacelets = this.resetTableFrame ? this.tablePictureFacelets : null;
      }
      this.movedSinceReset = false;
    }
    if (!this.enabled) {
      // Keep live tracking and the physical reference, without feeding any collector.
      this.last = { q: q.clone(), at: now };
      return q.clone();
    }
    this.usualGrip?.observe(q, now);
    const previous = this.last;
    const gap = previous ? now - previous.at : Infinity;
    const angle = previous ? previous.q.angleTo(q) * DEG : Infinity;
    const validGap = gap > 0 && gap <= GYRO_DRIFT_THRESHOLDS.maxSampleGapMs;
    if (!validGap) this.startSamples = [];
    this.startSamples.push({ q: q.clone(), at: now });
    while (this.startSamples.length > 1 && (now - this.startSamples[0].at > GYRO_DRIFT_THRESHOLDS.startWindowMs
      || this.startSamples.length > 128)) this.startSamples.shift();
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
    const homeHold = this.observeHomeGrip(q, now);
    const motionBefore = this.motionHeading?.snapshot().appliedDeg ?? 0;
    this.motionHeading?.observe(q, now, steadyMs, this.enabled, homeHold);
    const motionStep = (this.motionHeading?.snapshot().appliedDeg ?? 0) - motionBefore;
    if (motionStep) {
      const delta = new Quaternion().setFromAxisAngle(UP, -motionStep / DEG);
      this.correction.premultiply(delta).normalize();
      // Keep a concurrent tilt interpolation in the updated heading frame.
      if (this.pending) {
        this.pending.from.premultiply(delta).normalize();
        this.pending.target.premultiply(delta).normalize();
      }
    }

    if (this.end) {
      if (now - this.end.at > GYRO_DRIFT_THRESHOLDS.endpointTimeoutMs) this.skipEnd('endpoint-did-not-settle', now);
      else if (this.heading?.steady) this.considerEnd(now);
    }
    this.deliverPendingHome(now, 'ready');
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
    return corrected;
  }

  private observeHomeGrip(q: Quaternion, now: number) {
    if (!this.homeGrip || !this.motionHeading) return null;
    const unknown = this.tableFrameRequired && (!this.tableFrame || !this.resetTableFrame);
    // A reset frame that tilts world-up needs a different correction axis.
    // Keep that relation unknown for home learning instead of guessing yaw.
    const tiltedReset = this.tableFrameRequired && this.resetTableFrame
      && UP.clone().applyQuaternion(this.resetTableFrame).angleTo(UP) * DEG > 1;
    // Execution eligibility constrains observations made while performing an
    // algorithm. A ready-state home hold uses its own pose/frame evidence and
    // must not inherit restrictions on the upcoming moves or execution mode.
    const reason = this.homeGuidance ? 'guidance-active' : this.attempt ? 'algorithm-active'
      : !this.armed ? 'waiting-for-training'
      : unknown ? 'unknown-reference-frame' : tiltedReset ? 'tilted-reset-frame' : null;
    const inReference = (pose: Quaternion) => this.tableFrameRequired && this.tableFrame && this.resetTableFrame
      ? pose.clone().premultiply(this.resetTableFrame.clone().invert()).multiply(this.tableFrame) : pose;
    const observation = this.homeGrip.observe(unknown ? null : inReference(q),
      unknown ? null : inReference(this.apply(q)), now, this.attemptId + 1, reason,
      this.motionHeading.predictHomeHeading(now));
    if (observation && (!this.pendingHome || observation.exposureMs >= this.pendingHome.observation.exposureMs)) {
      this.pendingHome = { observation, reference: this.homeReferenceKey() };
    }
    this.deliverPendingHome(now, 'ready');
    return !reason && !this.end && !this.usualGrip?.hasPendingFinish() ? this.homeGrip.currentHold() : null;
  }

  private homeReferenceKey() {
    return [this.tableFrameRequired, ...(this.tableFrame?.toArray() ?? []), ...(this.resetTableFrame?.toArray() ?? [])].join(',');
  }

  private homeGripSnapshot() {
    return this.homeGrip ? { ...this.homeGrip.snapshot(), pending: this.pendingHome && { ...this.pendingHome.observation } } : null;
  }

  private discardPendingHome(reason: string, _now: number) {
    if (!this.pendingHome) return;
    // A rejected provisional window was never a learner vote. Allow a fresh
    // window from this same hold, without counting another independent episode.
    if (reason !== 'observation-expired') this.homeGrip?.clearWindow();
    this.pendingHome = null;
  }

  private deliverPendingHome(now: number, source: 'ready' | 'next-move', reference = this.homeReferenceKey()) {
    const pending = this.pendingHome;
    if (!pending || !this.motionHeading) return;
    const o = pending.observation;
    if (!this.armed || this.attempt || this.homeGuidance || o.attemptId !== this.attemptId + 1
      || pending.reference !== reference) {
      this.discardPendingHome('context-changed', now); return;
    }
    if (now - o.measuredAt > GYRO_DRIFT_THRESHOLDS.maxSampleGapMs * 4
      || !this.last || now - this.last.at > GYRO_DRIFT_THRESHOLDS.maxSampleAgeMs) {
      this.discardPendingHome('observation-expired', now); return;
    }
    if (this.end || this.usualGrip?.hasPendingFinish()) return;
    // Short holds never make the user wait for a longer window. Submit them
    // when the next move begins; if the user is still holding, keep improving
    // this same episode and prefer a full-quality measurement automatically.
    if (source === 'ready' && o.exposureMs < GYRO_HOME_THRESHOLDS.fullWindowMs) return;
    this.pendingHome = null;
    this.homeGrip?.closeEpisode(o.attemptId);
    const wasReady = this.motionHeading.snapshot(now).ready;
    this.motionHeading.completeHomeObservation({ ...o, at: now });
    if (!wasReady && this.motionHeading.snapshot(now).ready) {
      this.motionHeading.synchronizeAppliedHeading(-(yawDegrees(this.correction) ?? 0));
    }
  }

  private selectStart(now: number): { q: Quaternion | null; evidence: StartEvidence } {
    const age = this.last ? now - this.last.at : null;
    const evidence: StartEvidence = { reason: 'missing-fresh-start-sample', sampleCount: 0, spanMs: 0,
      sampleAgeMs: age, spreadDeg: null, maxSpeedDegPerSecond: null, confidence: 0 };
    if (age == null || age < 0 || age > GYRO_DRIFT_THRESHOLDS.maxSampleAgeMs) return { q: null, evidence };
    const points = this.startSamples;
    let start = points.length - 1;
    let maxSpeed = 0;
    // Use a contiguous suffix ending at the latest sample. An old rest on
    // the table cannot qualify after the cube has been picked up or regripped.
    for (let i = points.length - 2; i >= 0; i--) {
      const dt = points[i + 1].at - points[i].at;
      const speed = points[i].q.angleTo(points[i + 1].q) * DEG / (dt / 1000);
      if (dt <= 0 || dt > GYRO_DRIFT_THRESHOLDS.maxSampleGapMs || speed > GYRO_DRIFT_THRESHOLDS.startSpeedDegPerSecond) break;
      // Pairwise spread avoids a gradually moving window looking steady.
      if (points.slice(i + 1).some(point => point.q.angleTo(points[i].q) * DEG > GYRO_DRIFT_THRESHOLDS.startSpreadDeg)) break;
      start = i;
      maxSpeed = Math.max(maxSpeed, speed);
    }
    const window = points.slice(start);
    const spanMs = window.length ? window.at(-1)!.at - window[0].at : 0;
    let spread = 0;
    for (const a of window) for (const b of window) spread = Math.max(spread, a.q.angleTo(b.q) * DEG);
    const valid = window.length >= GYRO_DRIFT_THRESHOLDS.startMinSamples && spanMs >= GYRO_DRIFT_THRESHOLDS.startSteadyMs;
    const confidence = valid ? Math.min(1, spanMs / GYRO_DRIFT_THRESHOLDS.startWindowMs)
      * (1 - .5 * spread / GYRO_DRIFT_THRESHOLDS.startSpreadDeg) : 0;
    // Quaternion mean aligned to one hemisphere also handles q and -q.
    const mean = new Quaternion(0, 0, 0, 0);
    for (const point of window) {
      const sign = point.q.dot(window[0].q) < 0 ? -1 : 1;
      mean.set(mean.x + sign * point.q.x, mean.y + sign * point.q.y,
        mean.z + sign * point.q.z, mean.w + sign * point.q.w);
    }
    return { q: valid ? mean.normalize() : null, evidence: { ...evidence,
      reason: valid ? 'stable-start-window' : 'start-grip-not-stable', sampleCount: window.length, spanMs,
      spreadDeg: spread, maxSpeedDegPerSecond: maxSpeed, confidence } };
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
      attemptId: endpoint.attempt.id, startEvidence: endpoint.attempt.startEvidence,
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
  }

  private finishCorrection(_reason: string, _now: number) {
    if (!this.pending) return;
    if (this.pending.source === 'algorithm') this.heading = null;
    this.pending = null;
  }
}
