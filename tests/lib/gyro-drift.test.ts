import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { GyroDriftCorrector, gyroAlgorithmEligibility, gyroPoseMetrics, gyroQuaternion } from '../../src/lib/gyro-drift';

const rotation = (axis: 'x' | 'y' | 'z', degrees: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), degrees * Math.PI / 180);
function stableStart(engine: GyroDriftCorrector, q = new Quaternion(), now = 0) {
  for (let at = now - 200; at <= now; at += 20) engine.update(q, at);
}
function harness() {
  const engine = new GyroDriftCorrector();
  const samples = (q: Quaternion, from: number, to: number) => {
    let result = q;
    for (let at = from; at <= to; at += 20) result = engine.update(q, at);
    return result;
  };
  return { engine, samples };
}

it('rejects duplicate, older and invalid packets before they can clear a stable start or affect rendering', () => {
  const { engine, samples } = harness();
  const raw = rotation('x', 25);
  samples(raw, 0, 400);
  const before = engine.snapshot(410);
  const rendered = engine.apply(raw);
  for (const [q, at] of [[rotation('y', 80), 400], [rotation('y', -60), 350],
    [new Quaternion(0, 0, 0, 0), 420], [new Quaternion(1e300, 0, 0, 1), 430], [raw, NaN]] as const) {
    expect(engine.update(q, at).angleTo(rendered)).toBeLessThan(1e-7);
  }
  expect(engine.snapshot(410)).toEqual({ ...before, rejectedSamples: { invalid: 3, duplicate: 1, outOfOrder: 1 } });
  engine.armAlgorithm('R', null, 410);
  engine.noteMove(410, new Quaternion());
  expect(engine.snapshot(410).startEvidence!.reason).toBe('stable-start-window');
});

describe('gyro drift correction', () => {
  it('averages a stable start window, including equivalent opposite-sign quaternions', () => {
    const { engine, samples } = harness();
    const grip = rotation('x', 25);
    for (let i = 0; i < 6; i++) {
      const q = rotation('y', 20 + (i % 2 ? .2 : -.2)).multiply(grip);
      if (i % 2) q.set(-q.x, -q.y, -q.z, -q.w);
      engine.update(q, i * 60);
    }
    engine.armAlgorithm('R U', null, 300);
    engine.noteMove(310, new Quaternion());
    const start = engine.snapshot(310).activeAttempt!;
    expect(start.startEvidence).toMatchObject({ reason: 'stable-start-window', sampleCount: 6,
      spanMs: 300, spreadDeg: expect.closeTo(.4, 4), sampleAgeMs: 10 });
    const measured = gyroQuaternion(start.start!)!;
    expect(measured.angleTo(rotation('y', 20).multiply(grip))).toBeLessThan(1e-6);
    engine.completeAlgorithm(new Quaternion(), 320);
    const result = samples(rotation('y', 24).multiply(grip), 340, 1800);
    expect(result.angleTo(rotation('y', 22).multiply(grip))).toBeLessThan(1e-6);
  });

  it('rejects a fresh moving start and does not reuse a preceding stable table pose', () => {
    const { engine, samples } = harness();
    samples(rotation('x', 25), 0, 300);
    engine.update(rotation('x', 40), 320);
    engine.armAlgorithm('R', null, 320);
    engine.noteMove(330, new Quaternion());
    const attempt = engine.snapshot(330).activeAttempt;
    engine.completeAlgorithm(new Quaternion(), 340);
    samples(rotation('y', 4).multiply(rotation('x', 40)), 360, 1600);
    expect(attempt).toMatchObject({
      reason: 'start-grip-not-stable', start: null,
      startEvidence: { sampleAgeMs: 10, sampleCount: 1, confidence: 0 } });
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
  });

  it('requires 600ms of samples, smoothly corrects tilt, and preserves yaw', () => {
    const { engine, samples } = harness();
    const q = rotation('y', 40).multiply(rotation('x', 6));
    samples(q, 0, 580);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    const first = samples(q, 600, 620);
    expect(gyroPoseMetrics(first).tiltDeg).toBeGreaterThan(5.8);
    const result = samples(q, 640, 2600);
    expect(gyroPoseMetrics(result).tiltDeg).toBeLessThan(.001);
    expect(gyroPoseMetrics(result).yawDeg).toBeCloseTo(40, 5);
    samples(q, 2620, 6000);
    expect(engine.snapshot(6000).activeCorrection).toBeNull();
  });

  it('supports resting on any face and does not flatten a clearly tilted grip', () => {
    const h = harness();
    const result = h.samples(rotation('z', 94), 0, 2000);
    expect(result.angleTo(rotation('z', 90))).toBeLessThan(.00001);
    const tilted = harness();
    const q = rotation('x', 25);
    expect(tilted.samples(q, 0, 2500).angleTo(q)).toBeLessThan(.00001);
    expect(tilted.engine.snapshot(2500).lastDecision?.reason).toBe('face-not-flat-enough');
  });

  it('does not treat packet silence or a face turn as sustained rest', () => {
    const { engine, samples } = harness();
    const q = rotation('x', 5);
    engine.update(q, 0);
    engine.update(q, 5000);
    samples(q, 5020, 5500);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    engine.noteMove(5500, null);
    samples(q, 5520, 6080);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    samples(q, 6100, 7000);
    expect(engine.correction.angleTo(new Quaternion())).toBeGreaterThan(0);
  });

  it('stops an in-progress adjustment on motion or a new face turn', () => {
    const { engine, samples } = harness();
    const q = rotation('x', 8);
    samples(q, 0, 800);
    const partial = engine.correction.clone();
    expect(partial.angleTo(new Quaternion()) * 180 / Math.PI).toBeLessThan(1);
    engine.noteMove(810, null);
    engine.update(rotation('z', 25), 820);
    expect(engine.correction.angleTo(partial)).toBeLessThan(1e-7);
    expect(engine.snapshot(820).activeCorrection).toBeNull();
  });

  it('compares actual start and end grips, correcting only part of a small heading change', () => {
    const { engine, samples } = harness();
    const grip = rotation('y', 25).multiply(rotation('x', 30));
    samples(grip, -100, 100);
    engine.armAlgorithm("R U R'", null, 100);
    engine.noteMove(110, new Quaternion());
    samples(grip, 120, 900);
    // No table correction during an active attempt.
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    engine.completeAlgorithm(new Quaternion(), 910);
    const end = rotation('y', 6).multiply(grip);
    const result = samples(end, 920, 2200);
    expect(result.angleTo(rotation('y', 3).multiply(grip))).toBeLessThan(1e-6);
    expect(engine.snapshot(2200).lastDecision?.reason).toBe('accepted');
  });

  it.each([['heading-change-too-large', rotation('y', 90)], ['grip-tilt-changed', rotation('x', 20)]])
    ('rejects intentional grip changes: %s', (reason, end) => {
      const { engine, samples } = harness();
      stableStart(engine);
      engine.armAlgorithm('R', null, 0);
      engine.noteMove(10, new Quaternion());
      engine.completeAlgorithm(new Quaternion(), 20);
      samples(end as Quaternion, 40, 300);
      expect(engine.snapshot(300).lastDecision?.reason).toBe(reason);
      expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    });

  it('compensates changing 2×2 sensor frames at both algorithm boundaries', () => {
    const { engine, samples } = harness();
    const startFrame = rotation('x', 90), endFrame = rotation('z', -90);
    const grip = rotation('x', 25);
    stableStart(engine, grip.clone().multiply(startFrame.clone().invert()));
    engine.armAlgorithm('R D B', null, 0);
    engine.noteMove(10, startFrame);
    engine.completeAlgorithm(endFrame, 20);
    const end = rotation('y', -4).multiply(grip).multiply(endFrame.clone().invert());
    const result = samples(end, 40, 1600).multiply(endFrame);
    expect(result.angleTo(rotation('y', -2).multiply(grip))).toBeLessThan(1e-6);
    expect(gyroPoseMetrics(engine.correction).yawDeg).toBeCloseTo(2);
  });

  it('preserves the previous endpoint when the next case is displayed but skips it on another move', () => {
    const { engine, samples } = harness();
    stableStart(engine);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.armAlgorithm('U', null, 25);
    samples(rotation('y', 4), 40, 100);
    engine.noteMove(110, new Quaternion());
    expect(engine.snapshot(110).lastDecision).toMatchObject({
      durationMs: 100, endpointWaitMs: 90, sampleAgeMs: 10, sampleAfterCompletion: true,
      delta: { yawDeg: expect.closeTo(4, 5), tiltDeg: expect.closeTo(0, 5) },
      headingEvidence: { sampleCount: 4, spanMs: 60, yawSpreadDeg: 0, steady: false },
    });
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
  });

  it('identifies skipped endpoints that have no post-completion sensor evidence', () => {
    const { engine } = harness();
    stableStart(engine, rotation('y', 2));
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.cancelAttempt('training-cleared', 500);
    expect(engine.snapshot(500).lastDecision)
      .toMatchObject({ sampleAfterCompletion: false, sampleAgeMs: 500, endpointWaitMs: 480,
        headingEvidence: { sampleCount: 0, spanMs: 0, yawSpreadDeg: null, steady: false } });
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
  });

  it('leaves the reference unchanged when correction is disabled', () => {
    const { engine, samples } = harness();
    engine.setEnabled(false, 0);
    const q = rotation('x', 6);
    expect(samples(q, 0, 2200).angleTo(q)).toBeLessThan(1e-6);
    expect(engine.snapshot(2200).lastDecision?.reason).toBe('disabled');
    expect(engine.snapshot(0).activeCorrection).toBeNull();
  });

  it('retains applied corrections on opt-out and clears all estimator history on reset', () => {
    const { engine, samples } = harness();
    samples(rotation('x', 4), 0, 2000);
    const correction = engine.correction.clone();
    engine.setEnabled(false, 2010);
    expect(engine.correction.angleTo(correction)).toBeLessThan(1e-7);
    engine.reset('manual-reset', 2020);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    expect(engine.snapshot(2020).uncorrected).toBeNull();
  });

  it('rejects stale start samples, cancellation, and endpoints that never settle', () => {
    const { engine, samples } = harness();
    stableStart(engine);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(1000, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 1010);
    expect(engine.snapshot(1010).lastDecision?.reason).toBe('missing-fresh-start-sample');
    samples(new Quaternion(), 1020, 1100);
    engine.armAlgorithm('U', null, 1100);
    engine.noteMove(1110, new Quaternion());
    engine.cancelAttempt('recovery', 1120);
    engine.completeAlgorithm(new Quaternion(), 1130);
    expect(engine.snapshot(1130).activeAttempt).toBeNull();
    samples(new Quaternion(), 1140, 1340);
    engine.armAlgorithm('F', null, 1350);
    engine.noteMove(1360, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 1370);
    engine.update(rotation('y', 4), 4600);
    expect(engine.snapshot(4600).lastDecision?.reason).toBe('endpoint-did-not-settle');
  });

  it('handles quaternion sign equivalence and rejects invalid readings', () => {
    expect(gyroQuaternion({ x: NaN, y: 0, z: 0, w: 1 })).toBeNull();
    expect(gyroQuaternion({ x: 0, y: 0, z: 0, w: 0 })).toBeNull();
    const { engine, samples } = harness();
    const q = rotation('x', 4);
    samples(q, 0, 580);
    const opposite = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    engine.update(opposite, 600);
    engine.update(opposite, 620);
    expect(engine.correction.angleTo(new Quaternion())).toBeGreaterThan(0);
    expect(gyroPoseMetrics(rotation('x', 180)).yawDeg).toBeNull();
  });

  it.each([60, 90, 135])('uses heading stability while the hand pitches at a %ims BLE cadence', cadence => {
    const { engine } = harness();
    const grip = rotation('x', 25);
    stableStart(engine, grip);
    engine.armAlgorithm('R U', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    for (let at = cadence, i = 0; at < 1800; at += cadence, i++) {
      const q = rotation('y', 4).multiply(rotation('x', 25 + (i % 2 ? 2 : -2)));
      engine.update(q, at);
    }
    expect(engine.snapshot(1800).lastDecision?.reason).toBe('accepted');
    expect(gyroPoseMetrics(engine.correction).tiltDeg).toBeLessThan(.0001);
    expect(gyroPoseMetrics(engine.correction).yawDeg).toBeCloseTo(-2);
  });

  it('allows a delayed endpoint without assuming that the cube is steady during missing packets', () => {
    const { engine } = harness();
    stableStart(engine);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    for (let at = 90; at <= 1800; at += 90) engine.update(rotation('y', at % 180 ? 20 : -20), at);
    expect(engine.snapshot(1800).pendingEndpoint).not.toBeNull();
    for (let at = 1890; at <= 2790; at += 90) engine.update(rotation('y', 4), at);
  });

  it('stops heading correction immediately on yaw motion, even after accepting the endpoint', () => {
    const { engine, samples } = harness();
    stableStart(engine);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    samples(rotation('y', 6), 40, 360);
    const partial = engine.correction.clone();
    engine.update(rotation('y', 20), 380);
    expect(engine.correction.angleTo(partial)).toBeLessThan(1e-6);
    expect(engine.snapshot(380).activeCorrection).toBeNull();
  });

  it('requires three fresh endpoint samples and does not apply correction time from before acceptance', () => {
    const { engine } = harness();
    stableStart(engine);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.update(rotation('y', 4), 100);
    engine.update(rotation('y', 4), 280);
    expect(engine.snapshot(0).activeCorrection).toBeNull();
    engine.update(rotation('y', 4), 400);
    expect(engine.snapshot(400).activeCorrection).not.toBeNull();
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    engine.update(rotation('y', 4), 500);
    expect(Math.abs(gyroPoseMetrics(engine.correction).yawDeg!)).toBeCloseTo(.4);
  });

  it('preserves the GAN recovery pose without treating an approximate holding angle as calibration', () => {
    const { engine } = harness();
    // Mid-session reset pose from the second GAN16ui recording, in its old
    // calibrated frame, including the correction accumulated before recovery.
    const raw = new Quaternion(.005981426129830419, -.3138379011962908, .0035112620044616353, -.9494512443265828);
    engine.correction.set(.0030242436641008236, .007396885285724433, .0007974885494916416, .9999677515051891);
    engine.update(raw, 100);
    const before = gyroPoseMetrics(engine.apply(raw));
    expect(before.yawDeg).toBeCloseTo(37.429756717, 6);
    engine.guidanceStarted(110);
    engine.observeGuidedGrip(new Quaternion(), 120);
    const after = engine.apply(raw);
    expect(gyroPoseMetrics(after).yawDeg).toBeCloseTo(before.yawDeg!, 6);
    expect(gyroPoseMetrics(after).tiltDeg).toBeCloseTo(before.tiltDeg, 6);
    expect(engine.snapshot(120).lastDecision).toMatchObject({ reason: 'observed-grip-only', applied: false, headingAdjustmentDeg: 0 });
    engine.armAlgorithm('R U', null, 130);
    expect(gyroPoseMetrics(engine.update(raw, 140)).yawDeg).toBeCloseTo(before.yawDeg!, 6);
  });

  it('preserves both intentional tilts and the pictured sticker frame after guidance', () => {
    const { engine } = harness();
    const frame = rotation('y', 90).multiply(rotation('z', -90));
    const raw = rotation('y', -25).multiply(rotation('x', 6)).multiply(frame);
    engine.update(raw, 0);
    engine.observeGuidedGrip(frame, 30);
    const result = engine.apply(raw);
    expect(result.angleTo(raw)).toBeLessThan(1e-6);
    expect(result.angleTo(new Quaternion())).toBeGreaterThan(1);
  });

  it.each(['disabled', 'stale', 'unknown-frame', 'quarter-turn'] as const)
    ('does not reanchor an untrusted guided pose: %s', scenario => {
      const { engine } = harness();
      if (scenario === 'disabled') engine.setEnabled(false, 0);
      const q = rotation('y', scenario === 'quarter-turn' ? 90 : 20);
      engine.update(q, 0);
      engine.observeGuidedGrip(scenario === 'unknown-frame' ? null : new Quaternion(), scenario === 'stale' ? 300 : 30);
      expect(engine.correction.angleTo(new Quaternion())).toBe(0);
      expect(engine.snapshot(300).lastDecision?.applied).toBe(false);
    });
});

describe('rotation-free algorithm eligibility', () => {
  it.each(["R U2 R' D L B F2", "(R U R' U')3", "[R, U]"])( 'accepts outer face turns and expanded notation: %s', alg => {
    expect(gyroAlgorithmEligibility(alg)).toBeNull();
  });
  it.each(['x R', 'R y2', 'M2 U', 'r U', 'Rw U', '(R U x)2', '[R: S]', '', 'nonsense'])('rejects %s', alg => {
    expect(gyroAlgorithmEligibility(alg)).not.toBeNull();
  });
});
