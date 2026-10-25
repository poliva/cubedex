import { describe, expect, it } from 'vitest';
import { trackMotionChanges } from '../helpers/gyro-motion';
import { Quaternion, Vector3 } from 'three';
import { GyroHomeGripObserver } from '../../src/lib/gyro-home-grip';
import { GyroMotionDriftEstimator } from '../../src/lib/gyro-motion-drift';
import { GyroDriftCorrector } from '../../src/lib/gyro-drift';

const turn = (axis: 'x' | 'y', degrees: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, 0), degrees * Math.PI / 180);
const hand = (yaw: number, at: number, tilt = 15) => turn('y', yaw).multiply(turn('x', tilt + .5 * Math.sin(at / 150)));
const quickHand = (yaw: number, at: number) => turn('y', yaw).multiply(turn('x', 25 + .6 * Math.sin(at * Math.PI / 200)));

describe('home holding observations', () => {
  it.each([50, 60, 90, 100])('accepts a strong short hand window at %i ms packet cadence without a forced pause', cadence => {
    const collector = new GyroHomeGripObserver();
    collector.observe(quickHand(12, -cadence), quickHand(12, -cadence), -cadence, 1, null);
    let result = null;
    for (let at = 0; at <= 500 && !result; at += cadence) result = collector.observe(quickHand(12, at), quickHand(12, at), at, 1, null);
    expect(result).not.toBeNull();
    expect(result!.exposureMs).toBeGreaterThanOrEqual(200);
    expect(result!.exposureMs).toBeLessThanOrEqual(300);
    expect(result!.sampleCount).toBeGreaterThanOrEqual(4);
    expect(result!.yawDeg).toBeCloseTo(12, 8);
  });

  it('accepts a nearly level moving hand and measures raw yaw beyond the displayed gate', () => {
    const collector = new GyroHomeGripObserver();
    let observation;
    for (let at = 0; at <= 1600; at += 100) {
      observation ??= collector.observe(hand(70, at, 0), hand(20, at, 0), at, 1, null);
    }
    expect(observation).toMatchObject({ attemptId: 1, yawDeg: 70 });
    expect(collector.snapshot().observations).toBe(1);
  });

  it.each([0, 20, 50])('does not infer heading from a stationary rest tilted %i degrees', tilt => {
    const collector = new GyroHomeGripObserver();
    const q = turn('y', 25).multiply(turn('x', tilt));
    for (let at = 0; at <= 5000; at += 100) expect(collector.observe(q, q, at, 1, null)).toBeNull();
    expect(collector.snapshot()).toMatchObject({ observations: 0, reason: 'resting-or-uncertain' });
  });

  it.each(['algorithm-active', 'guidance-active', 'unknown-reference-frame', 'execution-transition'])('excludes %s', reason => {
    const collector = new GyroHomeGripObserver();
    for (let at = 0; at <= 2000; at += 100) collector.observe(hand(12, at), hand(12, at), at, 1, reason);
    expect(collector.snapshot()).toMatchObject({ observations: 0, reason });
  });

  it('rejects deliberate sideways holds and pickups, then requires a fresh settled window', () => {
    const collector = new GyroHomeGripObserver();
    for (let at = 0; at <= 1000; at += 100) collector.observe(hand(90, at), hand(90, at), at, 1, null);
    expect(collector.snapshot().reason).toBe('outside-displayed-home-heading');
    collector.observe(hand(15, 1100), hand(15, 1100), 1100, 1, null);
    expect(collector.snapshot().reason).toBe('pickup-or-rotation');
    for (let at = 1200; at <= 1300; at += 100) expect(collector.observe(hand(15, at), hand(15, at), at, 1, null)).toBeNull();
    for (let at = 1400; at <= 2000; at += 100) collector.observe(hand(15, at), hand(15, at), at, 1, null);
    expect(collector.snapshot().observations).toBe(1);
  });

  it('does not create extra votes from one hold, a repeated ready event, or a long pause', () => {
    const collector = new GyroHomeGripObserver();
    for (let at = 0; at <= 50_000; at += 100) collector.observe(hand(12, at), hand(12, at), at, 7, null);
    expect(collector.snapshot().observations).toBe(1);
    for (let at = 50_100; at <= 51_000; at += 100) collector.observe(hand(12, at), hand(12, at), at, 8, null);
    expect(collector.snapshot().observations).toBe(2);
    collector.reset();
    expect(collector.snapshot()).toMatchObject({ observations: 0, lastObservation: null });
  });

  it('improves a provisional window without adding votes, then closes it after delivery', () => {
    const collector = new GyroHomeGripObserver();
    const windows = [];
    for (let at = 0; at <= 1000; at += 100) {
      const o = collector.observe(quickHand(12, at), quickHand(12, at), at, 1, null);
      if (o) windows.push(o);
    }
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0].exposureMs).toBeLessThan(600);
    expect(windows.at(-1)!.exposureMs).toBeGreaterThanOrEqual(600);
    expect(collector.snapshot().observations).toBe(1);
    collector.closeEpisode(1);
    for (let at = 1100; at <= 2000; at += 100) expect(collector.observe(quickHand(12, at), quickHand(12, at), at, 1, null)).toBeNull();
    expect(collector.snapshot().observations).toBe(1);
  });

  it('does not classify a put-down transient followed by stillness as sustained hand motion', () => {
    const collector = new GyroHomeGripObserver();
    for (let at = 0; at <= 2500; at += 100) {
      const q = turn('y', 20).multiply(turn('x', at < 400 ? 2 - at / 200 : 0));
      collector.observe(q, q, at, 1, null);
    }
    expect(collector.snapshot().observations).toBe(0);
  });

  it('does not mistake drift in a resting sensor or a smooth inspection rotation for hand tremor', () => {
    const collector = new GyroHomeGripObserver();
    for (let at = 0; at <= 20_000; at += 100) {
      const raw = turn('y', at * .001);
      collector.observe(raw, raw, at, Math.floor(at / 5000) + 1, null);
    }
    expect(collector.snapshot().observations).toBe(0);
    expect(collector.snapshot().reason).toBe('resting-or-smooth-motion');
  });
});

function homeLearning(sign: number, drifting = false) {
  const { model, changes } = trackMotionChanges();
  for (let at = 0; at <= (drifting ? 85_000 : 65_000); at += 100) {
    model.observe(hand(sign * (12 + (drifting ? at * .0001 : 0)), at), at, 0, true);
    if (at >= 10_000 && at % 10_000 === 0) model.completeHomeObservation({ attemptId: at / 10_000,
      at, measuredAt: at, yawDeg: sign * (12 + (drifting ? at * .0001 : 0)), spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
  }
  return { model, changes };
}

describe('home heading learning', () => {
  it.each([-1, 1])('learns fast %i drift without absolute-angle consensus or a startup heading jump', sign => {
    const { model, changes } = trackMotionChanges();
    for (let at = 0; at <= 75_000; at += 100) {
      model.observe(hand(sign * at * .0005, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0) model.completeHomeObservation({ attemptId: at / 10_000,
        at, measuredAt: at, yawDeg: sign * at * .0005, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
      if (at === 50_000 || at === 60_000) {
        expect(model.snapshot()).toMatchObject({ rateReady: false, homeGrip: { evidenceAt: null,
          rateConfirmation: [expect.objectContaining({ basis: 'time', episodes: at / 10_000 - 4 })] } });
      }
    }
    const fits = changes.filter(e => e.kind === 'fit');
    expect(fits).toHaveLength(1);
    expect(fits[0].data).toMatchObject({ at: 70_000, basis: 'time', fittedRate: expect.closeTo(sign * .5, 8),
      lastFit: { rateChange: sign * .05, landmarkTargetDeg: null, revisionDeg: 0, landmarkAdjustmentDeg: 0 } });
    expect(model.snapshot()).toMatchObject({ rateReady: true, headingEvidence: null,
      homeGrip: { evidenceAt: null, lastAdjustment: null }, historyRevisionDeg: 0, landmarkAdjustmentDeg: 0 });
    expect(model.snapshot().integratedDriftDeg).toBeCloseTo(sign * .25, 8);
    expect(changes.filter(e => e.kind === 'home-adjustment')).toHaveLength(0);
  });

  it.each([0, .005, -.005])('does not invent a rate from %s degrees/second of insignificant home change', rate => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 90_000; at += 100) {
      model.observe(hand(12 + at * rate / 1000, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0) model.completeHomeObservation({ attemptId: at / 10_000,
        at, measuredAt: at, yawDeg: 12 + at * rate / 1000, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
    }
    expect(model.snapshot()).toMatchObject({ rateReady: false, rate: 0, integratedDriftDeg: 0,
      homeGrip: { ready: true, rateConfirmation: [] } });
  });

  it('keeps a confirmed home rate ahead of algorithm fits without requiring absolute-angle support', () => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 70_000; at += 100) {
      model.observe(hand(at * .0005, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0) {
        const o = { attemptId: at / 10_000, at, measuredAt: at, yawDeg: at * .0005,
          spreadDeg: .5, sampleCount: 8, exposureMs: 700 };
        model.completeHomeObservation(o);
        if (at <= 40_000) model.completeObservation({ ...o, algorithm: 'R U', phase: 'during' });
      }
    }
    const before = model.snapshot();
    expect(before).toMatchObject({ rateReady: true, headingEvidence: null, fitEvidence: 'home-grip' });
    model.completeObservation({ attemptId: 8, at: 70_000, measuredAt: 70_000, yawDeg: 35,
      spreadDeg: .5, algorithm: 'R U', phase: 'during' });
    expect(model.snapshot()).toMatchObject({ fitAt: before.fitAt, rate: before.rate,
      fitEvidence: 'home-grip', observations: 5 });
  });

  it('requires the newest endpoint to agree with the trend, tolerating earlier isolated regrips', () => {
    const { model, changes } = trackMotionChanges();
    for (let at = 0; at <= 120_000; at += 100) {
      const yawDeg = at * .0005 + (at === 30_000 || at === 60_000 ? 35 : 0);
      model.observe(hand(yawDeg, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0) model.completeHomeObservation({ attemptId: at / 10_000,
        at, measuredAt: at, yawDeg, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
      if (at === 60_000) expect(model.snapshot().homeGrip.rateConfirmation.every(p => p.episodes < 2)).toBe(true);
    }
    const fits = changes.filter(e => e.kind === 'fit');
    expect(fits.length).toBeGreaterThan(0);
    expect(fits[0].data.at).toBeGreaterThanOrEqual(80_000);
    expect(model.snapshot().fittedRate).toBeCloseTo(.5, 8);
  });

  it('rejects inconsistent regrips even when their raw endpoints contain large changes', () => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 120_000; at += 100) {
      const yawDeg = Math.floor(at / 10_000) % 2 ? 35 : -35;
      model.observe(hand(yawDeg, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0) model.completeHomeObservation({ attemptId: at / 10_000,
        at, measuredAt: at, yawDeg, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
    }
    expect(model.snapshot()).toMatchObject({ rateReady: false, integratedDriftDeg: 0, homeGrip: { rateConfirmation: [] } });
  });

  it('expires old support across a pause and independently confirms a reversed trend', () => {
    const { model, changes } = trackMotionChanges();
    let heldIntegration = 0;
    for (let at = 0; at <= 310_000; at += 100) {
      const yawDeg = at < 200_000 ? at * .0005 : -(at - 200_000) * .0005;
      model.observe(hand(yawDeg, at), at, 0, true);
      if (at > 0 && at % 10_000 === 0 && (at <= 70_000 || at >= 210_000)) {
        model.completeHomeObservation({ attemptId: at / 10_000,
          at, measuredAt: at, yawDeg, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
      }
      if (at === 120_000) heldIntegration = model.snapshot().integratedDriftDeg;
      if (at === 200_000 || at === 260_000 || at === 280_000) {
        expect(model.snapshot().rateReady).toBe(false);
        expect(model.snapshot().integratedDriftDeg).toBe(heldIntegration);
      }
    }
    const reverse = changes.filter(e => e.kind === 'fit' && e.data.fittedRate < 0);
    expect(reverse[0].data.at).toBe(270_000);
    expect(model.snapshot().integratedDriftDeg).toBeLessThan(heldIntegration);
    expect(model.snapshot().rate).toBeLessThan(0);
  });

  it('does not count tiny windows as full rate evidence or short spans as slope exposure', () => {
    for (const [intervalMs, exposureMs] of [[10_000, 200], [2000, 700]]) {
      const model = new GyroMotionDriftEstimator();
      for (let at = 0; at <= intervalMs * 8; at += 100) {
        model.observe(hand(at * .0005, at), at, 0, true);
        if (at > 0 && at % intervalMs === 0) model.completeHomeObservation({ attemptId: at / intervalMs,
          at, measuredAt: at, yawDeg: at * .0005, spreadDeg: .5, sampleCount: 4, exposureMs });
      }
      expect(model.snapshot()).toMatchObject({ rateReady: false, integratedDriftDeg: 0 });
    }
  });

  it.each([-1, 1])('uses independent holding episodes for signed offset %i without inventing a rate', sign => {
    const { model, changes } = homeLearning(sign);
    expect(changes.filter(e => e.kind === 'home-adjustment')[0].data.at).toBe(30_000);
    expect(model.snapshot()).toMatchObject({ ready: true, rateReady: false, headingEvidence: 'home-grip', rate: 0 });
    expect(model.snapshot().landmarkAdjustmentDeg).toBe(sign * 2);
    expect(model.snapshot().appliedDeg).toBeCloseTo(sign * 2);
    model.observe(hand(sign * 12, 110_000), 110_000, 0, true);
    expect(model.snapshot()).toMatchObject({ status: 'held', holdReason: 'stale-evidence', integratedDriftDeg: 0 });
  });

  it.each([-1, 1])('can learn a signed rate %i from five home episodes with the original shared budgets', sign => {
    const { model, changes } = homeLearning(sign, true);
    const fits = changes.filter(e => e.kind === 'fit');
    expect(fits.length).toBeGreaterThan(0);
    expect(fits[0].data).toMatchObject({ fitEvidence: 'home-grip', basis: 'time' });
    expect(fits[0].data.at).toBeGreaterThanOrEqual(70_000);
    expect(model.snapshot().rate * sign).toBeGreaterThan(0);
    for (const e of fits) {
      expect(Math.abs(e.data.lastFit.rateChange)).toBeLessThanOrEqual(.05 + 1e-8);
      expect(Math.abs(e.data.lastFit.landmarkAdjustmentDeg) + Math.abs(e.data.lastFit.revisionDeg)).toBeLessThanOrEqual(.5);
    }
    const before = model.snapshot().estimatedDriftDeg;
    model.completeHomeObservation({ attemptId: 8, at: 85_000, measuredAt: 85_000, yawDeg: sign * 30, spreadDeg: 0, sampleCount: 8, exposureMs: 700 });
    expect(model.snapshot().estimatedDriftDeg).toBe(before);
  });

  it('requires three distinct, current agreeing episodes and clears them on reset', () => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 20_000; at += 100) {
      model.observe(hand(12, at), at, 0, true);
      if (at % 1000 === 0) model.completeHomeObservation({ attemptId: 1, at, measuredAt: at,
        yawDeg: 12, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
    }
    expect(model.snapshot()).toMatchObject({ ready: false, appliedDeg: 0, homeGrip: { episodes: 1 } });
    model.reset(20_000);
    expect(model.snapshot().homeGrip).toMatchObject({ episodes: 0, evidenceAt: null, lastAdjustment: null });
  });

  it('does not turn three brief holds into three full-quality confirmations', () => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 45_000; at += 100) {
      model.observe(hand(12, at), at, 0, true);
      if (at > 0 && at % 5000 === 0) {
        model.completeHomeObservation({ at, measuredAt: at, attemptId: at / 5000,
          yawDeg: 12, spreadDeg: .5, sampleCount: 4, exposureMs: 200 });
        if (at < 45_000) expect(model.snapshot().landmarkAdjustmentDeg).toBe(0);
      }
    }
    expect(model.snapshot().homeGrip.episodes).toBe(9);
    expect(model.snapshot().landmarkAdjustmentDeg).toBe(.5);
  });

  it('rejects inconsistent returns and does not let one new hold revive an old cohort after a pause', () => {
    const model = new GyroMotionDriftEstimator();
    for (let at = 0; at <= 160_000; at += 100) {
      model.observe(hand(12, at), at, 0, true);
      if ([10_000, 20_000, 30_000, 160_000].includes(at)) model.completeHomeObservation({ attemptId: at / 10_000,
        at, measuredAt: at, yawDeg: at === 20_000 ? -20 : 12, spreadDeg: .5, sampleCount: 8, exposureMs: 700 });
    }
    expect(model.snapshot()).toMatchObject({ ready: false, appliedDeg: 0, integratedDriftDeg: 0 });
  });

  it('shares one heading and rate allowance between home observations and algorithm phases', () => {
    const { model, changes } = trackMotionChanges();
    for (let at = 0; at <= 85_000; at += 100) {
      model.observe(hand(12 + at * .0001, at), at, 0, true);
      if (at >= 10_000 && at % 10_000 === 0) {
        const observation = { attemptId: at / 10_000, at, measuredAt: at, yawDeg: 12 + at * .0001,
          spreadDeg: .5, sampleCount: 8, exposureMs: 700 };
        model.completeHomeObservation(observation);
        model.completeObservation({ ...observation, algorithm: 'R U', phase: 'during' });
        model.completeObservation({ ...observation, algorithm: 'R U', phase: 'finish' });
      }
    }
    const budgets = new Map<number, { heading: number; rate: number; kinds: Set<string> }>();
    for (const e of changes.filter(e => ['fit', 'home-adjustment', 'recovery'].includes(e.kind))) {
      const b = budgets.get(e.data.attemptId) ?? { heading: 0, rate: 0, kinds: new Set<string>() };
      b.kinds.add(e.kind);
      if (e.kind === 'fit') {
        b.heading += Math.abs(e.data.lastFit.revisionDeg) + Math.abs(e.data.lastFit.landmarkAdjustmentDeg);
        b.rate += Math.abs(e.data.lastFit.rateChange) / (e.data.lastFit.basis === 'time' ? .05 : .001);
      } else b.heading += Math.abs(e.kind === 'home-adjustment'
        ? e.data.homeGrip.lastAdjustment.adjustmentDeg : e.data.lastRecovery.adjustmentDeg);
      budgets.set(e.data.attemptId, b);
    }
    expect([...budgets.values()].some(b => b.kinds.has('fit') && b.kinds.has('home-adjustment'))).toBe(true);
    for (const b of budgets.values()) {
      expect(b.heading).toBeLessThanOrEqual(.5 + 1e-8);
      expect(b.rate).toBeLessThanOrEqual(1 + 1e-8);
    }
  });
});

describe('home collector integration', () => {
  it.each(['reset', 'guidance', 'changed-frame', 'unknown-frame'] as const)('discards a provisional hold on %s without teaching the learner', action => {
    const engine = new GyroDriftCorrector({ adaptiveHeading: true });
    engine.setTableFrame(new Quaternion(), 0);
    engine.reset('manual-reset', 0);
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R U', null, 1);
    for (let at = 100; at <= 500; at += 100) engine.update(quickHand(12, at), at);
    expect(engine.snapshot(500).homeGrip!.pending).not.toBeNull();
    if (action === 'reset') engine.reset('manual-reset', 550);
    else if (action === 'guidance') engine.guidanceStarted(550);
    else engine.setTableFrame(action === 'changed-frame' ? turn('y', 90) : null, 550);
    for (let at = 600; at <= 1000; at += 100) engine.update(quickHand(12, at), at);
    const state = engine.snapshot(1000);
    expect(state.homeGrip!.pending).toBeNull();
    expect(state.motionHeading!.homeGrip.episodes).toBe(0);
    expect(state.motionHeading!.appliedDeg).toBe(0);
  });

  it('retries an expired provisional window without adding another episode or learning from stale data', () => {
    const engine = new GyroDriftCorrector({ adaptiveHeading: true });
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R U', null, 1);
    for (let at = 100; at <= 500; at += 100) engine.update(quickHand(12, at), at);
    expect(engine.snapshot(500).homeGrip!.pending).not.toBeNull();
    engine.update(quickHand(12, 2000), 2000);
    expect(engine.snapshot(2000).motionHeading!.homeGrip.episodes).toBe(0);
    expect(engine.snapshot(2000).homeGrip!.pending).toBeNull();
    for (let at = 2100; at <= 3000; at += 100) engine.update(quickHand(12, at), at);
    const state = engine.snapshot(3000);
    expect(state.homeGrip!.observations).toBe(1);
    expect(state.motionHeading!.homeGrip.episodes).toBe(1);
  });

  it.each([2, 3].flatMap(size => [-1, 1].map(sign => ({ size, sign }))))(
    'learns and applies independent fast-rate correction for size $size, sign $sign', ({ size, sign }) => {
      const engine = new GyroDriftCorrector({ adaptiveHeading: true });
      const resetFrame = turn('y', 90), frame = turn('y', -90);
      if (size === 2) engine.setTableFrame(resetFrame, 0);
      engine.reset('manual-reset', 0);
      engine.update(new Quaternion(), 0);
      for (let at = 100; at <= 90_000; at += 100) {
        const phase = at % 10_000;
        if (phase === 100) {
          engine.armAlgorithm('R U', 'alternative-algorithms-enabled', at);
          if (size === 2) engine.setTableFrame(frame, at);
        }
        const pose = at <= 82_000 ? hand(sign * at * .0005, at) : turn('y', sign * 45);
        const raw = size === 2 ? resetFrame.clone().multiply(pose).multiply(frame.clone().invert()) : pose;
        engine.update(raw, at);
        if (phase === 2000) engine.noteMove(at, new Quaternion(), { cubeSize: size });
        if (phase === 3000) engine.completeAlgorithm(new Quaternion(), at);
        if (size === 2 && at === 84_000) engine.setTableFrame(frame, at);
      }
      const state = engine.snapshot(90_000).motionHeading!;
      expect(state).toMatchObject({ fitEvidence: 'home-grip', rateReady: true,
        fittedRate: expect.closeTo(sign * .5, 2), historyRevisionDeg: 0 });
      expect(sign * state.appliedDeg).toBeGreaterThan(1);
      expect(Math.abs(sign * 45 - state.appliedDeg)).toBeLessThan(45);
    });


  it.each(['unknown', 'tilted'] as const)('does not infer a 2×2 absolute home heading from an %s reset relation', relation => {
    const engine = new GyroDriftCorrector({ adaptiveHeading: true });
    engine.setTableFrame(relation === 'tilted' ? turn('x', 90) : null, 0);
    engine.reset('manual-reset', 0);
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R U', null, 1);
    engine.setTableFrame(new Quaternion(), 1, true, { pictureFacelets: 'URFDLB'.repeat(4) });
    for (let at = 100; at < 2000; at += 100) engine.update(hand(12, at), at);
    expect(engine.snapshot(2000).homeGrip).toMatchObject({ observations: 0,
      reason: relation === 'tilted' ? 'tilted-reset-frame' : 'unknown-reference-frame' });
    expect(engine.snapshot(2000).motionHeading!.appliedDeg).toBe(0);
  });

  it('clears learned compensation on disable and requires fresh evidence after re-enabling', () => {
    const engine = new GyroDriftCorrector({ adaptiveHeading: true });
    engine.update(new Quaternion(), 0);
    const attempt = (index: number, yaw: number) => {
      const start = index * 10_000 + 100;
      engine.armAlgorithm('R U', null, start);
      for (let at = start; at <= start + 2000; at += 100) {
        const raw = hand(yaw, at);
        const result = engine.update(raw, at);
        if (!engine.snapshot(at).enabled) expect(result.angleTo(raw)).toBeLessThan(1e-7);
      }
      engine.noteMove(start + 2100, new Quaternion());
      engine.completeAlgorithm(new Quaternion(), start + 2200);
    };
    for (let index = 0; index < 4; index++) attempt(index, 12);
    expect(engine.snapshot(32_300).motionHeading!.landmarkAdjustmentDeg).toBe(1);
    expect(engine.correction.angleTo(new Quaternion())).toBeGreaterThan(0);

    engine.setEnabled(false, 32_300);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    for (let index = 4; index < 8; index++) attempt(index, 30);
    expect(engine.snapshot(72_300)).toMatchObject({ startEvidence: null, armedAlgorithm: null,
      activeAttempt: null, activeCorrection: null, pendingEndpoint: null,
      homeGrip: { observations: 0, pending: null },
      motionHeading: { supported: false, observations: 0, appliedDeg: 0,
        landmarkAdjustmentDeg: 0, integratedDriftDeg: 0, rate: 0, homeGrip: { episodes: 0 } } });

    engine.setEnabled(true, 72_300);
    for (let index = 8; index < 10; index++) attempt(index, 12);
    expect(engine.snapshot(92_300).motionHeading!.landmarkAdjustmentDeg).toBe(0);
    attempt(10, 12);
    expect(engine.snapshot(102_300).motionHeading!.landmarkAdjustmentDeg).toBe(.5);
  });

  it('preserves known 2×2 sticker and reset frames when correction is toggled', () => {
    const engine = new GyroDriftCorrector({ adaptiveHeading: true });
    engine.setTableFrame(turn('y', 90), 0);
    engine.reset('manual-reset', 0);
    engine.update(new Quaternion(), 0);
    engine.setTableFrame(turn('y', -90), 100);
    const reference = engine.tableReference();
    expect(reference.available).toBe(true);
    engine.setEnabled(false, 200);
    engine.update(hand(35, 300), 300);
    engine.setEnabled(true, 400);
    expect(engine.tableReference()).toEqual(reference);
    expect(engine.snapshot(400).motionHeading!.homeGrip.episodes).toBe(0);
  });
});
