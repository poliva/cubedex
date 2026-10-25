import { describe, expect, it } from 'vitest';
import { trackMotionChanges } from '../helpers/gyro-motion';
import { Quaternion, Vector3 } from 'three';
import { GYRO_MOTION_THRESHOLDS, GyroMotionDriftEstimator } from '../../src/lib/gyro-motion-drift';
import { GyroDriftCorrector, gyroPoseMetrics } from '../../src/lib/gyro-drift';
const rotation = (axis: 'x' | 'y', deg: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, 0), deg * Math.PI / 180);
function model() {
  return trackMotionChanges();
}
function train(m: GyroMotionDriftEstimator, rate: number, basis: 'motion' | 'time' = 'motion', until = 1800) {
  for (let i = 0; i <= until; i++) {
    // Variable movement makes the time and motion hypotheses distinguishable.
    const angle = basis === 'time' ? 0 : i < 600 ? i * 8 : 4800 + (i - 600) * 2;
    m.observe(rotation('x', angle), i * 100, basis === 'time' ? 1000 : 0, true);
    if (i % 100) continue;
    const s = m.snapshot();
    m.completeObservation({ attemptId: i / 100, algorithm: 'R', phase: 'during', at: i * 100,
      measuredAt: i * 100, yawDeg: 25 + rate * (basis === 'motion' ? s.motionDeg : s.elapsedSeconds), spreadDeg: 1 });
  }
}

function scenario(yaw: (seconds: number) => number, options: {
  travel?: (seconds: number) => number; until?: number; cadenceMs?: number;
} = {}) {
  const { model: m, changes } = model();
  const states = new Map<number, ReturnType<typeof m.snapshot>>();
  const cadence = options.cadenceMs ?? 100;
  for (let at = 0; at <= (options.until ?? 420) * 1000; at += cadence) {
    const seconds = at / 1000;
    m.observe(rotation('x', options.travel?.(seconds) ?? seconds * 80), at, 0, true);
    if (at % 10_000) continue;
    m.completeObservation({ attemptId: at / 10_000, algorithm: 'R', phase: 'during', at, measuredAt: at,
      yawDeg: yaw(seconds), spreadDeg: 1 });
    states.set(seconds, m.snapshot());
  }
  return { m, changes, states };
}

function widePractice(drift: (seconds: number, motion: number, caseIndex: number, phase: number) => number, options: {
  cases?: number; phases?: number; intervalSeconds?: number; until?: number; fragments?: boolean;
} = {}) {
  const { model: m, changes } = model();
  const states = new Map<number, ReturnType<typeof m.snapshot>>();
  for (let at = 0; at <= (options.until ?? 420) * 1000; at += 100) {
    const seconds = at / 1000;
    m.observe(rotation('x', seconds <= 180 ? 80 * seconds : 14_400 + 20 * (seconds - 180)), at, 0, true);
    if (at % ((options.intervalSeconds ?? 4) * 1000)) continue;
    const attemptId = at / ((options.intervalSeconds ?? 4) * 1000);
    const caseIndex = attemptId % (options.cases ?? 21);
    for (let phase = 0; phase < (options.phases ?? 1); phase++) {
      const yaw = caseIndex * 17 - 170 + phase * 35 + drift(seconds, m.snapshot().motionDeg, caseIndex, phase);
      m.completeObservation({ attemptId, algorithm: `case-${caseIndex}`, phase: `phase-${phase}`, at, measuredAt: at,
        yawDeg: ((yaw + 180) % 360 + 360) % 360 - 180, spreadDeg: 1,
        ...(options.fragments ? { partial: true, sampleCount: 2, exposureMs: 100 } : {}) });
    }
    states.set(seconds, m.snapshot());
  }
  return { m, changes, states };
}

function startingGrips(primaryRate: number, startRate: number, options: {
  cases?: number; until?: number; execution?: (caseIndex: number) => boolean; fragments?: boolean;
} = {}) {
  const primary = model(), supplemented = model();
  for (let at = 0; at <= (options.until ?? 180) * 1000; at += 100) {
    for (const { model: m } of [primary, supplemented]) m.observe(rotation('x', at * .08), at, 0, true);
    if (at % 4000) continue;
    const attemptId = at / 4000, caseIndex = attemptId % (options.cases ?? 7);
    const o = { attemptId, algorithm: `case-${caseIndex}`, at, measuredAt: at, spreadDeg: 1 };
    if (options.execution?.(caseIndex) ?? true) {
      for (const { model: m } of [primary, supplemented]) m.completeObservation({ ...o, phase: 'during',
        yawDeg: caseIndex * 17 - 140 + primaryRate * m.snapshot().motionDeg });
    }
    supplemented.model.completeObservation({ ...o, phase: 'start', fallback: true,
      yawDeg: caseIndex * 17 - 80 + startRate * supplemented.model.snapshot().motionDeg,
      ...(options.fragments ? { partial: true, sampleCount: 2, exposureMs: 100 } : {}) });
  }
  return { primary, supplemented };
}

describe('hardware-independent adaptive heading', () => {
  it.each([[.001, false], [-.001, false], [.001, true], [-.001, true]] as const)(
    'qualifies rate %s using quieter pairs after three case confirmations (previously learned %s)', (rate, learned) => {
    const { model: m, changes } = model();
    let held: ReturnType<typeof m.snapshot> | null = null;
    for (let at = 0; at <= 360_000; at += 100) {
      m.observe(rotation('x', at * .08), at, 0, true);
      if (learned && at <= 180_000 && at % 20_000 === 0) {
        m.completeObservation({ attemptId: at / 100, algorithm: 'earlier', phase: 'during', at, measuredAt: at,
          yawDeg: 25 + rate * m.snapshot().motionDeg, spreadDeg: 1 });
      }
      if (at === 300_000) {
        held = m.snapshot();
        expect(held).toMatchObject({ ready: false, holdReason: learned ? 'stale-evidence' : null });
      }
      if (at < 300_000 || at % 4000) continue;
      const index = (at - 300_000) / 4000 % 5;
      m.completeObservation({ attemptId: at / 100, algorithm: `resumed-${index}`, phase: 'during', at, measuredAt: at,
        yawDeg: index * 17 - 140 + rate * m.snapshot().motionDeg, spreadDeg: 1 });
      if (at <= 352_000) {
        expect(m.snapshot().ready).toBe(false);
        expect(m.snapshot().integratedDriftDeg).toBe(held!.integratedDriftDeg);
      }
      if (at === 352_000) {
        expect(m.snapshot().pairConfirmation.length).toBeGreaterThan(0);
        expect(m.snapshot().pairConfirmation.every(p => p.cases === 2)).toBe(true);
      }
    }
    const renewed = changes.find(e => e.kind === 'fit' && e.data.at >= 300_000)?.data;
    expect(renewed).toMatchObject({ at: 356_000, fittedCases: 5, fitPairSelection: 'precision',
      fittedRate: expect.closeTo(rate, 6) });
    expect(m.snapshot().ready).toBe(true);
    m.reset(360_100);
    expect(m.snapshot()).toMatchObject({ ready: false, pairConfirmation: [], fitPairSelection: null });
  });

  it('cannot renew a held rate through quieter pairs from only four independent cases', () => {
    const { model: m, changes } = model();
    for (let at = 0; at <= 360_000; at += 100) {
      m.observe(rotation('x', at * .08), at, 0, true);
      const earlier = at <= 180_000 && at % 20_000 === 0;
      if (!earlier && (at < 300_000 || at % 4000)) continue;
      const index = (at - 300_000) / 4000 % 4;
      m.completeObservation({ attemptId: at / 100, algorithm: earlier ? 'earlier' : `resumed-${index}`,
        phase: 'during', at, measuredAt: at, yawDeg: .001 * m.snapshot().motionDeg, spreadDeg: 1 });
    }
    expect(changes.some(e => e.kind === 'fit' && e.data.at >= 300_000)).toBe(false);
    expect(m.snapshot()).toMatchObject({ ready: false, holdReason: 'stale-evidence' });
  });

  it.each([.003, -.003])('learns signed drift %s from independent short windows after three confirming cases', rate => {
    const { m, changes, states } = widePractice((_, motion) => rate * motion, { fragments: true, until: 180 });
    expect(states.get(100)).toMatchObject({ rate: 0, observations: expect.any(Number) });
    expect(states.get(104)?.ready).toBe(false);
    const first = changes.find(e => e.kind === 'fit')!.data;
    expect(first.at).toBe(108_000);
    expect(first.fittedFragmentCases).toBeGreaterThanOrEqual(5);
    expect(m.snapshot()).toMatchObject({ ready: true, rate: expect.closeTo(rate, 6) });
    expect(changes.filter(e => e.kind === 'fit').length).toBeGreaterThan(1);
  });

  it('retains a short window as separate evidence without fitting a rate', () => {
    const { model: m } = model();
    m.observe(rotation('x', 25), 100, 0, true);
    m.completeObservation({ attemptId: 1, algorithm: 'R', phase: 'start', at: 100, measuredAt: 100,
      yawDeg: 12, spreadDeg: 1, partial: true, sampleCount: 2, exposureMs: 100 });
    expect(m.snapshot()).toMatchObject({ rate: 0, fragmentObservations: 1 });
  });

  it.each([
    {}, { sampleCount: 1, exposureMs: 200 }, { sampleCount: 2, exposureMs: 99 },
    { sampleCount: 2, exposureMs: Infinity }, { sampleCount: 2.5, exposureMs: 150 },
  ])('rejects fragments without valid minimum exposure: %j', fields => {
    const { model: m } = model();
    m.observe(rotation('x', 25), 100, 0, true);
    m.completeObservation({ attemptId: 1, algorithm: 'R', phase: 'finish', at: 100, measuredAt: 100,
      yawDeg: 12, spreadDeg: 1, partial: true, ...fields });
    expect(m.snapshot().observations).toBe(0);
  });

  it('cannot replace independent case evidence or confirmations with many short phases', () => {
    const weak = widePractice((_, motion) => .003 * motion, { cases: 4, phases: 8, fragments: true });
    expect(weak.m.snapshot()).toMatchObject({ rate: 0, appliedDeg: 0, landmarkProfiles: 0 });
    const repeated = widePractice((_, motion) => .003 * motion, { phases: 8, fragments: true, until: 104 });
    expect(repeated.changes.filter(e => e.kind === 'fit')).toHaveLength(0);
    expect(repeated.m.snapshot().fragmentConfirmation.every(p => p.cases <= 2)).toBe(true);
    repeated.m.reset(104_100);
    expect(repeated.m.snapshot()).toMatchObject({ fragmentConfirmation: [], fragmentObservations: 0 });
  });

  it.each([0, 60])('keeps short windows neutral with fixed case offsets and one %s° regrip', step => {
    const { m, changes } = widePractice((t, _, index) => index === 3 && t >= 84 ? step : 0, { fragments: true });
    expect(changes.some(e => e.kind === 'fit')).toBe(false);
    expect(m.snapshot()).toMatchObject({ rate: 0, appliedDeg: 0 });
  });

  it('holds a pooled forecast on fresh independent plateau evidence before the old evidence expires', () => {
    const { model: m, changes } = model();
    for (let at = 0; at <= 140_000; at += 100) {
      m.observe(rotation('x', at * .08), at, 0, true);
      if (at % 4000) continue;
      const attemptId = at / 4000, index = attemptId % 7;
      m.completeObservation({ attemptId, algorithm: `case-${index}`, phase: 'during', at, measuredAt: at,
        yawDeg: index * 17 - 140 + .3 * Math.min(at / 1000, 56), spreadDeg: 1 });
    }
    const held = changes.find(e => e.kind === 'held' && e.data.reason === 'recent-pooled-trend-changed')?.data;
    expect(held).toBeDefined();
    expect(held!.lastTrendHold.cases).toBeGreaterThanOrEqual(5);
    expect(held!.at - held!.evidenceAt).toBeLessThanOrEqual(GYRO_MOTION_THRESHOLDS.staleMs);
    expect(held!.ready).toBe(false);
    expect(held!.holdReason).toBe('recent-trend-changed');
    expect(m.snapshot().integratedDriftDeg).toBe(held!.integratedDriftDeg);
    expect(m.snapshot().rate).not.toBe(0);
    m.reset(421_000);
    expect(m.snapshot().lastTrendHold).toBeNull();
  });

  it('keeps conflicting short windows from replacing qualified full-window fits', () => {
    const { primary, supplemented } = startingGrips(.003, -.004, { fragments: true });
    const fits = (changes: typeof primary.changes) => changes.filter(e => e.kind === 'fit')
      .map(e => ({ at: e.data.at, basis: e.data.basis, rate: e.data.rate, heading: e.data.estimatedDriftDeg }));
    expect(fits(supplemented.changes)).toEqual(fits(primary.changes));
    expect(supplemented.model.snapshot().fittedFragmentCases).toBe(0);
  });

  it('does not treat one case regripping as a fresh independent contradiction', () => {
    const { m } = widePractice(t => .2 * t, { until: 240 });
    expect(m.snapshot().lastTrendHold).toBeNull();
    const changed = widePractice((t, _, index) => .2 * t + (index === 3 && t >= 252 ? -60 : 0));
    expect(changed.m.snapshot().lastTrendHold).toBeNull();
    expect(changed.m.snapshot().ready).toBe(true);
  });

  it('preserves qualified execution fits when starting grips show a conflicting trend', () => {
    const { primary, supplemented } = startingGrips(.003, -.004);
    const fits = (changes: typeof primary.changes) => changes.filter(e => e.kind === 'fit').map(({ data }) => ({
      at: data.at, basis: data.basis, rate: data.rate, heading: data.estimatedDriftDeg, cases: data.fittedCases,
    }));
    expect(fits(primary.changes).length).toBeGreaterThan(0);
    expect(fits(supplemented.changes)).toEqual(fits(primary.changes));
    expect(supplemented.model.snapshot().appliedDeg).toBe(primary.model.snapshot().appliedDeg);
  });

  it('does not turn a changing starting grip into drift when execution pairs stay flat', () => {
    const { primary, supplemented } = startingGrips(0, .004);
    expect(supplemented.changes.filter(e => e.kind === 'fit')).toHaveLength(0);
    expect(supplemented.model.snapshot()).toMatchObject({ rate: 0, appliedDeg: 0, status: 'learning' });
    expect(supplemented.model.snapshot().landmarkProfiles).toBe(primary.model.snapshot().landmarkProfiles);
  });

  it('uses starting grips to supply missing independent cases without lowering the fit threshold', () => {
    const { primary, supplemented } = startingGrips(.003, .003, { until: 80, execution: i => i < 3 });
    expect(primary.changes.filter(e => e.kind === 'fit')).toHaveLength(0);
    expect(supplemented.model.snapshot()).toMatchObject({ ready: true, fittedRate: expect.closeTo(.003, 6) });
    expect(supplemented.model.snapshot().fittedCases).toBeGreaterThanOrEqual(5);
  });

  it('requires five independent cases for supplementary starts even after many repetitions', () => {
    const { supplemented } = startingGrips(.003, .003, { cases: 4, execution: () => false });
    expect(supplemented.changes.filter(e => e.kind === 'fit')).toHaveLength(0);
    expect(supplemented.model.snapshot()).toMatchObject({ rate: 0, appliedDeg: 0, landmarkProfiles: 0 });
  });

  it('retains execution pairs when supplementary observations reach the history capacity', () => {
    const primary = model(), supplemented = model();
    for (let at = 0; at <= 39_000; at += 100) {
      for (const { model: m } of [primary, supplemented]) m.observe(rotation('x', at * .08), at, 0, true);
      const index = at >= 100 && at <= 24_000 ? at / 100 - 1
        : at >= 35_000 && at % 1000 === 0 ? 10 + (at - 35_000) / 1000 : null;
      if (index == null) continue;
      const o = { attemptId: at / 100, algorithm: `case-${index}`, at, measuredAt: at, spreadDeg: 1 };
      for (const { model: m } of [primary, supplemented]) m.completeObservation({ ...o, phase: 'during',
        yawDeg: .003 * m.snapshot().motionDeg });
      supplemented.model.completeObservation({ ...o, phase: 'start', fallback: true,
        yawDeg: 15 + .003 * supplemented.model.snapshot().motionDeg });
    }
    expect(primary.model.snapshot()).toMatchObject({ ready: true, fittedCases: 5 });
    expect(supplemented.model.snapshot()).toMatchObject({ ready: true, fittedCases: 5,
      observations: GYRO_MOTION_THRESHOLDS.maxObservations });
    expect(supplemented.model.snapshot().fittedRate).toBe(primary.model.snapshot().fittedRate);
  });

  it('starts neutral without a hardware report, preset direction, or historical drift gain', () => {
    const { model: m } = model();
    for (let i = 0; i <= 100; i++) m.observe(rotation('x', i * 10), i * 100, 0, true);
    expect(m.snapshot()).toMatchObject({ supported: true, ready: false, status: 'learning', rate: 0,
      estimatedDriftDeg: 0, appliedDeg: 0, motionDeg: expect.closeTo(1000, 4) });
  });

  it.each([0, .004, -.006, .012])('learns the current motion drift of %s without a vendor prior', rate => {
    const { model: m } = model(); train(m, rate);
    if (!rate) {
      expect(m.snapshot().appliedDeg).toBe(0);
      expect(m.snapshot().rate).toBe(0);
    } else {
      expect(m.snapshot()).toMatchObject({ ready: true, basis: 'motion', fittedRate: expect.closeTo(rate, 5) });
      expect(Math.sign(m.snapshot().appliedDeg)).toBe(Math.sign(rate));
      expect(m.snapshot().rate).toBeCloseTo(rate, 5);
    }
  });

  it.each([.2, -.15])('learns time drift of %s degrees/second even with no counted angular travel', rate => {
    const { model: m } = model(); train(m, rate, 'time');
    expect(m.snapshot()).toMatchObject({ ready: true, basis: 'time', motionDeg: 0,
      rateDegPerSecond: expect.closeTo(rate, 5) });
    expect(Math.sign(m.snapshot().appliedDeg)).toBe(Math.sign(rate));
  });

  it('does not infer motion from gaps, duplicate timestamps, invalid poses, or opposite quaternion signs', () => {
    const { model: m } = model();
    m.observe(rotation('x', 0), 0, 0, true);
    m.observe(rotation('x', 10), 100, 0, true);
    m.observe(rotation('x', 90), 100, 0, true);
    m.observe(rotation('x', 20), 200, 0, true);
    m.observe(rotation('x', 100), 1000, 0, true);
    m.observe(rotation('x', 110), 1100, 0, true);
    const q = rotation('x', 110);
    m.observe(new Quaternion(-q.x, -q.y, -q.z, -q.w), 1200, 0, true);
    m.observe(new Quaternion(NaN, 0, 0, 1), 1300, 0, true);
    expect(m.snapshot()).toMatchObject({ motionDeg: expect.closeTo(30, 5), elapsedSeconds: expect.closeTo(.4, 5), appliedDeg: 0 });
  });

  it('freezes an unsupported extrapolation and does not renew it through an unrelated case', () => {
    const { model: m } = model(); train(m, .004);
    const before = m.snapshot();
    for (let i = 1801; i <= 2400; i++) {
      m.observe(rotation('x', 7200 + (i - 1800) * 2), i * 100, 0, true);
      if (i % 100 === 0) m.completeObservation({ attemptId: i / 100, algorithm: `new-${i}`, phase: 'during',
        at: i * 100, measuredAt: i * 100, yawDeg: 100, spreadDeg: 1 });
    }
    expect(m.snapshot()).toMatchObject({ ready: false, status: 'held', evidenceAt: before.evidenceAt });
    const held = m.snapshot().estimatedDriftDeg;
    for (let i = 2401; i <= 2500; i++) m.observe(rotation('x', i * 2), i * 100, 0, true);
    expect(m.snapshot().estimatedDriftDeg).toBe(held);
  });

  it('keeps rate fitting observational until a packet applies a bounded correction and shares both phase budgets', () => {
    const { model: m, changes } = model();
    for (let i = 0; i <= 400; i++) {
      m.observe(rotation('x', i * 10), i * 100, 0, true);
      if (i % 100) continue;
      const s = m.snapshot(), o = { attemptId: i / 100, algorithm: 'R', at: i * 100,
        measuredAt: i * 100, spreadDeg: 1 };
      m.completeObservation({ ...o, phase: 'during', yawDeg: 30 + .005 * s.motionDeg });
      m.completeObservation({ ...o, phase: 'finish', yawDeg: 10 + .009 * s.motionDeg });
      if (i === 400) expect(m.snapshot().appliedDeg).toBe(s.appliedDeg);
    }
    const last = changes.filter(e => e.kind === 'fit' && e.data.attemptId === 4);
    expect(last.length).toBeGreaterThan(0);
    expect(last.reduce((s, e) => s + Math.abs(e.data.lastFit.revisionDeg) + Math.abs(e.data.lastFit.landmarkAdjustmentDeg), 0)).toBeLessThanOrEqual(.5);
    const before = m.snapshot().appliedDeg;
    m.observe(rotation('x', 4010), 40_100, 0, true);
    expect(Math.abs(m.snapshot().appliedDeg - before)).toBeLessThanOrEqual(.2 + 1e-8);
  });

  it('retains the display correction while disabled, catches up gradually, and clears learning on reset', () => {
    const { model: m } = model(); train(m, -.004);
    const before = m.snapshot();
    for (let i = 1801; i <= 1820; i++) m.observe(rotation('x', 7200 + (i - 1800) * 10), i * 100, 0, false);
    expect(m.snapshot().appliedDeg).toBe(before.appliedDeg);
    m.observe(rotation('x', 7410), 182_100, 0, true);
    expect(Math.abs(m.snapshot().appliedDeg - before.appliedDeg)).toBeLessThanOrEqual(.2 + 1e-8);
    m.reset(182_200);
    expect(m.snapshot()).toMatchObject({ supported: false, ready: false, rate: 0, appliedDeg: 0,
      integratedDriftDeg: 0, landmarkAdjustmentDeg: 0, historyRevisionDeg: 0, observations: 0 });
  });

  it('does not treat an arbitrary flat table heading as a yaw reference', () => {
    const e = new GyroDriftCorrector({ adaptiveHeading: true });
    const raw = rotation('y', 80).multiply(rotation('x', 6));
    for (let t = 0; t <= 2500; t += 20) e.update(raw, t);
    expect(gyroPoseMetrics(e.apply(raw))).toMatchObject({ yawDeg: expect.closeTo(80, 5), tiltDeg: expect.closeTo(0, 4) });
    expect(e.snapshot(2500).motionHeading?.appliedDeg).toBe(0);
  });

  it('uses no rendered heading in rate or landmark training and preserves existing compensation on ownership transfer', () => {
    const { model: a } = model(), { model: b } = model();
    a.synchronizeAppliedHeading(8);
    train(a, .004); train(b, .004);
    expect(a.snapshot().fittedRate).toBeCloseTo(b.snapshot().fittedRate!, 8);
    expect(a.snapshot().estimatedDriftDeg).toBeCloseTo(b.snapshot().estimatedDriftDeg, 8);
    const before = a.snapshot();
    a.synchronizeAppliedHeading(20);
    expect(a.snapshot()).toMatchObject({ estimatedDriftDeg: before.estimatedDriftDeg, rate: before.rate, appliedDeg: expect.closeTo(20, 8) });
  });

  it.each([20, -20])('does not turn a one-time %s degree regrip into a delayed drift rate', step => {
    const { states, changes } = scenario(t => t < 20 ? 0 : step);
    expect(changes.filter(e => e.kind === 'fit')).toHaveLength(0);
    for (const s of states.values()) expect(s).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
  });

  it.each([1, -1])('holds a contradicted rate and learns a sustained reversal (sign %s)', sign => {
    const { states } = scenario(t => sign * .2 * (t <= 180 ? t : 360 - t));
    expect(states.get(180)).toMatchObject({ ready: true, rate: expect.closeTo(sign * .0025, 6) });
    expect(states.get(220)).toMatchObject({ ready: false, holdReason: 'recent-trend-changed' });
    expect(states.get(240)?.integratedDriftDeg).toBe(states.get(220)?.integratedDriftDeg);
    expect(states.get(320)).toMatchObject({ ready: true, holdReason: null, rate: expect.closeTo(-sign * .0025, 6) });
  });

  it('stops extrapolating when repeated observations show the drift has stopped', () => {
    const { states } = scenario(t => .2 * Math.min(t, 180));
    expect(states.get(180)?.ready).toBe(true);
    expect(states.get(220)).toMatchObject({ ready: false, holdReason: 'recent-trend-changed' });
    expect(states.get(420)?.estimatedDriftDeg).toBe(states.get(220)?.estimatedDriftDeg);
  });

  it.each([1, -1])('relearns time-drift reversals without any angular-travel evidence (sign %s)', sign => {
    const { states } = scenario(t => sign * .2 * (t <= 180 ? t : 360 - t), { travel: () => 0 });
    expect(states.get(180)).toMatchObject({ basis: 'time', rate: expect.closeTo(sign * .2, 6) });
    expect(states.get(220)).toMatchObject({ ready: false, holdReason: 'recent-trend-changed' });
    expect(states.get(240)?.integratedDriftDeg).toBe(states.get(220)?.integratedDriftDeg);
    expect(states.get(330)).toMatchObject({ ready: true, rate: expect.closeTo(-sign * .2, 6) });
  });

  it('relearns a changed drift magnitude rather than preserving the old session majority', () => {
    const { states } = scenario(t => t <= 180 ? .2 * t : 36 + .35 * (t - 180));
    expect(states.get(180)).toMatchObject({ rate: expect.closeTo(.0025, 6) });
    expect(states.get(360)).toMatchObject({ ready: true, rate: expect.closeTo(.35 / 80, 6) });
  });

  it('changes time/motion basis without adding a second rate-history correction', () => {
    const { changes, states } = scenario(t => .2 * t, { travel: t => t <= 80 ? 80 * t : 6400 + 10 * (t - 80) });
    expect(states.get(70)?.basis).toBe('motion');
    expect(states.get(180)).toMatchObject({ basis: 'time', rate: expect.closeTo(.2, 6) });
    const fits = changes.filter(e => e.kind === 'fit');
    const switches = fits.filter((e, i) => i > 0 && e.data.basis !== fits[i - 1].data.basis);
    expect(switches.length).toBeGreaterThan(0);
    for (const { data } of switches) expect(data.lastFit).toMatchObject({ requestedRevisionDeg: 0, revisionDeg: 0 });
    const budgets = new Map<number, { rate: number; revision: number }>();
    for (const { data } of fits) {
      const budget = budgets.get(data.attemptId) ?? { rate: 0, revision: 0 };
      budget.rate += Math.abs(data.lastFit.rateChange) / (data.basis === 'time'
        ? GYRO_MOTION_THRESHOLDS.maxTimeRateChangePerAttempt : GYRO_MOTION_THRESHOLDS.maxMotionGainChangePerAttempt);
      budget.revision += Math.abs(data.lastFit.revisionDeg) + Math.abs(data.lastFit.landmarkAdjustmentDeg);
      budgets.set(data.attemptId, budget);
    }
    for (const b of budgets.values()) {
      expect(b.rate).toBeLessThanOrEqual(1 + 1e-8);
      expect(b.revision).toBeLessThanOrEqual(.5 + 1e-8);
    }
  });

  it.each([1, -1])('transfers a learned signed velocity on a basis switch instead of restarting from zero (sign %s)', sign => {
    const { changes } = scenario(t => sign * .2 * t, { travel: t => t <= 80 ? 80 * t : 6400 + 10 * (t - 80) });
    const fits = changes.filter(e => e.kind === 'fit');
    const switched = fits.find((e, i) => i > 0 && e.data.basis !== fits[i - 1].data.basis)!;
    expect(switched.data.basis).toBe('time');
    expect(Math.sign(switched.data.lastFit.previousRate)).toBe(sign);
    expect(Math.abs(switched.data.rate)).toBeGreaterThan(GYRO_MOTION_THRESHOLDS.maxTimeRateChangePerAttempt);
    expect(switched.data.lastFit).toMatchObject({ requestedRevisionDeg: 0, revisionDeg: 0 });
  });

  it('can switch to elapsed time after travel stops without inventing a conversion from zero exposure', () => {
    const { m, changes } = scenario(t => .2 * t, { travel: t => 80 * Math.min(t, 80), until: 180 });
    expect(m.snapshot()).toMatchObject({ ready: true, basis: 'time', rate: expect.closeTo(.2, 6) });
    expect(changes.filter(e => e.kind === 'fit').every(e => Number.isFinite(e.data.lastFit.previousRate))).toBe(true);
  });

  it.each([20, 100, 200])('learns the same trend at a %s ms received packet cadence', cadenceMs => {
    const { m } = scenario(t => .2 * t, { until: 180, cadenceMs });
    expect(m.snapshot()).toMatchObject({ ready: true, basis: 'motion', rate: expect.closeTo(.0025, 6) });
  });

  it.each([0, .005])('stays neutral for a stationary cube with noisy low time drift of %s degrees/second', rate => {
    const { model: m } = model();
    for (let i = 0; i <= 6000; i++) {
      const t = i / 10;
      m.observe(rotation('y', rate * t + .2 * Math.sin(t)), i * 100, 1000, true);
      if (i % 100) continue;
      m.completeObservation({ attemptId: i / 100, algorithm: 'R', phase: 'finish', at: i * 100,
        measuredAt: i * 100, yawDeg: 30 + rate * t + .5 * Math.sin(i / 100), spreadDeg: 1 });
    }
    expect(m.snapshot()).toMatchObject({ ready: false, motionDeg: 0, rate: 0, appliedDeg: 0 });
  });

  it('does not pool different case offsets into an apparent drift during rapid case changes', () => {
    const { model: m } = model();
    for (let i = 0; i <= 2400; i++) {
      m.observe(rotation('x', i * 8), i * 100, 0, true);
      if (i % 20) continue;
      const caseIndex = i / 20 % 3;
      m.completeObservation({ attemptId: i / 20, algorithm: ['R', 'U', 'F'][caseIndex], phase: 'during',
        at: i * 100, measuredAt: i * 100, yawDeg: [25, -40, 100][caseIndex], spreadDeg: 1 });
    }
    expect(m.snapshot()).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
  });

  it.each([.003, -.006])('learns motion drift of %s while cycling 21 cases without five recent repetitions per phase', rate => {
    const { m, changes, states } = widePractice((_, motion) => rate * motion);
    expect(states.get(120)).toMatchObject({ ready: true, fitEvidence: 'pooled-cases' });
    expect(m.snapshot()).toMatchObject({ ready: true, basis: 'motion', rate: expect.closeTo(rate, 6) });
    expect(Math.sign(m.snapshot().appliedDeg)).toBe(Math.sign(rate));
    expect(changes.filter(e => e.kind === 'fit').every(e => e.data.fitEvidence === 'pooled-cases')).toBe(true);
  });

  it.each([.2, -.15])('learns time drift of %s across a wide set despite changing movement cadence', rate => {
    const { m } = widePractice(t => rate * t);
    expect(m.snapshot()).toMatchObject({ ready: true, basis: 'time', rate: expect.closeTo(rate, 6), fitEvidence: 'pooled-cases' });
  });

  it('uses two independently supported sparse grips as a relative landmark before a third practice cycle', () => {
    const { changes } = widePractice(t => .2 * t, { until: 120 });
    const first = changes.find(e => e.kind === 'fit')!.data;
    expect(first.at).toBe(100_000);
    // This case first appeared at 16 s: its observed change is 16.8 degrees.
    // Its unknown initial grip and first 3.2 degrees of drift remain unanchored.
    expect(first.lastFit.landmarkTargetDeg).toBeCloseTo(16.8, 6);
    expect(first.lastFit).toMatchObject({ landmarkAdjustmentDeg: .5, revisionDeg: 0 });
    expect(first.lastFit.requestedRevisionDeg).toBeGreaterThan(.5);
  });

  it('spends the shared allowance toward a raw landmark instead of an opposing negative history revision', () => {
    const { changes } = widePractice(t => t <= 252 ? .2 * t : 50.4 + .12 * (t - 252), { until: 720 });
    const opposed = changes.filter(e => e.kind === 'fit' && e.data.lastFit.requestedRevisionDeg < -.01
      && e.data.lastFit.landmarkTargetDeg > e.data.estimatedDriftDeg);
    expect(opposed.length).toBeGreaterThan(0);
    for (const { data } of opposed) {
      expect(data.lastFit.revisionDeg).toBe(0);
      expect(data.lastFit.landmarkAdjustmentDeg).toBeGreaterThan(0);
    }
  });

  it('retains bounded history correction when a newly learned phase has no room for a landmark profile', () => {
    const { model: m, changes } = model();
    const initial = GYRO_MOTION_THRESHOLDS.maxProfiles * GYRO_MOTION_THRESHOLDS.baselineRepetitions;
    for (let i = 0; i < initial; i++) {
      m.observe(rotation('x', i * 8), i * 100, 0, true);
      m.completeObservation({ attemptId: i, algorithm: `early-${Math.floor(i / 3)}`, phase: 'during',
        at: i * 100, measuredAt: i * 100, yawDeg: 10, spreadDeg: 1 });
    }
    expect(m.snapshot().landmarkProfiles).toBe(GYRO_MOTION_THRESHOLDS.maxProfiles);
    for (let i = initial; i <= 800; i++) {
      m.observe(rotation('x', i * 8), i * 100, 0, true);
      if (i % 100) continue;
      m.completeObservation({ attemptId: i, algorithm: 'later-case', phase: 'during',
        at: i * 100, measuredAt: i * 100, yawDeg: 5 + .004 * m.snapshot().motionDeg, spreadDeg: 1 });
    }
    expect(m.snapshot()).toMatchObject({ ready: true, lastFit: { landmarkTargetDeg: null } });
    expect(m.snapshot().historyRevisionDeg).toBeGreaterThan(0);
    for (const { data } of changes.filter(e => e.kind === 'fit')) {
      expect(Math.abs(data.historyRevisionDeg)).toBeLessThanOrEqual(3);
      expect(Math.abs(data.lastFit.revisionDeg) + Math.abs(data.lastFit.landmarkAdjustmentDeg)).toBeLessThanOrEqual(.5);
    }
  });

  it.each([60, -60])('keeps one case\'s %s degree regrip from dragging the pooled landmarks', step => {
    const control = widePractice((_, motion) => .003 * motion);
    const changed = widePractice((t, motion, index) => .003 * motion + (t >= 252 && index === 3 ? step : 0));
    expect(changed.m.snapshot().fittedRate).toBeCloseTo(.003, 6);
    expect(Math.abs(changed.m.snapshot().estimatedDriftDeg - control.m.snapshot().estimatedDriftDeg)).toBeLessThanOrEqual(1.5);
  });

  it.each([8, 12])('learns across 21 cases repeated every %s seconds without requiring a two-minute cycle', intervalSeconds => {
    const { m, changes } = widePractice(t => -.15 * t, { intervalSeconds, until: 720 });
    const final = m.snapshot();
    expect(final).toMatchObject({ ready: true, fitEvidence: 'pooled-cases', fitPairSpanMs: 21 * intervalSeconds * 1000 });
    expect(final.rate * (final.basis === 'motion' ? 20 : 1)).toBeCloseTo(-.15, 6);
    expect(changes.filter(e => e.kind === 'fit').length).toBeGreaterThan(0);
  });

  it.each([.8, -.8])('rejects long heading pairs that could hide a full turn at %s degrees/second', rate => {
    const { m, changes } = widePractice(t => rate * t, { intervalSeconds: 16, until: 800 });
    expect(m.snapshot()).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
    expect(changes.filter(e => e.kind === 'fit')).toHaveLength(0);
  });

  it.each([0, 60, -60])('keeps 21 different grip offsets neutral with a one-case regrip of %s degrees', step => {
    const { m, changes } = widePractice((t, _, index) => .2 * Math.sin(t) + (index === 3 && t >= 84 ? step : 0));
    expect(m.snapshot()).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
    expect(changes.filter(e => e.kind === 'fit')).toHaveLength(0);
  });

  it('counts algorithms rather than their during/finish phases for sparse evidence and shared allowances', () => {
    const weak = widePractice(t => .2 * t, { cases: 4, phases: 8, intervalSeconds: 12, until: 140 });
    expect(weak.m.snapshot()).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
    const { changes } = widePractice(t => .2 * t, { phases: 2 });
    const budgets = new Map<number, { rate: number; revision: number }>();
    for (const { data } of changes.filter(e => e.kind === 'fit')) {
      const b = budgets.get(data.attemptId) ?? { rate: 0, revision: 0 };
      b.rate += Math.abs(data.lastFit.rateChange) / (data.basis === 'time'
        ? GYRO_MOTION_THRESHOLDS.maxTimeRateChangePerAttempt : GYRO_MOTION_THRESHOLDS.maxMotionGainChangePerAttempt);
      b.revision += Math.abs(data.lastFit.revisionDeg) + Math.abs(data.lastFit.landmarkAdjustmentDeg);
      budgets.set(data.attemptId, b);
      expect(Math.abs(data.historyRevisionDeg)).toBeLessThanOrEqual(3 + 1e-8);
    }
    expect(budgets.size).toBeGreaterThan(0);
    for (const b of budgets.values()) {
      expect(b.rate).toBeLessThanOrEqual(1 + 1e-8);
      expect(b.revision).toBeLessThanOrEqual(.5 + 1e-8);
    }
  });

  it.each([4, 8, 12])('expires sparse evidence at 45 seconds even when executions are %s seconds apart', intervalSeconds => {
    const { m } = widePractice((_, motion) => .003 * motion, { intervalSeconds, until: 720 });
    const evidenceAt = m.snapshot().evidenceAt;
    expect(m.snapshot().ready).toBe(true);
    for (let at = 720_100; at <= 780_000; at += 100) {
      m.observe(rotation('x', 25_200 + (at - 720_000) * .02), at, 0, true);
      if (at % 4000) continue;
      m.completeObservation({ attemptId: at / 4000, algorithm: `unseen-${at}`, phase: 'phase-0', at, measuredAt: at,
        yawDeg: 80, spreadDeg: 1 });
    }
    expect(m.snapshot()).toMatchObject({ ready: false, holdReason: 'stale-evidence', evidenceAt });
    const held = m.snapshot().estimatedDriftDeg;
    for (let at = 780_100; at <= 800_000; at += 100) m.observe(rotation('x', at * .02), at, 0, true);
    expect(m.snapshot().estimatedDriftDeg).toBe(held);
  });

  it('does not count a minority of agreeing phases as agreement from their entire algorithm', () => {
    const { m, changes } = widePractice((_, motion, __, phase) => (phase ? -.003 : .003) * motion, { phases: 2 });
    expect(m.snapshot()).toMatchObject({ ready: false, rate: 0, appliedDeg: 0 });
    expect(changes.filter(e => e.kind === 'fit')).toHaveLength(0);
  });

  it('relearns a reversed drift across 21 cases and waits for the supported rate direction', () => {
    const { m, changes, states } = widePractice(t => .2 * (t <= 252 ? t : 504 - t), { until: 600 });
    expect(states.get(240)?.ready).toBe(true);
    // After the cadence settles, both exposure bases describe the same rate.
    const final = m.snapshot();
    expect(final.ready).toBe(true);
    expect(final.rate * (final.basis === 'motion' ? 20 : 1)).toBeCloseTo(-.2, 6);
    const transitions = changes.filter(e => e.kind === 'fit' && e.data.rate * e.data.fittedRate <= 0);
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.every(e => e.data.ready === false)).toBe(true);
  });

  it('does not keep extrapolating a shared regrip once sparse cases repeat on a plateau', () => {
    const { states } = widePractice(t => t < 84 ? 0 : 20);
    expect(states.get(252)).toMatchObject({ ready: false, holdReason: 'stale-evidence' });
    expect(states.get(420)?.estimatedDriftDeg).toBe(states.get(252)?.estimatedDriftDeg);
  });

  it.each([20, -20])('does not revive old cross-step evidence after a long-cycle %s degree regrip', step => {
    const { states } = widePractice(t => t < 252 ? 0 : step, { intervalSeconds: 12, until: 1104 });
    expect(states.get(600)).toMatchObject({ ready: false, holdReason: 'stale-evidence' });
    expect(states.get(1104)?.estimatedDriftDeg).toBe(states.get(600)?.estimatedDriftDeg);
  });

  it.each([1, -1])('relearns a reversal across repeat intervals longer than two minutes (sign %s)', sign => {
    const { m, states } = widePractice(t => sign * .2 * (t <= 504 ? t : 1008 - t), { intervalSeconds: 8, until: 1104 });
    expect(states.get(496)?.ready).toBe(true);
    expect([...states].some(([t, s]) => t > 504 && !s.ready)).toBe(true);
    const final = m.snapshot();
    expect(final.ready).toBe(true);
    expect(final.rate * (final.basis === 'motion' ? 20 : 1)).toBeCloseTo(-sign * .2, 6);
  });

  it('rejects future observations and delayed older attempts without reopening their budgets', () => {
    const { model: m } = model(); train(m, .004);
    const before = m.snapshot();
    const o = { algorithm: 'R', phase: 'finish', spreadDeg: 1, yawDeg: 160 };
    m.completeObservation({ ...o, attemptId: 1, at: 180_000, measuredAt: 180_000 });
    m.completeObservation({ ...o, attemptId: 19, at: 181_000, measuredAt: 181_000 });
    m.completeObservation({ ...o, attemptId: 20, at: 179_000, measuredAt: 180_000 });
    expect(m.snapshot()).toEqual(before);
  });

  it('reports expired evidence during a silent pause without changing the learner or extrapolating the gap', () => {
    const { model: m } = model(); train(m, .004);
    const before = m.snapshot();
    expect(m.snapshot(300_000)).toMatchObject({ ready: false, holdReason: 'stale-evidence',
      estimatedDriftDeg: before.estimatedDriftDeg, appliedDeg: before.appliedDeg });
    expect(m.snapshot()).toEqual(before);
    m.observe(rotation('x', 9000), 300_000, 0, true);
    expect(m.snapshot()).toMatchObject({ ready: false, elapsedSeconds: before.elapsedSeconds,
      motionDeg: before.motionDeg, integratedDriftDeg: before.integratedDriftDeg });
  });

  it('reports stale evidence after a direction transition expires, without finishing its rate slew', () => {
    const { changes } = widePractice(t => .2 * (t <= 252 ? t : 504 - t), { until: 600 });
    const transition = changes.find(e => e.kind === 'fit' && e.data.rate * e.data.fittedRate <= 0)!;
    expect(transition.data.holdReason).toBe('rate-transition');
    const { model: m } = model();
    // Stop input at the first live reversal, then poll across its expiry.
    for (let at = 0; at <= transition.data.at; at += 100) {
      const t = at / 1000;
      m.observe(rotation('x', t <= 180 ? 80 * t : 14400 + 20 * (t - 180)), at, 0, true);
      if (at % 4000) continue;
      const id = at / 4000, index = id % 21;
      m.completeObservation({ attemptId: id, algorithm: `case-${index}`, phase: 'phase-0', at, measuredAt: at,
        yawDeg: index * 17 - 170 + .2 * (t <= 252 ? t : 504 - t), spreadDeg: 1 });
    }
    const before = m.snapshot();
    expect(before.holdReason).toBe('rate-transition');
    expect(m.snapshot(before.evidenceAt! + 45_001)).toMatchObject({ holdReason: 'stale-evidence', rate: before.rate,
      integratedDriftDeg: before.integratedDriftDeg, appliedDeg: before.appliedDeg });
    expect(m.snapshot()).toEqual(before);
  });

  it.each([1, -1])('repairs held heading from independent landmarks without assuming zero future drift (sign %s)', sign => {
    const { m, changes, states } = widePractice(t => sign * (t <= 252 ? .2 * t : 20), { until: 900 });
    const recoveries = changes.filter(e => e.kind === 'recovery');
    expect(recoveries.length).toBeGreaterThan(0);
    expect(m.snapshot().ready).toBe(false);
    const finalFit = changes.filter(e => e.kind === 'fit').at(-1)!.data;
    expect(m.snapshot().evidenceAt).toBe(finalFit.evidenceAt);
    const firstLate = [...states].find(([t]) => t > finalFit.at / 1000 + 46)![1];
    expect(m.snapshot().integratedDriftDeg).toBe(firstLate.integratedDriftDeg);
    for (const { data } of recoveries) {
      expect(data.ready).toBe(false);
      expect(data.lastRecovery.cases).toBeGreaterThanOrEqual(5);
      expect(Math.abs(data.lastRecovery.adjustmentDeg)).toBeLessThanOrEqual(.5);
    }
    expect(sign * m.snapshot().landmarkAdjustmentDeg).toBeLessThan(sign * firstLate.landmarkAdjustmentDeg);
  });

  it('does not use many phases of a single changed grip as independent heading recovery', () => {
    const { m, changes } = widePractice(t => t <= 252 ? .2 * t : 20, { cases: 1, phases: 8, until: 900 });
    expect(changes.filter(e => e.kind === 'fit').length).toBeGreaterThan(0);
    expect(changes.filter(e => e.kind === 'recovery')).toHaveLength(0);
    expect(m.snapshot().lastRecovery).toBeNull();
  });

  it('requires the current case to agree with independent recovery and shares the heading allowance across phases', () => {
    const drift = (t: number) => t <= 252 ? .2 * t : 20;
    const changed = widePractice((t, _, index) => drift(t) + (t > 252 && index === 3 ? 60 : 0), { phases: 2, until: 720 });
    expect(changed.changes.some(e => e.kind === 'recovery')).toBe(true);
    const recoveries = changed.changes.filter(e => e.kind === 'recovery' && e.data.at > 252_000);
    expect(recoveries.every(e => e.data.attemptId % 21 !== 3)).toBe(true);
    expect(recoveries.every(e => e.data.lastRecovery.adjustmentDeg < 0)).toBe(true);
    const budgets = new Map<number, number>();
    for (const { kind, data } of changed.changes) {
      if (!['fit', 'recovery'].includes(kind)) continue;
      const spent = kind === 'fit'
        ? Math.abs(data.lastFit.revisionDeg) + Math.abs(data.lastFit.landmarkAdjustmentDeg)
        : Math.abs(data.lastRecovery.adjustmentDeg);
      budgets.set(data.attemptId, (budgets.get(data.attemptId) ?? 0) + spent);
    }
    for (const spent of budgets.values()) expect(spent).toBeLessThanOrEqual(.5 + 1e-8);
  });

  it('fits noisy headings consistently across the signed angle boundary', () => {
    const wrap = (yaw: number) => ((yaw + 180) % 360 + 360) % 360 - 180;
    const a = scenario(t => 20 + .2 * t + .3 * Math.sin(t), { until: 180 });
    const b = scenario(t => wrap(179.9 + .2 * t + .3 * Math.sin(t)), { until: 180 });
    expect(a.m.snapshot().ready).toBe(true);
    expect(b.m.snapshot().ready).toBe(true);
    expect(b.m.snapshot().rate).toBeCloseTo(a.m.snapshot().rate, 7);
    expect(b.m.snapshot().estimatedDriftDeg).toBeCloseTo(a.m.snapshot().estimatedDriftDeg, 7);
  });
});
