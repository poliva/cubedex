import { Quaternion, Vector3 } from 'three';
import type { GyroMotionObservation } from './gyro-motion-drift';

export const GYRO_GRIP_THRESHOLDS = {
  maxProfileSpreadDeg: 25,
  maxSampleGapMs: 200,
  maxSampleWeightMs: 150,
  maxSpeedDegPerSecond: 120,
  minTiltDeg: 8,
  maxTiltDeg: 70,
  minHorizontalProjection: .35,
  minBaselineFragmentSamples: 2,
  minBaselineFragmentMs: 100,
  minObservationSamples: 3,
  minObservationMs: 200,
  startIgnoreMs: 120,
  finishMs: 800,
  maxPhaseSamples: 1000,
} as const;

const DEG = 180 / Math.PI;
const UP = new Vector3(0, 1, 0);
const FRONT = new Vector3(0, 0, 1);
type Point = { yawDeg: number; weightMs: number; at: number };
type Context = { attemptId: number; algorithm: string; phase: 'during' | 'finish' | 'start'; fallback?: boolean; frame: Quaternion;
  from: number; until: number; points: Point[] };
export function shortHeading(degrees: number) { return ((degrees + 180) % 360 + 360) % 360 - 180; }

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Fit in an unwrapped neighborhood of the circular mean. Ambiguous/broad
// distributions are subsequently rejected instead of forcing a heading.
function center(points: Array<{ yawDeg: number; weightMs: number }>) {
  const x = points.reduce((sum, p) => sum + p.weightMs * Math.cos(p.yawDeg / DEG), 0);
  const y = points.reduce((sum, p) => sum + p.weightMs * Math.sin(p.yawDeg / DEG), 0);
  const anchor = Math.atan2(y, x) * DEG;
  const sorted = points.map(p => ({ value: shortHeading(p.yawDeg - anchor), weight: p.weightMs }))
    .sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, p) => sum + p.weight, 0) / 2;
  let weight = 0;
  let offset = sorted.at(-1)!.value;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    weight += p.weight;
    if (weight >= half) {
      offset = Math.abs(weight - half) < 1e-9 && sorted[i + 1] ? (p.value + sorted[i + 1].value) / 2 : p.value;
      break;
    }
  }
  return shortHeading(anchor + offset);
}

function weightedMedian(points: Array<{ value: number; weight: number }>) {
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, p) => sum + p.weight, 0) / 2;
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i].weight;
    if (total >= half) return Math.abs(total - half) < 1e-9 && sorted[i + 1]
      ? (sorted[i].value + sorted[i + 1].value) / 2 : sorted[i].value;
  }
  return sorted.at(-1)!.value;
}

/** Collect raw repeated-grip observations for adaptive heading correction.
 * Rendered correction never trains the model.
 */
export class GyroGripDriftEstimator {
  private context: Context | null = null;
  private pendingStart: Context | null = null;
  private previous: { q: Quaternion; at: number; eligible: boolean } | null = null;

  constructor(private onObservation?: (o: GyroMotionObservation) => void) {}

  reset() {
    this.context = this.pendingStart = null;
    this.previous = null;
  }

  beginAttempt(attemptId: number, algorithm: string, frame: Quaternion, at: number, trackDuring = true) {
    this.finishPending(at);
    this.pendingStart = null;
    this.context = trackDuring ? { attemptId, algorithm: algorithm.trim().replace(/\s+/g, ' '), phase: 'during',
      frame: frame.clone(), from: at + GYRO_GRIP_THRESHOLDS.startIgnoreMs, until: Infinity, points: [] } : null;
    this.previous = null;
  }

  /** The known first-move sticker frame also describes the preceding turn-free
   * hold. Keep its summary separate from the live execution collector. */
  observeStart(attemptId: number, algorithm: string, frame: Quaternion,
    samples: Array<{ q: Quaternion; at: number }>, at: number) {
    this.finishPending(at);
    const during = this.context;
    this.context = { attemptId, algorithm: algorithm.trim().replace(/\s+/g, ' '), phase: 'start',
      fallback: during?.phase === 'during', frame: frame.clone(), from: -Infinity, until: at, points: [] };
    this.previous = null;
    for (const sample of samples) this.observe(sample.q, sample.at);
    // A known starting frame does not make the execution successful. Retain
    // this summary until completion; cancellation/recovery must discard it.
    this.pendingStart = this.context;
    this.context = during;
    this.previous = null;
  }

  completeAttempt(attemptId: number, algorithm: string, frame: Quaternion, at: number) {
    // Give existing execution evidence first use of the shared attempt budget.
    if (this.context?.phase === 'during') this.commit(this.context, at);
    if (this.pendingStart?.attemptId === attemptId) this.commit(this.pendingStart, at);
    this.pendingStart = null;
    this.context = { attemptId, algorithm: algorithm.trim().replace(/\s+/g, ' '), phase: 'finish',
      frame: frame.clone(), from: at, until: at + GYRO_GRIP_THRESHOLDS.finishMs, points: [] };
    this.previous = null;
  }

  cancelAttempt(_reason: string, _at: number) {
    this.pendingStart = null;
    this.context = null;
    this.previous = null;
  }

  /** Called on the next face move, even if the next case is ineligible. */
  finishPending(at = Math.min(this.context?.until ?? 0, this.previous?.at ?? this.context?.from ?? 0)) {
    if (this.context?.phase !== 'finish') return;
    this.commit(this.context, at);
    this.context = null;
    this.previous = null;
  }

  hasPendingFinish() { return this.context?.phase === 'finish'; }

  observe(raw: Quaternion, at: number) {
    const ctx = this.context;
    if (!ctx) return;
    if (at > ctx.until) { this.finishPending(at); return; }
    const length = raw.lengthSq();
    if (!Number.isFinite(length) || length < 1e-8) { this.previous = null; return; }
    const q = raw.clone().normalize();
    const pose = q.clone().multiply(ctx.frame).normalize();
    const front = FRONT.clone().applyQuaternion(pose);
    const tilt = UP.clone().applyQuaternion(pose).angleTo(UP) * DEG;
    const eligible = at >= ctx.from && tilt >= GYRO_GRIP_THRESHOLDS.minTiltDeg
      && tilt <= GYRO_GRIP_THRESHOLDS.maxTiltDeg
      && Math.hypot(front.x, front.z) >= GYRO_GRIP_THRESHOLDS.minHorizontalProjection;
    const previous = this.previous;
    this.previous = { q, at, eligible };
    if (!eligible) return;
    if (!previous?.eligible) return;
    const gap = at - previous.at;
    if (gap <= 0 || gap > GYRO_GRIP_THRESHOLDS.maxSampleGapMs) return;
    const speed = previous.q.angleTo(q) * DEG / (gap / 1000);
    if (speed > GYRO_GRIP_THRESHOLDS.maxSpeedDegPerSecond) return;
    if (ctx.points.length >= GYRO_GRIP_THRESHOLDS.maxPhaseSamples) return;
    ctx.points.push({ at, yawDeg: Math.atan2(front.x, front.z) * DEG,
      weightMs: Math.min(gap, GYRO_GRIP_THRESHOLDS.maxSampleWeightMs) });
  }

  private commit(ctx: Context, at: number) {
    const points = ctx.points;
    const exposureMs = points.reduce((sum, p) => sum + p.weightMs, 0);
    const partial = points.length < GYRO_GRIP_THRESHOLDS.minObservationSamples || exposureMs < GYRO_GRIP_THRESHOLDS.minObservationMs;
    const fragment = points.length >= GYRO_GRIP_THRESHOLDS.minBaselineFragmentSamples
      && exposureMs >= GYRO_GRIP_THRESHOLDS.minBaselineFragmentMs;
    if (partial && !fragment) return;
    const yawDeg = center(points);
    const spreadDeg = median(points.map(p => Math.abs(shortHeading(p.yawDeg - yawDeg))));
    if (spreadDeg > GYRO_GRIP_THRESHOLDS.maxProfileSpreadDeg) return;
    const summary = { attemptId: ctx.attemptId, algorithm: ctx.algorithm,
      at, measuredAt: weightedMedian(points.map(p => ({ value: p.at, weight: p.weightMs }))), fromAt: points[0].at,
      toAt: points.at(-1)!.at, sampleCount: points.length, exposureMs, yawDeg, spreadDeg, partial };
    this.onObservation?.({ ...summary, phase: ctx.phase, ...(ctx.fallback ? { fallback: true } : {}) });
  }
}
