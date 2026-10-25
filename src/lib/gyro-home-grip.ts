import { Quaternion, Vector3 } from 'three';

export const GYRO_HOME_THRESHOLDS = {
  windowMs: 800,
  minWindowMs: 200,
  fullWindowMs: 600,
  minSamples: 4,
  minHandMotionDeg: .1,
  maxWindowMotionDeg: 5,
  maxSpeedDegPerSecond: 30,
  maxTiltDeg: 55,
  maxDisplayedHeadingDeg: 45,
  maxPredictionMs: 20_000,
  correctionTimeConstantMs: 250,
  maxCorrectionSpeedDegPerSecond: 60,
  correctionDeadbandDeg: .5,
  minEpisodes: 3,
  minRateConfirmations: 3,
  minEpisodeSpanMs: 6000,
  maxEpisodeAgeMs: 120_000,
  supportMs: 45_000,
  maxEpisodeResidualDeg: 4,
  maxEpisodes: 12,
} as const;

export type GyroHomeObservation = { attemptId: number; at: number; measuredAt: number;
  yawDeg: number; spreadDeg: number; sampleCount: number; exposureMs: number };
type Point = { at: number; raw: Quaternion; yawDeg: number };
const UP = new Vector3(0, 1, 0), FRONT = new Vector3(0, 0, 1), DEG = 180 / Math.PI;
const wrap = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), i = sorted.length >> 1;
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};

/** A probabilistic holding observation, never a hand/contact sensor. Heading
 * is only a broad displayed-pose gate; the measurement is always raw. One
 * uninterrupted ready period has at most one vote, even across case changes. */
export class GyroHomeGripObserver {
  private points: Point[] = [];
  private previous: { raw: Quaternion; at: number } | null = null;
  private usedAttempts = new Set<number>();
  private observedAttempts = new Set<number>();
  private reason = 'waiting-for-training';
  private observations = 0;
  private lastObservation: GyroHomeObservation | null = null;
  private held: GyroHomeObservation | null = null;
  private inspectionAttempt: number | null = null;

  reset() {
    this.points = [];
    this.previous = null;
    this.usedAttempts.clear();
    this.observedAttempts.clear();
    this.reason = 'waiting-for-training';
    this.observations = 0;
    this.lastObservation = null;
    this.held = null;
    this.inspectionAttempt = null;
  }

  private state(reason: string, _at: number, _attemptId: number) {
    this.reason = reason;
  }

  observe(raw: Quaternion | null, displayed: Quaternion | null, at: number, attemptId: number,
    blockedReason: string | null, predictedHeadingDeg: number | null = null): GyroHomeObservation | null {
    const previous = this.previous;
    const previousHold = this.held;
    this.held = null;
    this.previous = raw ? { raw: raw.clone(), at } : null;
    const reject = (reason: string, clear = true) => {
      if (clear) this.points = [];
      this.state(reason, at, attemptId);
      return null;
    };
    if (blockedReason) return reject(blockedReason);
    if (this.inspectionAttempt === attemptId) return reject('inspection-rotation');
    if (!raw || !displayed) return reject('unknown-reference-frame');
    if (!previous || at <= previous.at || at - previous.at > 200) return reject('sample-gap');
    const front = FRONT.clone().applyQuaternion(raw);
    const shownFront = FRONT.clone().applyQuaternion(displayed);
    const tilt = UP.clone().applyQuaternion(raw).angleTo(UP) * DEG;
    if (tilt > GYRO_HOME_THRESHOLDS.maxTiltDeg || Math.hypot(front.x, front.z) < .5) return reject('outside-home-tilt');
    const displayedHeading = Math.atan2(shownFront.x, shownFront.z) * DEG;
    const rawHeading = Math.atan2(front.x, front.z) * DEG;
    // About +/-35 degrees is the user's usual reset threshold, with 10 degrees
    // of margin. Cumulative raw drift is deliberately not bounded here.
    // A confirmed raw drift trend can keep an established home grip observable
    // while the bounded render correction catches up. An unexpected rotation
    // must still fail the heading gate, even if it is held steadily afterward.
    const followsPrediction = predictedHeadingDeg != null && Number.isFinite(predictedHeadingDeg)
      && Math.abs(wrap(rawHeading - predictedHeadingDeg)) <= GYRO_HOME_THRESHOLDS.maxEpisodeResidualDeg;
    if (Math.abs(displayedHeading) > GYRO_HOME_THRESHOLDS.maxDisplayedHeadingDeg && !followsPrediction) {
      return reject('outside-displayed-home-heading');
    }
    const speed = previous.raw.angleTo(raw) * DEG / ((at - previous.at) / 1000);
    if (speed > GYRO_HOME_THRESHOLDS.maxSpeedDegPerSecond) {
      if (previousHold?.attemptId === attemptId) this.inspectionAttempt = attemptId;
      return reject('pickup-or-rotation');
    }
    this.points.push({ at, raw: raw.clone(), yawDeg: rawHeading });
    while (this.points.length > 1 && (at - this.points[0].at > GYRO_HOME_THRESHOLDS.windowMs || this.points.length > 96)) this.points.shift();
    const span = at - this.points[0].at;
    if (span < GYRO_HOME_THRESHOLDS.minWindowMs || this.points.length < GYRO_HOME_THRESHOLDS.minSamples) return reject('settling', false);
    const anchor = this.points[0];
    const motion = Math.max(...this.points.map(p => p.raw.angleTo(anchor.raw) * DEG));
    const continuingHold = this.usedAttempts.has(attemptId) && previousHold?.attemptId === attemptId
      && at - previousHold.at <= 200;
    // A level or tilted stationary cube may be resting. Stillness alone never
    // asserts an absolute yaw, including the poses used for Record drift.
    if (!continuingHold && motion < GYRO_HOME_THRESHOLDS.minHandMotionDeg) return reject('resting-or-uncertain', false);
    if (motion > GYRO_HOME_THRESHOLDS.maxWindowMotionDeg) {
      if (previousHold?.attemptId === attemptId) this.inspectionAttempt = attemptId;
      return reject('holding-pose-changing', false);
    }
    if (!continuingHold && span < GYRO_HOME_THRESHOLDS.fullWindowMs) {
      // A short window needs actual back-and-forth motion, rather than a
      // monotone pickup/put-down transient. Do not lower the motion floor.
      const travelled = this.points.slice(1).reduce((sum, p, i) => sum + p.raw.angleTo(this.points[i].raw) * DEG, 0);
      const displacement = anchor.raw.angleTo(this.points.at(-1)!.raw) * DEG;
      if (travelled - displacement < GYRO_HOME_THRESHOLDS.minHandMotionDeg) return reject('short-window-needs-hand-motion', false);
    } else if (!continuingHold) {
      const middle = anchor.at + span / 2;
      const halves = [this.points.filter(p => p.at <= middle), this.points.filter(p => p.at > middle)];
      if (halves.some(half => half.length < 2 || Math.max(...half.map(p => p.raw.angleTo(half[0].raw) * DEG))
        < GYRO_HOME_THRESHOLDS.minHandMotionDeg)) return reject('no-sustained-hand-motion', false);
    }
    // A resting sensor's drift (or a deliberate slow rotation) can move
    // throughout both halves. Require motion beyond that smooth trajectory.
    const last = this.points.at(-1)!;
    const handMotion = Math.max(...this.points.map(p => p.raw.angleTo(anchor.raw.clone()
      .slerp(last.raw, (p.at - anchor.at) / span)) * DEG));
    if (!continuingHold && handMotion < GYRO_HOME_THRESHOLDS.minHandMotionDeg) return reject('resting-or-smooth-motion', false);
    const yawDeg = wrap(anchor.yawDeg + median(this.points.map(p => wrap(p.yawDeg - anchor.yawDeg))));
    const spreadDeg = Math.max(...this.points.map(p => Math.abs(wrap(p.yawDeg - yawDeg))));
    if (spreadDeg > GYRO_HOME_THRESHOLDS.maxEpisodeResidualDeg) return reject('heading-not-settled', false);
    const observation = { attemptId, at, measuredAt: median(this.points.map(p => p.at)), yawDeg,
      spreadDeg, sampleCount: this.points.length, exposureMs: span };
    // Keep validating the live hold after its one learner vote was delivered.
    // Closing an episode must not disable correction for the rest of the hold.
    this.held = observation;
    if (this.usedAttempts.has(attemptId)) return reject('episode-already-observed', false);
    const first = !this.observedAttempts.has(attemptId);
    if (first) {
      this.observedAttempts.add(attemptId);
      while (this.observedAttempts.size > 64) this.observedAttempts.delete(this.observedAttempts.values().next().value!);
      this.observations++;
    }
    this.lastObservation = observation;
    this.state('likely-held', at, attemptId);
    return observation;
  }

  closeEpisode(attemptId: number) {
    this.usedAttempts.add(attemptId);
    while (this.usedAttempts.size > 64) this.usedAttempts.delete(this.usedAttempts.values().next().value!);
  }

  currentHold() { return this.held; }

  clearWindow() { this.points = []; this.previous = null; this.held = null; }

  snapshot() {
    return { reason: this.reason, observations: this.observations,
      lastObservation: this.lastObservation && { ...this.lastObservation } };
  }
}
