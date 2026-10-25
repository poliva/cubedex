import { Quaternion } from 'three';
import { GYRO_GRIP_THRESHOLDS } from './gyro-grip-drift';
import { GYRO_HOME_THRESHOLDS, type GyroHomeObservation } from './gyro-home-grip';

export const GYRO_MOTION_THRESHOLDS = {
  homeGrip: GYRO_HOME_THRESHOLDS,
  maxSampleGapMs: 200,
  maxMotionSpeedDegPerSecond: 120,
  minMotionStepDeg: .0001,
  stillMs: 600,
  maxCorrectionSpeedDegPerSecond: 2,
  revisionWindowMs: 30_000,
  maxRevisionPerAttemptDeg: .5,
  maxHistoryRevisionDeg: 3,
  maxMotionGainChangePerAttempt: .001,
  maxTimeRateChangePerAttempt: .05,
  motionHistoryMs: 30_000,
  maxMotionSamples: 4096,
  rateHistoryMs: 600_000,
  staleMs: 45_000,
  maxObservations: 240,
  baselineRepetitions: 3,
  pooledBaselineRepetitions: 2,
  maxProfiles: 64,
  minRepetitions: 5,
  minPooledCases: 5,
  minFragmentConfirmations: 3,
  minPairConfirmations: 3,
  minPairSpanMs: 20_000,
  maxPairSpanMs: 120_000,
  minPairMotionDeg: 500,
  minPairs: 3,
  maxMotionGain: .02,
  maxTimeRateDegPerSecond: 1,
  maxMotionGainSpread: .003,
  maxTimeRateSpread: .15,
  observationNoiseFloorDeg: 2,
  minSignalToNoise: 1.5,
  maxResidualDeg: 6,
  basisSwitchMarginDeg: .5,
} as const;

export type GyroMotionObservation = { attemptId: number; algorithm: string; phase: string;
  at: number; measuredAt: number; yawDeg: number; spreadDeg: number; partial?: boolean; fallback?: boolean;
  sampleCount?: number; exposureMs?: number };
type Basis = 'motion' | 'time';
type Position = { at: number; motionDeg: number; elapsedSeconds: number; predictedHeadingDeg: number; integratedDriftDeg: number };
type Observation = GyroMotionObservation & Position & { quality: number; noiseDeg: number };
type Fit = { algorithm: string; phase: string; rate: number; uncertainty: number; residual: number;
  repetitions: number; evidenceAt: number; pairSpanMs?: number; partial?: boolean };
type Candidate = { basis: Basis; rate: number; uncertainty: number; scoreDeg: number;
  evidenceAt: number; cases: number; repetitions: number; fits: Fit[]; fragmentCases?: number; fragmentConfirmations?: number;
  pairSelection?: 'recent' | 'precision'; pairConfirmations?: number;
  evidence: 'repeated-phase' | 'pooled-cases' | 'home-grip' };
type RateConfirmation = { at: number; measuredAt: number; rate: number; algorithms: Set<string> };
type TrendHold = { at: number; basis: Basis; proposedRate: number; measuredRate: number; uncertainty: number; cases: number };
const DEG = 180 / Math.PI;
const wrap = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;
const median = (a: number[]) => {
  const s = [...a].sort((a, b) => a - b), i = s.length >> 1;
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
const position = (p: Position, basis: Basis) => basis === 'motion' ? p.motionDeg : p.elapsedSeconds;
const circularMedian = (a: number[]) => wrap(a[0] + median(a.map(v => wrap(v - a[0]))));

function homeConsensus(group: Observation[], newest: Observation, error: (p: Observation) => number) {
  if (group.length < GYRO_HOME_THRESHOLDS.minEpisodes
    || group.at(-1)!.measuredAt - group[0].measuredAt < GYRO_HOME_THRESHOLDS.minEpisodeSpanMs) return null;
  const residual = circularMedian(group.map(error));
  const agreeing = group.filter(p => Math.abs(wrap(error(p) - residual)) <= GYRO_HOME_THRESHOLDS.maxEpisodeResidualDeg);
  if (agreeing.length < GYRO_HOME_THRESHOLDS.minEpisodes || agreeing.length <= group.length / 2
    || agreeing.reduce((sum, p) => sum + p.quality, 0) + 1e-8 < GYRO_HOME_THRESHOLDS.minEpisodes
    || !agreeing.includes(newest)) return null;
  return { residual, agreeing };
}

function pairEvidence(group: Observation[], basis: Basis, maxSpanMs: number = GYRO_MOTION_THRESHOLDS.maxPairSpanMs) {
  const slopes: number[] = [], noises: number[] = [];
  for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
    const a = group[i], b = group[j], span = b.measuredAt - a.measuredAt;
    const exposure = position(b, basis) - position(a, basis);
    if (a.attemptId === b.attemptId || span < GYRO_MOTION_THRESHOLDS.minPairSpanMs
      || span > maxSpanMs || exposure <= 0
      || (basis === 'motion' && exposure < GYRO_MOTION_THRESHOLDS.minPairMotionDeg)) continue;
    slopes.push(wrap(b.yawDeg - a.yawDeg) / exposure);
    noises.push(Math.hypot(a.noiseDeg, b.noiseDeg) / exposure);
  }
  return { slopes, noises };
}

function pairMayWrap(a: Observation, b: Observation, basis: Basis, uncertainty: number) {
  if (b.measuredAt - a.measuredAt <= GYRO_MOTION_THRESHOLDS.maxPairSpanMs) return false;
  const maxChange = Math.max(GYRO_MOTION_THRESHOLDS.maxMotionGain * (b.motionDeg - a.motionDeg),
    GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond * (b.elapsedSeconds - a.elapsedSeconds));
  const noiseDeg = uncertainty * (position(b, basis) - position(a, basis));
  return maxChange + Math.abs(wrap(b.yawDeg - a.yawDeg))
    + GYRO_MOTION_THRESHOLDS.minSignalToNoise * noiseDeg >= 360;
}

/** Learns a signed drift rate from this session's raw repeated executions.
 * Hardware identity, firmware, historical recordings and rendered poses are
 * never inputs. A motion or time model must earn support before it can adjust
 * heading. Ordinary table markers remain held-out measurements.
 */
export class GyroMotionDriftEstimator {
  private homeObservations: Observation[] = [];
  private homeEvidenceAt: number | null = null;
  private homeEverReady = false;
  private homeRatePending = new Map<Basis, { at: number; measuredAt: number; rate: number; uncertainty: number; attempts: Set<number> }>();
  private lastHomeAdjustment: { at: number; targetDeg: number; adjustmentDeg: number; episodes: number } | null = null;
  private fragmentPending = new Map<Basis, RateConfirmation>();
  private precisePairPending = new Map<Basis, RateConfirmation>();
  private fitPairSelection: Candidate['pairSelection'] | null = null;
  private lastTrendHold: TrendHold | null = null;
  private fittedFragmentCases = 0;
  private supported = false;
  private previous: { q: Quaternion; at: number } | null = null;
  private motionDeg = 0;
  private elapsedSeconds = 0;
  private integratedDriftDeg = 0;
  private historyRevisionDeg = 0;
  private landmarkAdjustmentDeg = 0;
  private profiles = new Map<string, number>();
  private profileNoise = new Map<string, number>();
  private appliedDeg = 0;
  private basis: Basis = 'motion';
  private rate = 0;
  private learned = false;
  private evidenceAt: number | null = null;
  private conflictingEvidence = false;
  private supportingPhases = new Set<string>();
  private fitStarts = new Map<string, number>();
  private observations: Observation[] = [];
  private path: Position[] = [];
  private fittedCases = 0;
  private fittedRate: number | null = null;
  private fitAt: number | null = null;
  private moving = false;
  private adjusting = false;
  private uncertainty: number | null = null;
  private fitEvidence: Candidate['evidence'] | null = null;
  private fitPairSpanMs: number | null = null;
  private fitAttempt: { id: number; rateChange: number; revisionDeg: number } | null = null;
  private lastFit: { at: number; basis: Basis; previousRate: number; requestedRate: number;
    rateChange: number; recentExposure: number; requestedRevisionDeg: number; revisionDeg: number;
    landmarkTargetDeg: number | null; landmarkAdjustmentDeg: number; landmarkCases: number } | null = null;
  private lastRecovery: { at: number; targetDeg: number; uncertaintyDeg: number; cases: number; adjustmentDeg: number } | null = null;

  reset(_at: number) {
    this.homeObservations = [];
    this.homeEvidenceAt = null;
    this.homeEverReady = false;
    this.homeRatePending.clear();
    this.lastHomeAdjustment = null;
    this.fragmentPending.clear();
    this.precisePairPending.clear();
    this.fitPairSelection = null;
    this.lastTrendHold = null;
    this.fittedFragmentCases = 0;
    this.supported = false;
    this.previous = null;
    this.motionDeg = this.elapsedSeconds = this.appliedDeg = 0;
    this.integratedDriftDeg = this.historyRevisionDeg = this.rate = 0;
    this.landmarkAdjustmentDeg = 0;
    this.profiles.clear();
    this.profileNoise.clear();
    this.basis = 'motion';
    this.learned = false;
    this.evidenceAt = null;
    this.conflictingEvidence = false;
    this.supportingPhases.clear();
    this.fitStarts.clear();
    this.observations = [];
    this.path = [];
    this.fittedCases = 0;
    this.fittedRate = this.fitAt = this.uncertainty = null;
    this.fitEvidence = null;
    this.fitPairSpanMs = null;
    this.moving = this.adjusting = false;
    this.fitAttempt = this.lastFit = null;
    this.lastRecovery = null;
  }

  private ready(at: number) {
    return this.learned && !this.conflictingEvidence && this.evidenceAt != null && at >= this.evidenceAt
      && at - this.evidenceAt <= GYRO_MOTION_THRESHOLDS.staleMs
      && this.fittedRate != null && this.rate * this.fittedRate > 0;
  }

  private homeReady(at: number) {
    return this.homeEvidenceAt != null && at >= this.homeEvidenceAt
      && at - this.homeEvidenceAt <= GYRO_HOME_THRESHOLDS.supportMs;
  }

  private confirmHomeRate(candidate: Candidate, o: GyroHomeObservation) {
    // New absolute-pose rates have no algorithm diversity. Require repeated
    // independent confirmations before they take over velocity prediction.
    if (this.fitEvidence === 'home-grip' && this.ready(o.at) && candidate.basis === this.basis
      && candidate.rate * this.rate > 0 && Math.abs(candidate.rate - this.rate)
        <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(candidate.uncertainty, this.uncertainty ?? 0)) return true;
    let pending = this.homeRatePending.get(candidate.basis);
    if (!pending || o.at - pending.at > GYRO_HOME_THRESHOLDS.supportMs || pending.rate * candidate.rate <= 0
      || Math.abs(pending.rate - candidate.rate) > GYRO_MOTION_THRESHOLDS.minSignalToNoise
        * Math.hypot(pending.uncertainty, candidate.uncertainty)) {
      pending = { at: o.at, measuredAt: o.measuredAt, rate: candidate.rate, uncertainty: candidate.uncertainty,
        attempts: new Set([o.attemptId]) };
      this.homeRatePending.set(candidate.basis, pending);
    } else if (o.measuredAt > pending.measuredAt) {
      pending.attempts.add(o.attemptId);
      pending.measuredAt = o.measuredAt;
    }
    return pending.attempts.size >= GYRO_HOME_THRESHOLDS.minRateConfirmations;
  }

  /** Home rates must agree around their own trend, independently of the
   * accumulated-angle prediction. The intercept of that trend is never an
   * absolute heading measurement. */
  private homeRateCandidates(observation: Observation) {
    const candidates: Candidate[] = [];
    const group = this.homeObservations;
    if (group.length < GYRO_MOTION_THRESHOLDS.minRepetitions) return candidates;
    for (const basis of ['motion', 'time'] as const) {
      const { slopes, noises } = pairEvidence(group, basis);
      if (slopes.length < GYRO_MOTION_THRESHOLDS.minPairs) continue;
      const rate = median(slopes);
      const exposure = position(group.at(-1)!, basis) - position(group[0], basis);
      const uncertainty = Math.max(Math.max(median(noises), 1.4826 * median(slopes.map(v => Math.abs(v - rate))))
        / Math.sqrt(group.length - 2), GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg / Math.max(1e-8, exposure));
      const limit = basis === 'time' ? GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond : GYRO_MOTION_THRESHOLDS.maxMotionGain;
      const spreadLimit = basis === 'time' ? GYRO_MOTION_THRESHOLDS.maxTimeRateSpread : GYRO_MOTION_THRESHOLDS.maxMotionGainSpread;
      const detrended = (p: Observation) => wrap(p.yawDeg - rate * (position(p, basis) - position(observation, basis)));
      const consensus = homeConsensus(group, observation, detrended);
      if (!consensus) continue;
      const scoreDeg = median(group.map(p => Math.abs(wrap(detrended(p) - consensus.residual))));
      const tail = group.slice(-GYRO_MOTION_THRESHOLDS.minRepetitions);
      const recentPairs = pairEvidence(tail, basis);
      if (recentPairs.slopes.length < GYRO_MOTION_THRESHOLDS.minPairs) continue;
      const recentRate = median(recentPairs.slopes);
      const recentNoise = Math.max(median(recentPairs.noises),
        1.4826 * median(recentPairs.slopes.map(v => Math.abs(v - recentRate)))) / Math.sqrt(tail.length - 2);
      if (Math.abs(rate) > limit || uncertainty > spreadLimit || scoreDeg > GYRO_HOME_THRESHOLDS.maxEpisodeResidualDeg
        || Math.abs(rate) < GYRO_MOTION_THRESHOLDS.minSignalToNoise * uncertainty || recentRate * rate <= 0
        || Math.abs(recentRate - rate) > GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(uncertainty, recentNoise)) continue;
      candidates.push({ basis, rate, uncertainty, scoreDeg, cases: consensus.agreeing.length, repetitions: group.length,
        evidenceAt: observation.measuredAt, evidence: 'home-grip', fits: [] });
    }
    return candidates;
  }

  /** Separate ready episodes supply independent rate and absolute-heading
   * evidence. Neither packet counts nor an unconfirmed trend supply votes. */
  completeHomeObservation(o: GyroHomeObservation) {
    if (!this.supported || ![o.at, o.measuredAt, o.yawDeg, o.spreadDeg].every(Number.isFinite)
      || !Number.isSafeInteger(o.attemptId) || !Number.isSafeInteger(o.sampleCount)
      || o.sampleCount < GYRO_HOME_THRESHOLDS.minSamples || !Number.isFinite(o.exposureMs)
      || o.exposureMs < GYRO_HOME_THRESHOLDS.minWindowMs
      || o.measuredAt > o.at || o.spreadDeg < 0 || o.at - o.measuredAt > GYRO_MOTION_THRESHOLDS.maxSampleGapMs * 4
      || this.homeObservations.some(p => p.attemptId === o.attemptId)
      || (this.fitAttempt && o.attemptId < this.fitAttempt.id)) return;
    const point = [...this.path].reverse().find(p => p.at <= o.measuredAt);
    if (!point || o.measuredAt - point.at > GYRO_MOTION_THRESHOLDS.maxSampleGapMs) return;
    const quality = Math.min(1, o.exposureMs / GYRO_HOME_THRESHOLDS.fullWindowMs);
    const observation: Observation = { ...o, ...point, at: o.at, measuredAt: o.measuredAt,
      algorithm: 'home-grip', phase: 'home', quality,
      noiseDeg: Math.max(GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg, o.spreadDeg)
        / Math.sqrt(quality) };
    this.homeObservations = [...this.homeObservations.filter(p => o.at - p.measuredAt <= GYRO_MOTION_THRESHOLDS.maxPairSpanMs), observation]
      .slice(-GYRO_HOME_THRESHOLDS.maxEpisodes);
    const recent = this.homeObservations.filter(p => o.at - p.measuredAt <= GYRO_HOME_THRESHOLDS.maxEpisodeAgeMs);
    const heading = homeConsensus(recent, observation, p => wrap(p.yawDeg - p.predictedHeadingDeg));
    const predicted = this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg;
    const target = heading ? predicted + heading.residual : undefined;
    if (heading) {
      this.homeEvidenceAt = o.measuredAt;
      this.homeEverReady = true;
    }
    const candidates = this.homeRateCandidates(observation);
    const confirmed = candidates.filter(c => this.confirmHomeRate(c, o)).sort((a, b) => a.scoreDeg - b.scoreDeg);
    const previous = confirmed.find(c => c.basis === this.basis);
    const fit = previous && previous.scoreDeg <= confirmed[0].scoreDeg + GYRO_MOTION_THRESHOLDS.basisSwitchMarginDeg ? previous : confirmed[0];
    if (fit) {
      this.applyFit(fit, observation, target, heading?.agreeing.length ?? 0);
      this.homeRatePending.clear();
      return;
    }
    if (!heading) return;
    const { residual, agreeing } = heading;
    if (!this.fitAttempt || o.attemptId > this.fitAttempt.id) this.fitAttempt = { id: o.attemptId, rateChange: 0, revisionDeg: 0 };
    const budget = Math.max(0, GYRO_MOTION_THRESHOLDS.maxRevisionPerAttemptDeg - this.fitAttempt.revisionDeg);
    const adjustmentDeg = Math.abs(residual) <= GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg ? 0
      : Math.max(-budget, Math.min(budget, residual));
    this.landmarkAdjustmentDeg += adjustmentDeg;
    this.fitAttempt.revisionDeg += Math.abs(adjustmentDeg);
    this.lastHomeAdjustment = { at: o.at, targetDeg: predicted + residual, adjustmentDeg, episodes: agreeing.length };
  }

  /** Heading evidence is distinct from evidence for a future velocity. Compare
   * fresh raw grips to immutable profiles and the prediction at measurement,
   * without projecting them using an uncertain (or expired) drift rate. */
  private recoverHeading(o: GyroMotionObservation) {
    if (!this.learned || this.ready(o.at) || o.at - o.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs) return;
    const cases = new Map<string, Array<{ error: number; noise: number; phase: string; fallback?: boolean }>>();
    for (const [key, base] of this.profiles) {
      const recent = this.observations.filter(p => `${p.phase}:${p.algorithm}` === key
        && o.at - p.measuredAt <= GYRO_MOTION_THRESHOLDS.maxPairSpanMs);
      const b = recent.at(-1);
      if (!b || o.at - b.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs) continue;
      const error = (p: Observation) => wrap(p.yawDeg - base - p.integratedDriftDeg
        - this.historyRevisionDeg - this.landmarkAdjustmentDeg);
      const noise = Math.hypot(this.profileNoise.get(key)!, b.noiseDeg);
      // Profiles already require repeated executions. Several phases of the
      // same algorithm cannot turn one fresh grip into independent evidence.
      cases.set(b.algorithm, [...(cases.get(b.algorithm) ?? []), { error: error(b), noise, phase: b.phase, fallback: b.fallback }]);
    }
    // A buffered start fills a missing case, rather than changing the vote of
    // a case that already has fresh execution/finish landmarks.
    for (const [algorithm, phases] of cases) {
      const execution = phases.filter(p => !p.fallback);
      if (execution.length) cases.set(algorithm, execution);
    }
    if (cases.size < GYRO_MOTION_THRESHOLDS.minPooledCases) return;
    const votes = [...cases].map(([algorithm, phases]) => ({ algorithm,
      error: circularMedian(phases.map(p => p.error)), noise: median(phases.map(p => p.noise)), phases }));
    const error = circularMedian(votes.map(v => v.error));
    const uncertainty = Math.max(GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg,
      Math.max(median(votes.map(v => v.noise)), 1.4826 * median(votes.map(v => Math.abs(wrap(v.error - error)))))
        / Math.sqrt(votes.length - 2));
    const agreeing = votes.filter(v => Math.abs(wrap(v.error - error)) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise
      * Math.hypot(v.noise, uncertainty));
    if (agreeing.length < GYRO_MOTION_THRESHOLDS.minPooledCases || agreeing.length <= votes.length / 2
      || !agreeing.some(v => v.algorithm === o.algorithm && v.phases.some(p => p.phase === o.phase
        && Math.abs(wrap(p.error - error)) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(p.noise, uncertainty)))
      || Math.abs(error) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * uncertainty
      || uncertainty > GYRO_MOTION_THRESHOLDS.maxResidualDeg) return;
    if (!this.fitAttempt || o.attemptId > this.fitAttempt.id) this.fitAttempt = { id: o.attemptId, rateChange: 0, revisionDeg: 0 };
    if (o.attemptId !== this.fitAttempt.id) return;
    const budget = Math.max(0, GYRO_MOTION_THRESHOLDS.maxRevisionPerAttemptDeg - this.fitAttempt.revisionDeg);
    const adjustmentDeg = Math.max(-budget, Math.min(budget, error));
    if (!adjustmentDeg) return;
    const predicted = this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg;
    this.landmarkAdjustmentDeg += adjustmentDeg;
    this.fitAttempt.revisionDeg += Math.abs(adjustmentDeg);
    this.lastRecovery = { at: o.at, targetDeg: predicted + error, uncertaintyDeg: uncertainty, cases: agreeing.length, adjustmentDeg };
  }

  /** Every valid packet is observed, even while correction is disabled. */
  observe(raw: Quaternion, at: number, steadyMs: number, enabled: boolean) {
    if (![at, raw.x, raw.y, raw.z, raw.w, raw.lengthSq()].every(Number.isFinite) || raw.lengthSq() < 1e-8) return;
    const previous = this.previous;
    if (previous && at <= previous.at) return;
    const q = raw.clone().normalize();
    this.previous = { q, at };
    this.supported = true;
    this.moving = this.adjusting = false;
    const gap = previous ? at - previous.at : Infinity;
    const validGap = gap > 0 && gap <= GYRO_MOTION_THRESHOLDS.maxSampleGapMs;
    let motion = 0;
    if (validGap) {
      this.elapsedSeconds += gap / 1000;
      const angle = previous!.q.angleTo(q) * DEG;
      if (steadyMs < GYRO_MOTION_THRESHOLDS.stillMs && angle > GYRO_MOTION_THRESHOLDS.minMotionStepDeg) {
        this.moving = true;
        motion = Math.min(angle, GYRO_MOTION_THRESHOLDS.maxMotionSpeedDegPerSecond * gap / 1000);
        this.motionDeg += motion;
      }
      if (this.ready(at)) this.integratedDriftDeg += this.rate * (this.basis === 'motion' ? motion : gap / 1000);
    }
    this.path.push({ at, motionDeg: this.motionDeg, elapsedSeconds: this.elapsedSeconds,
      integratedDriftDeg: this.integratedDriftDeg,
      predictedHeadingDeg: this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg });
    while (this.path.length > 1 && (at - this.path[0].at > GYRO_MOTION_THRESHOLDS.motionHistoryMs
      || this.path.length > GYRO_MOTION_THRESHOLDS.maxMotionSamples)) this.path.shift();
    if (!enabled || !validGap) return;
    const target = this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg;
    const step = GYRO_MOTION_THRESHOLDS.maxCorrectionSpeedDegPerSecond * gap / 1000;
    const adjustment = Math.max(-step, Math.min(step, target - this.appliedDeg));
    this.appliedDeg += adjustment;
    this.adjusting = Math.abs(adjustment) > 1e-8;
  }

  private observationGroups(basis: Basis, includeFallback = true, includeFragments = false) {
    const groups = new Map<string, Observation[]>();
    for (const p of this.observations) {
      if ((!includeFallback && p.fallback) || (!includeFragments && p.partial)) continue;
      const key = `${p.phase}:${p.algorithm}`;
      if (p.measuredAt < (this.fitStarts.get(`${basis}:${key}`) ?? -Infinity)) continue;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    if (!includeFallback) return groups;
    const now = this.observations.at(-1)?.at ?? 0;
    const executionCases = new Set([...groups.values()].filter(group => {
      const latest = group.at(-1)!;
      return !latest.fallback && now - latest.measuredAt <= GYRO_MOTION_THRESHOLDS.maxPairSpanMs
        && group.slice(0, -1).some(previous => pairEvidence([previous, latest], basis,
          GYRO_MOTION_THRESHOLDS.rateHistoryMs).slopes.length);
    }).map(group => group[0].algorithm));
    for (const [key, group] of groups) {
      if (group[0].fallback && !group[0].partial && executionCases.has(group[0].algorithm)) groups.delete(key);
    }
    return groups;
  }

  private repeatedCandidate(basis: Basis, now: number, current: GyroMotionObservation, conflicts: Set<Basis>,
    includeFallback = true): Candidate | null {
    const groups = this.observationGroups(basis, includeFallback);
    const limit = basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGain : GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond;
    const spreadLimit = basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGainSpread : GYRO_MOTION_THRESHOLDS.maxTimeRateSpread;
    const fits: Fit[] = [];
    for (const group of groups.values()) {
      if (group.length < GYRO_MOTION_THRESHOLDS.minRepetitions || now - group.at(-1)!.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs) continue;
      const { slopes, noises } = pairEvidence(group, basis);
      if (slopes.length < GYRO_MOTION_THRESHOLDS.minPairs) continue;
      const rate = median(slopes);
      // Pairs share samples. Reduce noise by independent executions, never by
      // the much larger pair count, and retain a floor over the observed span.
      const exposureSpan = position(group.at(-1)!, basis) - position(group[0], basis);
      const uncertainty = Math.max(Math.max(median(noises), 1.4826 * median(slopes.map(s => Math.abs(s - rate))))
        / Math.sqrt(group.length - 2), GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg / Math.max(1e-8, exposureSpan));
      // Check the most recent independent executions too. A step in grip
      // followed by a plateau must not qualify later through old cross-step
      // pairs, and old observations must not mask a changing drift direction.
      const recent = group.filter(p => now - p.measuredAt <= GYRO_MOTION_THRESHOLDS.maxPairSpanMs);
      if (recent.length < GYRO_MOTION_THRESHOLDS.minRepetitions) continue;
      const tail = recent.slice(-Math.max(GYRO_MOTION_THRESHOLDS.minRepetitions, Math.ceil(recent.length / 2)));
      const { slopes: recentSlopes, noises: recentNoises } = pairEvidence(tail, basis);
      if (recentSlopes.length < GYRO_MOTION_THRESHOLDS.minPairs) continue;
      const recentRate = median(recentSlopes);
      const recentUncertainty = Math.max(median(recentNoises),
        1.4826 * median(recentSlopes.map(s => Math.abs(s - recentRate)))) / Math.sqrt(tail.length - 2);
      if (recentRate * rate <= 0
        || Math.abs(recentRate - rate) > GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(uncertainty, recentUncertainty)) {
        if (group[0].algorithm === current.algorithm && group[0].phase === current.phase) {
          conflicts.add(basis);
          // Keep older evidence for precision only while recent executions
          // agree. A detected change starts a fresh phase fit from this tail,
          // so a long session's old majority cannot prevent relearning.
          this.fitStarts.set(`${basis}:${current.phase}:${current.algorithm}`, tail[0].measuredAt);
        }
        continue;
      }
      const intercept = circularMedian(group.map(p => p.yawDeg - rate * position(p, basis)));
      const residual = median(group.map(p => Math.abs(wrap(p.yawDeg - rate * position(p, basis) - intercept))));
      if (Math.abs(rate) > limit || uncertainty > spreadLimit || residual > GYRO_MOTION_THRESHOLDS.maxResidualDeg) continue;
      fits.push({ algorithm: group[0].algorithm, phase: group[0].phase, rate, uncertainty, residual,
        repetitions: group.length, evidenceAt: group.at(-1)!.measuredAt });
    }
    // An unrelated case cannot refresh or repeatedly apply old fitted evidence.
    if (!fits.some(f => f.algorithm === current.algorithm && f.phase === current.phase)) return null;
    const cases = new Map<string, Fit[]>();
    for (const fit of fits) cases.set(fit.algorithm, [...(cases.get(fit.algorithm) ?? []), fit]);
    const rates = [...cases.values()].map(phases => median(phases.map(p => p.rate)));
    const rate = median(rates);
    const uncertainty = Math.max(median([...cases.values()].map(phases => median(phases.map(p => p.uncertainty)))),
      1.4826 * median(rates.map(r => Math.abs(r - rate))));
    if (uncertainty > spreadLimit || Math.abs(rate) < GYRO_MOTION_THRESHOLDS.minSignalToNoise * uncertainty) return null;
    return { basis, rate, uncertainty, fits, cases: cases.size, evidence: 'repeated-phase',
      scoreDeg: median([...cases.values()].map(phases => median(phases.map(p => p.residual)))),
      repetitions: Math.min(...fits.map(f => f.repetitions)), evidenceAt: Math.max(...fits.map(f => f.evidenceAt)) };
  }

  /** A wide practice set may revisit each phase only once per minute or two.
   * Cancel its grip offset with a within-phase pair, then require independent
   * algorithms to agree. During/finish phases never create extra case votes.
   * Only the latest interval is used, so old cross-step pairs cannot keep
   * reviving a drift that recent repeats no longer support. */
  private pooledCandidate(basis: Basis, now: number, current: GyroMotionObservation,
    maxSpanMs: number = GYRO_MOTION_THRESHOLDS.maxPairSpanMs, includeFallback = true,
    includeFragments = false, preferPrecisePair = false): Candidate | null {
    const limit = basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGain : GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond;
    const spreadLimit = basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGainSpread : GYRO_MOTION_THRESHOLDS.maxTimeRateSpread;
    const pairs: Array<{ fit: Fit; exposure: number }> = [];
    for (const group of this.observationGroups(basis, includeFallback, includeFragments).values()) {
      const b = group.at(-1)!;
      // Consensus spans one pair horizon; the current matching repetition
      // must still be fresh to renew integration. Requiring every case in a
      // long practice cycle to repeat within staleMs starves the pooled fit.
      if (now - b.measuredAt > GYRO_MOTION_THRESHOLDS.maxPairSpanMs) continue;
      const previous = group.slice(0, -1).reverse();
      let a = previous.find(a => pairEvidence([a, b], basis, maxSpanMs).slopes.length);
      if (!a) continue;
      if (preferPrecisePair) {
        const recent = pairEvidence([a, b], basis, maxSpanMs);
        if (pairMayWrap(a, b, basis, recent.noises[0])) continue;
        let bestNoise = recent.noises[0];
        // A short latest interval can hide a well-measured trend in retained
        // history. Rank compatible pairs by uncertainty, preserving the latest
        // interval's direction. A flat repeat cannot revive an old step.
        for (const p of previous) {
          const evidence = pairEvidence([p, b], basis, maxSpanMs);
          if (!evidence.slopes.length || evidence.noises[0] >= bestNoise
            || evidence.slopes[0] * recent.slopes[0] <= 0) continue;
          if (pairMayWrap(p, b, basis, evidence.noises[0])
            || Math.abs(evidence.slopes[0] - recent.slopes[0]) > GYRO_MOTION_THRESHOLDS.minSignalToNoise
              * Math.hypot(evidence.noises[0], recent.noises[0])) continue;
          a = p;
          bestNoise = evidence.noises[0];
        }
      }
      const { slopes, noises } = pairEvidence([a, b], basis, maxSpanMs);
      if (Math.abs(slopes[0]) > limit) continue;
      const pairSpanMs = b.measuredAt - a.measuredAt;
      // Preserve the long-pair winding check for both selection methods.
      if (pairMayWrap(a, b, basis, noises[0])) continue;
      pairs.push({ fit: { algorithm: b.algorithm, phase: b.phase, rate: slopes[0], uncertainty: noises[0],
        partial: b.partial, residual: 0, repetitions: 2, evidenceAt: b.measuredAt, pairSpanMs },
        exposure: position(b, basis) - position(a, basis) });
    }
    const cases = new Map<string, typeof pairs>();
    for (const p of pairs) cases.set(p.fit.algorithm, [...(cases.get(p.fit.algorithm) ?? []), p]);
    if (includeFragments) {
      // Alternative windows share executions, not independent case votes.
      // Select by measurement precision, never by the observed drift sign.
      for (const [algorithm, phases] of cases) {
        cases.set(algorithm, [[...phases].sort((a, b) => a.fit.uncertainty - b.fit.uncertainty)[0]]);
      }
      pairs.splice(0, pairs.length, ...[...cases.values()].flat());
    }
    if (cases.size < GYRO_MOTION_THRESHOLDS.minPooledCases) return null;
    const votes = [...cases].map(([algorithm, phases]) => ({ algorithm, rate: median(phases.map(p => p.fit.rate)),
      uncertainty: median(phases.map(p => p.fit.uncertainty)), exposure: median(phases.map(p => p.exposure)) }));
    const rate = median(votes.map(v => v.rate));
    // Reduce noise by independent algorithms, never by the correlated phase
    // or pair count. Retain a floor over the typical observed interval.
    const uncertainty = Math.max(Math.max(median(votes.map(v => v.uncertainty)),
      1.4826 * median(votes.map(v => Math.abs(v.rate - rate)))) / Math.sqrt(cases.size - 2),
      GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg / median(votes.map(v => v.exposure)));
    if (uncertainty > spreadLimit || Math.abs(rate) < GYRO_MOTION_THRESHOLDS.minSignalToNoise * uncertainty) return null;
    const supportingCases = new Set(votes.filter(v => v.rate * rate > 0 && Math.abs(v.rate - rate)
      <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(v.uncertainty, uncertainty)).map(v => v.algorithm));
    const agreeing = pairs.filter(p => supportingCases.has(p.fit.algorithm) && p.fit.rate * rate > 0 && Math.abs(p.fit.rate - rate)
      <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(p.fit.uncertainty, uncertainty));
    const agreeingCases = new Set(agreeing.map(p => p.fit.algorithm));
    if (now - current.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs
      || agreeingCases.size < GYRO_MOTION_THRESHOLDS.minPooledCases || agreeingCases.size <= cases.size / 2
      || !agreeing.some(p => p.fit.algorithm === current.algorithm && p.fit.phase === current.phase)) return null;
    const fragmentCases = new Set(agreeing.filter(p => p.fit.partial).map(p => p.fit.algorithm)).size;
    if (includeFragments && !fragmentCases) return null;
    const residuals = new Map<string, number[]>();
    for (const p of agreeing) {
      p.fit.residual = Math.abs(p.fit.rate - rate) * p.exposure / 2;
      residuals.set(p.fit.algorithm, [...(residuals.get(p.fit.algorithm) ?? []), p.fit.residual]);
    }
    const scoreDeg = median([...residuals.values()].map(median));
    if (scoreDeg > GYRO_MOTION_THRESHOLDS.maxResidualDeg) return null;
    return { basis, rate, uncertainty, scoreDeg, cases: agreeingCases.size, repetitions: 2, fragmentCases,
      pairSelection: preferPrecisePair ? 'precision' : 'recent',
      fits: agreeing.map(p => p.fit), evidenceAt: current.measuredAt, evidence: 'pooled-cases' };
  }

  /** Fresh independent repeats may veto an unsupported forecast without
   * qualifying a replacement rate, including when their trend is flat. */
  private recentContradiction(basis: Basis, proposedRate: number, modelUncertainty: number,
    current: GyroMotionObservation): TrendHold | null {
    if (!proposedRate || current.at - current.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs) return null;
    const phases: Array<{ algorithm: string; phase: string; rate: number; noise: number; exposure: number }> = [];
    const limit = basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGain : GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond;
    for (const group of this.observationGroups(basis, false).values()) {
      const b = group.at(-1)!;
      if (current.at - b.measuredAt > GYRO_MOTION_THRESHOLDS.staleMs) continue;
      const a = group.slice(0, -1).reverse().find(a => pairEvidence([a, b], basis).slopes.length);
      if (!a) continue;
      const { slopes, noises } = pairEvidence([a, b], basis);
      if (Math.abs(slopes[0]) > limit) continue;
      phases.push({ algorithm: b.algorithm, phase: b.phase, rate: slopes[0], noise: noises[0],
        exposure: position(b, basis) - position(a, basis) });
    }
    const cases = new Map<string, typeof phases>();
    for (const p of phases) cases.set(p.algorithm, [...(cases.get(p.algorithm) ?? []), p]);
    if (cases.size < GYRO_MOTION_THRESHOLDS.minPooledCases) return null;
    const votes = [...cases].map(([algorithm, group]) => ({ algorithm, phases: group,
      rate: median(group.map(p => p.rate)), noise: median(group.map(p => p.noise)),
      exposure: median(group.map(p => p.exposure)) }));
    const rate = median(votes.map(v => v.rate));
    const noise = Math.max(Math.max(median(votes.map(v => v.noise)),
      1.4826 * median(votes.map(v => Math.abs(v.rate - rate)))) / Math.sqrt(votes.length - 2),
      GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg / median(votes.map(v => v.exposure)));
    const uncertainty = Math.hypot(noise, modelUncertainty);
    const delta = rate - proposedRate;
    if (delta * proposedRate >= 0 || Math.abs(delta) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * uncertainty) return null;
    const agreeing = votes.filter(v => (v.rate - proposedRate) * delta > 0
      && Math.abs(v.rate - rate) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(v.noise, uncertainty));
    if (agreeing.length < GYRO_MOTION_THRESHOLDS.minPooledCases || agreeing.length <= votes.length / 2
      || !agreeing.some(v => v.algorithm === current.algorithm && v.phases.some(p => p.phase === current.phase
        && (p.rate - proposedRate) * delta > 0
        && Math.abs(p.rate - rate) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise * Math.hypot(p.noise, uncertainty)))) return null;
    return { at: current.at, basis, proposedRate, measuredRate: rate, uncertainty, cases: agreeing.length };
  }

  private confirmCandidate(candidate: Candidate, current: GyroMotionObservation, pending: Map<Basis, RateConfirmation>) {
    const previous = pending.get(candidate.basis);
    if (!previous || candidate.rate * previous.rate <= 0 || current.at - previous.at > GYRO_MOTION_THRESHOLDS.staleMs) {
      pending.set(candidate.basis, { at: current.at, measuredAt: current.measuredAt,
        rate: candidate.rate, algorithms: new Set([current.algorithm]) });
      return false;
    }
    if (current.measuredAt > previous.measuredAt) {
      previous.algorithms.add(current.algorithm);
      previous.measuredAt = current.measuredAt;
    }
    const minimum = pending === this.fragmentPending ? GYRO_MOTION_THRESHOLDS.minFragmentConfirmations
      : GYRO_MOTION_THRESHOLDS.minPairConfirmations;
    if (previous.algorithms.size < minimum) return false;
    if (pending === this.fragmentPending) candidate.fragmentConfirmations = previous.algorithms.size;
    else candidate.pairConfirmations = previous.algorithms.size;
    return true;
  }

  private candidate(basis: Basis, now: number, current: GyroMotionObservation, conflicts: Set<Basis>,
    fallback = false): Candidate | null {
    // Prefer the recent, shorter-interval hypotheses. Longer practice cycles
    // can still supply a new within-phase difference from retained history;
    // they do not extend endpoint freshness or the integration allowance.
    if (fallback) return this.pooledCandidate(basis, now, current)
      ?? this.pooledCandidate(basis, now, current, GYRO_MOTION_THRESHOLDS.rateHistoryMs);
    return this.repeatedCandidate(basis, now, current, conflicts, false)
      ?? this.pooledCandidate(basis, now, current, GYRO_MOTION_THRESHOLDS.maxPairSpanMs, false)
      ?? this.pooledCandidate(basis, now, current, GYRO_MOTION_THRESHOLDS.rateHistoryMs, false);
  }

  completeObservation(input: GyroMotionObservation) {
    const sampleCount = input.sampleCount ?? 0, exposureMs = input.exposureMs ?? 0;
    if (input.partial && (!Number.isSafeInteger(sampleCount) || !Number.isFinite(exposureMs)
      || sampleCount < GYRO_GRIP_THRESHOLDS.minBaselineFragmentSamples
      || exposureMs < GYRO_GRIP_THRESHOLDS.minBaselineFragmentMs)) return;
    // A shortened window is a separate, less precise phase. It cannot silently
    // replace or multiply observations from the full execution phase.
    const o = input.partial ? { ...input, phase: `fragment-${input.phase}`, fallback: true } : input;
    if (!this.supported || ![o.at, o.measuredAt, o.yawDeg, o.spreadDeg].every(Number.isFinite)
      || o.spreadDeg < 0 || o.measuredAt > o.at || o.measuredAt > this.previous!.at
      || (this.fitAttempt && o.attemptId < this.fitAttempt.id)) return;
    const point = [...this.path].reverse().find(p => p.at <= o.measuredAt);
    if (!point || o.measuredAt - point.at > GYRO_MOTION_THRESHOLDS.maxSampleGapMs) return;
    if (this.observations.some(p => p.attemptId === o.attemptId && p.phase === o.phase)) return;
    const quality = o.partial ? Math.min(1, sampleCount / GYRO_GRIP_THRESHOLDS.minObservationSamples,
      exposureMs / GYRO_GRIP_THRESHOLDS.minObservationMs) : 1;
    const observation = { ...o, quality, noiseDeg: Math.max(GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg,
      o.spreadDeg) / Math.sqrt(quality), motionDeg: point.motionDeg, elapsedSeconds: point.elapsedSeconds,
      integratedDriftDeg: point.integratedDriftDeg,
      predictedHeadingDeg: point.predictedHeadingDeg };
    this.observations = [...this.observations.filter(p => o.at - p.at <= GYRO_MOTION_THRESHOLDS.rateHistoryMs), observation];
    if (this.observations.length > GYRO_MOTION_THRESHOLDS.maxObservations) {
      // Supplementary holds must not shorten retained execution history.
      const fallback = this.observations.findIndex(p => p.fallback);
      this.observations.splice(fallback < 0 ? 0 : fallback, 1);
    }
    const activeFits = new Set(this.observations.flatMap(p => ['motion', 'time'].map(b => `${b}:${p.phase}:${p.algorithm}`)));
    for (const key of this.fitStarts.keys()) if (!activeFits.has(key)) this.fitStarts.delete(key);
    // Only a qualified home rate displaces the algorithm rate learner. An
    // absolute heading observation alone never revokes useful velocity support.
    if (this.fitEvidence === 'home-grip' && this.ready(o.at)) return;
    const key = `${o.phase}:${o.algorithm}`;
    const baseline = this.observations.filter(p => p.algorithm === o.algorithm && p.phase === o.phase);
    const conflicts = new Set<Basis>();
    const bases: Basis[] = ['motion', 'time'];
    let candidates = bases.map(basis => this.candidate(basis, o.at, o, conflicts))
      .filter((c): c is Candidate => c != null);
    // Existing evidence gets first choice across both units. Supplementary
    // starts can fill missing cases only through the five-case pooled gate.
    if (!candidates.length && this.observations.some(p => p.fallback)) {
      candidates = bases.map(basis => this.candidate(basis, o.at, o, conflicts, true))
        .filter((c): c is Candidate => c != null);
    }
    if (candidates.length) {
      this.fragmentPending.clear();
      this.precisePairPending.clear();
    }
    // Fragments bootstrap/resume a model or refine one already learned from
    // fragments. A supported full-window model always retains priority.
    if (!candidates.length && (!this.ready(o.at) || this.fittedFragmentCases > 0)
      && this.observations.some(p => p.partial)) {
      candidates = bases.map(basis => this.pooledCandidate(basis, o.at, o,
        GYRO_MOTION_THRESHOLDS.maxPairSpanMs, true, true)
        ?? this.pooledCandidate(basis, o.at, o, GYRO_MOTION_THRESHOLDS.rateHistoryMs, true, true))
        .filter((c): c is Candidate => c != null).filter(c => this.confirmCandidate(c, o, this.fragmentPending));
    }
    // Preserve every existing qualified model. At neutral startup or after
    // support expires, quieter full-window pairs may qualify through the same
    // five-case gates, plus three later independent case confirmations. They
    // never extrapolate the pause or borrow short-window confirmations.
    if (!candidates.length && !this.ready(o.at)) {
      candidates = bases.map(basis => this.pooledCandidate(basis, o.at, o,
        GYRO_MOTION_THRESHOLDS.maxPairSpanMs, false, false, true)
        ?? this.pooledCandidate(basis, o.at, o, GYRO_MOTION_THRESHOLDS.rateHistoryMs, false, false, true))
        .filter((c): c is Candidate => c != null).filter(c => this.confirmCandidate(c, o, this.precisePairPending));
    }
    candidates = candidates.filter(candidate => {
      const contradiction = this.recentContradiction(candidate.basis, candidate.rate, candidate.uncertainty, o);
      return !contradiction;
    });
    const contradiction = this.ready(o.at) && this.recentContradiction(this.basis, this.rate, this.uncertainty ?? 0, o);
    if (contradiction) {
      this.conflictingEvidence = true;
      this.lastTrendHold = contradiction;
    }
    candidates.sort((a, b) => a.scoreDeg - b.scoreDeg);
    const previous = candidates.find(c => c.basis === this.basis);
    const fit = previous && previous.scoreDeg <= candidates[0].scoreDeg + GYRO_MOTION_THRESHOLDS.basisSwitchMarginDeg
      ? previous : candidates[0];
    if (!this.profiles.has(key) && this.profiles.size < GYRO_MOTION_THRESHOLDS.maxProfiles
      && fit?.evidence === 'pooled-cases' && baseline.length >= GYRO_MOTION_THRESHOLDS.pooledBaselineRepetitions) {
      // Independent case consensus can support a sparse phase after two
      // repetitions. Remove that observed trend before centering its early
      // raw grips, anchored at the first observation's internal prediction.
      // Waiting for three distant raw grips would bake startup drift into the
      // baseline. No heading is extrapolated before the first observation.
      const early: Observation[] = [];
      let effectiveRepetitions = 0;
      for (const p of baseline) {
        early.push(p);
        effectiveRepetitions += p.quality;
        if (effectiveRepetitions >= GYRO_MOTION_THRESHOLDS.pooledBaselineRepetitions) break;
      }
      const evidence = pairEvidence(early, fit.basis, GYRO_MOTION_THRESHOLDS.rateHistoryMs);
      if (effectiveRepetitions >= GYRO_MOTION_THRESHOLDS.pooledBaselineRepetitions
        && evidence.slopes.length && median(evidence.slopes) * fit.rate > 0
        && Math.abs(median(evidence.slopes) - fit.rate) <= GYRO_MOTION_THRESHOLDS.minSignalToNoise
          * Math.hypot(median(evidence.noises), fit.uncertainty)) {
        const headingDeg = circularMedian(early.map(p => p.yawDeg - early[0].predictedHeadingDeg
          - fit.rate * (position(p, fit.basis) - position(early[0], fit.basis))));
        this.profiles.set(key, headingDeg);
        this.profileNoise.set(key, Math.max(...early.map(p => p.noiseDeg)));
      }
    }
    if (!o.fallback && !this.profiles.has(key) && this.profiles.size < GYRO_MOTION_THRESHOLDS.maxProfiles
      && baseline.length >= GYRO_MOTION_THRESHOLDS.baselineRepetitions) {
      const early = baseline.slice(0, GYRO_MOTION_THRESHOLDS.baselineRepetitions);
      const headingDeg = circularMedian(early.map(p => p.yawDeg - p.predictedHeadingDeg));
      this.profiles.set(key, headingDeg);
      this.profileNoise.set(key, Math.max(...early.map(p => p.noiseDeg),
        ...early.map(p => Math.abs(wrap(p.yawDeg - p.predictedHeadingDeg - headingDeg)))));
    }
    if (!candidates.length) {
      // Fresh contradictory evidence from a supporting phase suspends further
      // integration now; it must not renew the old fit for another stale period.
      // Unfamiliar cases and ineligible observations cannot revoke or refresh it.
      if (!this.conflictingEvidence && this.supportingPhases.has(key) && conflicts.has(this.basis)) {
        this.conflictingEvidence = true;
      }
      this.recoverHeading(o);
      return;
    }
    this.applyFit(fit, observation);
  }

  private applyFit(fit: Candidate, o: Observation, absoluteTargetDeg?: number, absoluteCases = 0) {
    if (!this.fitAttempt || o.attemptId > this.fitAttempt.id) this.fitAttempt = { id: o.attemptId, rateChange: 0, revisionDeg: 0 };
    if (this.fitAttempt.id !== o.attemptId) return;
    // A shared, dimensionless fraction of the rate-change allowance prevents a
    // during/finish basis switch from getting a second budget in different units.
    const maxChange = fit.basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGainChangePerAttempt
      : GYRO_MOTION_THRESHOLDS.maxTimeRateChangePerAttempt;
    const basisChanged = this.basis !== fit.basis;
    const start = [...this.path].reverse().find(p => p.at <= o.at - GYRO_MOTION_THRESHOLDS.revisionWindowMs) ?? this.path[0];
    const end = this.path.at(-1)!;
    const recentExposure = start ? Math.max(0, position(end, fit.basis) - position(start, fit.basis)) : 0;
    const previousExposure = start ? Math.max(0, position(end, this.basis) - position(start, this.basis)) : 0;
    // Changing units is not a new cold start. Transfer the already learned
    // local heading velocity through received exposure, then slew toward the
    // new fit. This changes neither past integration nor landmark predictions.
    const limit = fit.basis === 'motion' ? GYRO_MOTION_THRESHOLDS.maxMotionGain : GYRO_MOTION_THRESHOLDS.maxTimeRateDegPerSecond;
    const previousRate = basisChanged ? Math.max(-limit, Math.min(limit,
      recentExposure > 0 ? this.rate * previousExposure / recentExposure : 0)) : this.rate;
    const budget = maxChange * Math.max(0, 1 - this.fitAttempt.rateChange);
    if (this.basis !== fit.basis && budget <= 1e-12) return;
    const rateChange = Math.max(-budget, Math.min(budget, fit.rate - previousRate));
    this.fitAttempt.rateChange += Math.abs(rateChange) / maxChange;
    this.basis = fit.basis;
    this.rate = previousRate + rateChange;
    // A new basis describes the same drift in different units. It starts
    // integrating future exposure only; adding its history again double-counts
    // compensation already integrated under the preceding hypothesis.
    // A home trend supports future velocity only. Accumulated home heading
    // still needs its separate absolute consensus, even during fast startup.
    const requestedRevisionDeg = basisChanged || fit.evidence === 'home-grip' ? 0 : rateChange * recentExposure;
    // Recurring raw grips also provide relative heading landmarks. This can
    // recover accumulated error after neutral startup without a vendor prior.
    // Profiles freeze early, and only rate-supported repetitions can use them.
    const landmarks = new Map<string, number[]>();
    const predicted = this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg;
    for (const profile of fit.fits) {
      const base = this.profiles.get(`${profile.phase}:${profile.algorithm}`);
      if (base == null) continue;
      const recent = this.observations.filter(p => p.algorithm === profile.algorithm && p.phase === profile.phase
        && o.at - p.measuredAt <= GYRO_MOTION_THRESHOLDS.revisionWindowMs).slice(-3);
      if (!recent.length) continue;
      const heading = circularMedian(recent.map(p => p.yawDeg - base + fit.rate
        * (position(this.path.at(-1)!, this.basis) - position(p, this.basis))));
      const unwrapped = predicted + wrap(heading - predicted);
      landmarks.set(profile.algorithm, [...(landmarks.get(profile.algorithm) ?? []), unwrapped]);
    }
    const landmarkTargetDeg = absoluteTargetDeg ?? (landmarks.size ? median([...landmarks.values()].map(phases => median(phases))) : null);
    const landmarkBudget = Math.max(0, GYRO_MOTION_THRESHOLDS.maxRevisionPerAttemptDeg - this.fitAttempt.revisionDeg);
    const landmarkAdjustmentDeg = landmarkTargetDeg == null || (absoluteTargetDeg != null
      && Math.abs(landmarkTargetDeg - predicted) <= GYRO_MOTION_THRESHOLDS.observationNoiseFloorDeg) ? 0
      : Math.max(-landmarkBudget, Math.min(landmarkBudget, landmarkTargetDeg - predicted));
    this.landmarkAdjustmentDeg += landmarkAdjustmentDeg;
    this.fitAttempt.revisionDeg += Math.abs(landmarkAdjustmentDeg);
    // A fresh raw landmark constrains accumulated heading directly. A rate
    // revision is only a hypothesis about recent history; applying it first
    // can spend the entire allowance moving away from the observed target.
    // Use history revisions only when no landmark is available, including
    // when the observed target already agrees and requests no adjustment.
    const revisionBudget = Math.max(0, GYRO_MOTION_THRESHOLDS.maxRevisionPerAttemptDeg - this.fitAttempt.revisionDeg);
    const revision = landmarkTargetDeg != null ? 0
      : Math.max(-revisionBudget, Math.min(revisionBudget, requestedRevisionDeg));
    const before = this.historyRevisionDeg;
    this.historyRevisionDeg = Math.max(-GYRO_MOTION_THRESHOLDS.maxHistoryRevisionDeg,
      Math.min(GYRO_MOTION_THRESHOLDS.maxHistoryRevisionDeg, before + revision));
    const revisionDeg = this.historyRevisionDeg - before;
    this.fitAttempt.revisionDeg += Math.abs(revisionDeg);
    this.learned = true;
    this.conflictingEvidence = false;
    this.supportingPhases = new Set(fit.fits.map(p => `${p.phase}:${p.algorithm}`));
    this.evidenceAt = fit.evidenceAt;
    this.fittedCases = fit.cases;
    this.fittedFragmentCases = fit.fragmentCases ?? 0;
    this.fittedRate = fit.rate;
    this.fitAt = o.at;
    this.uncertainty = fit.uncertainty;
    this.fitEvidence = fit.evidence;
    this.fitPairSelection = fit.pairSelection ?? null;
    this.fitPairSpanMs = fit.evidence === 'pooled-cases' ? Math.max(...fit.fits.map(p => p.pairSpanMs!)) : null;
    this.lastFit = { at: o.at, basis: this.basis, previousRate, requestedRate: fit.rate, rateChange,
      recentExposure, requestedRevisionDeg, revisionDeg, landmarkTargetDeg, landmarkAdjustmentDeg, landmarkCases: absoluteCases || landmarks.size };
    if (absoluteTargetDeg != null) this.lastHomeAdjustment = { at: o.at, targetDeg: absoluteTargetDeg,
      adjustmentDeg: landmarkAdjustmentDeg, episodes: absoluteCases };
    this.fragmentPending.clear();
    this.precisePairPending.clear();
  }

  snapshot(at = this.previous?.at ?? 0) {
    const rateReady = this.ready(at), homeReady = this.homeReady(at), ready = rateReady || homeReady;
    return { supported: this.supported, ready,
      rateReady, headingEvidence: homeReady ? 'home-grip' : rateReady && this.fitEvidence !== 'home-grip' ? 'algorithm-rate' : null,
      homeGrip: { episodes: this.homeObservations.length, evidenceAt: this.homeEvidenceAt,
        effectiveEpisodes: this.homeObservations.reduce((sum, o) => sum + o.quality, 0),
        ready: homeReady, lastAdjustment: this.lastHomeAdjustment && { ...this.lastHomeAdjustment },
        rateConfirmation: [...this.homeRatePending].map(([basis, pending]) => ({ basis, at: pending.at,
          episodes: pending.attempts.size, rate: pending.rate })) },
      status: ready ? 'tracking' : this.learned || this.homeEverReady ? 'held' : 'learning',
      holdReason: (!this.learned && !this.homeEverReady) || ready ? null : this.evidenceAt == null || at < this.evidenceAt
        || at - this.evidenceAt > GYRO_MOTION_THRESHOLDS.staleMs ? 'stale-evidence' : this.conflictingEvidence ? 'recent-trend-changed'
        : this.fittedRate != null && this.rate * this.fittedRate <= 0 ? 'rate-transition' : 'stale-evidence',
      basis: this.basis, rate: this.rate, rateUncertainty: this.uncertainty,
      gainDegPerMotionDeg: this.basis === 'motion' ? this.rate : null,
      rateDegPerSecond: this.basis === 'time' ? this.rate : null,
      motionDeg: this.motionDeg, elapsedSeconds: this.elapsedSeconds,
      estimatedDriftDeg: this.integratedDriftDeg + this.historyRevisionDeg + this.landmarkAdjustmentDeg,
      integratedDriftDeg: this.integratedDriftDeg, historyRevisionDeg: this.historyRevisionDeg,
      landmarkAdjustmentDeg: this.landmarkAdjustmentDeg,
      appliedDeg: this.appliedDeg, fittedRate: this.fittedRate, fittedCases: this.fittedCases,
      fittedFragmentCases: this.fittedFragmentCases,
      fitEvidence: this.fitEvidence,
      fitPairSpanMs: this.fitPairSpanMs,
      fitPairSelection: this.fitPairSelection,
      landmarkProfiles: this.profiles.size,
      observations: this.observations.length, minRepetitions: GYRO_MOTION_THRESHOLDS.minRepetitions,
      fragmentObservations: this.observations.filter(p => p.partial).length,
      fragmentConfirmation: [...this.fragmentPending].map(([basis, pending]) => ({ basis,
        at: pending.at, cases: pending.algorithms.size })),
      pairConfirmation: [...this.precisePairPending].map(([basis, pending]) => ({ basis,
        at: pending.at, cases: pending.algorithms.size })),
      fitAt: this.fitAt, evidenceAt: this.evidenceAt, moving: this.moving, adjusting: this.adjusting,
      lastFit: this.lastFit && { ...this.lastFit }, lastRecovery: this.lastRecovery && { ...this.lastRecovery },
      lastTrendHold: this.lastTrendHold && { ...this.lastTrendHold }, method: 'session-learned-heading-rate' };
  }

  /** Transfer an existing render correction when the learner takes ownership;
   * this changes no estimate, profile, raw observation or physical reference. */
  synchronizeAppliedHeading(headingDeg: number) {
    this.appliedDeg += wrap(headingDeg - this.appliedDeg);
  }
}
