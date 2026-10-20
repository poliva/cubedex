import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { GyroDriftCorrector, gyroAlgorithmEligibility, gyroPoseMetrics, gyroQuaternion } from '../../src/lib/gyro-drift';

const rotation = (axis: 'x' | 'y' | 'z', degrees: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), degrees * Math.PI / 180);
function harness() {
  const events: Array<{ event: string; data: Record<string, any> }> = [];
  const engine = new GyroDriftCorrector((event, data) => events.push({ event, data }));
  const samples = (q: Quaternion, from: number, to: number) => {
    let result = q;
    for (let at = from; at <= to; at += 20) result = engine.update(q, at);
    return result;
  };
  return { engine, events, samples };
}

describe('gyro drift correction', () => {
  it('requires 600ms of samples, smoothly corrects tilt, and preserves yaw', () => {
    const { engine, events, samples } = harness();
    const q = rotation('y', 40).multiply(rotation('x', 6));
    samples(q, 0, 580);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    const first = samples(q, 600, 620);
    expect(gyroPoseMetrics(first).tiltDeg).toBeGreaterThan(5.8);
    const result = samples(q, 640, 2600);
    expect(gyroPoseMetrics(result).tiltDeg).toBeLessThan(.001);
    expect(gyroPoseMetrics(result).yawDeg).toBeCloseTo(40, 5);
    samples(q, 2620, 6000);
    expect(events.filter(e => e.event === 'correction-start')).toHaveLength(1);
    expect(events.find(e => e.event === 'correction-applied')?.data).toMatchObject({ reason: 'completed', appliedDeg: expect.closeTo(6, 5) });
  });

  it('supports resting on any face and does not flatten a clearly tilted grip', () => {
    const h = harness();
    const result = h.samples(rotation('z', 94), 0, 2000);
    expect(result.angleTo(rotation('z', 90))).toBeLessThan(.00001);
    const tilted = harness();
    const q = rotation('x', 25);
    expect(tilted.samples(q, 0, 2500).angleTo(q)).toBeLessThan(.00001);
    expect(tilted.events.find(e => e.event === 'correction-decision')?.data.reason).toBe('face-not-flat-enough');
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
    const { engine, events, samples } = harness();
    const q = rotation('x', 8);
    samples(q, 0, 800);
    const partial = engine.correction.clone();
    expect(partial.angleTo(new Quaternion()) * 180 / Math.PI).toBeLessThan(1);
    engine.noteMove(810, null);
    engine.update(rotation('z', 25), 820);
    expect(engine.correction.angleTo(partial)).toBeLessThan(1e-7);
    expect(events.find(e => e.event === 'correction-applied')?.data.reason).toBe('face-move');
  });

  it('compares actual start and end grips, correcting only part of a small heading change', () => {
    const { engine, events, samples } = harness();
    const grip = rotation('y', 25).multiply(rotation('x', 30));
    samples(grip, 0, 100);
    engine.armAlgorithm("R U R'", null, 100);
    engine.noteMove(110, new Quaternion());
    samples(grip, 120, 900);
    // No table correction during an active attempt.
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    engine.completeAlgorithm(new Quaternion(), 910);
    const end = rotation('y', 6).multiply(grip);
    const result = samples(end, 920, 2200);
    expect(result.angleTo(rotation('y', 3).multiply(grip))).toBeLessThan(1e-6);
    expect(events.find(e => e.event === 'correction-decision' && e.data.source === 'algorithm')?.data.reason).toBe('accepted');
  });

  it.each([['heading-change-too-large', rotation('y', 90)], ['grip-tilt-changed', rotation('x', 20)]])
    ('rejects intentional grip changes: %s', (reason, end) => {
      const { engine, events, samples } = harness();
      engine.update(new Quaternion(), 0);
      engine.armAlgorithm('R', null, 0);
      engine.noteMove(10, new Quaternion());
      engine.completeAlgorithm(new Quaternion(), 20);
      samples(end as Quaternion, 40, 300);
      expect(events.find(e => e.data.source === 'algorithm')?.data.reason).toBe(reason);
      expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    });

  it('compensates changing 2×2 sensor frames at both algorithm boundaries', () => {
    const { engine, events, samples } = harness();
    const startFrame = rotation('x', 90), endFrame = rotation('z', -90);
    const grip = rotation('x', 25);
    engine.update(grip.clone().multiply(startFrame.clone().invert()), 0);
    engine.armAlgorithm('R D B', null, 0);
    engine.noteMove(10, startFrame);
    engine.completeAlgorithm(endFrame, 20);
    const end = rotation('y', -4).multiply(grip).multiply(endFrame.clone().invert());
    const result = samples(end, 40, 1600).multiply(endFrame);
    expect(result.angleTo(rotation('y', -2).multiply(grip))).toBeLessThan(1e-6);
    const decision = events.find(e => e.data.source === 'algorithm');
    expect(decision?.data.delta.yawDeg).toBeCloseTo(-4);
  });

  it('preserves the previous endpoint when the next case is displayed but skips it on another move', () => {
    const { engine, events, samples } = harness();
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.armAlgorithm('U', null, 25);
    samples(rotation('y', 4), 40, 100);
    engine.noteMove(110, new Quaternion());
    expect(events.find(e => e.data.reason === 'next-move-before-settling')).toBeDefined();
    expect(events.find(e => e.data.reason === 'next-move-before-settling')?.data).toMatchObject({
      durationMs: 100, endpointWaitMs: 90, sampleAgeMs: 10, sampleAfterCompletion: true,
      delta: { yawDeg: expect.closeTo(4, 5), tiltDeg: expect.closeTo(0, 5) },
      headingEvidence: { sampleCount: 4, spanMs: 60, yawSpreadDeg: 0, steady: false },
    });
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
  });

  it('identifies skipped endpoints that have no post-completion sensor evidence', () => {
    const { engine, events } = harness();
    engine.update(rotation('y', 2), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.cancelAttempt('training-cleared', 500);
    expect(events.find(e => e.data.reason === 'training-cleared' && e.event === 'correction-decision')?.data)
      .toMatchObject({ sampleAfterCompletion: false, sampleAgeMs: 500, endpointWaitMs: 480,
        headingEvidence: { sampleCount: 0, spanMs: 0, yawSpreadDeg: null, steady: false } });
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
  });

  it('logs proposed corrections while disabled, without changing the reference', () => {
    const { engine, events, samples } = harness();
    engine.setEnabled(false, 0);
    const q = rotation('x', 6);
    expect(samples(q, 0, 2200).angleTo(q)).toBeLessThan(1e-6);
    expect(events.find(e => e.data.source === 'table')?.data.reason).toBe('disabled');
    expect(events.some(e => e.event === 'correction-start')).toBe(false);
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
    const { engine, events, samples } = harness();
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(1000, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 1010);
    expect(events.some(e => e.data.reason === 'missing-fresh-start-sample')).toBe(true);
    samples(new Quaternion(), 1020, 1100);
    engine.armAlgorithm('U', null, 1100);
    engine.noteMove(1110, new Quaternion());
    engine.cancelAttempt('recovery', 1120);
    engine.completeAlgorithm(new Quaternion(), 1130);
    expect(events.some(e => e.event === 'algorithm-cancelled' && e.data.reason === 'recovery')).toBe(true);
    engine.armAlgorithm('F', null, 1130);
    engine.noteMove(1140, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 1150);
    engine.update(rotation('y', 4), 4300);
    expect(events.some(e => e.data.reason === 'endpoint-did-not-settle')).toBe(true);
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
    const { engine, events } = harness();
    const grip = rotation('x', 25);
    engine.update(grip, 0);
    engine.armAlgorithm('R U', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    for (let at = cadence, i = 0; at < 1800; at += cadence, i++) {
      const q = rotation('y', 4).multiply(rotation('x', 25 + (i % 2 ? 2 : -2)));
      engine.update(q, at);
    }
    expect(events.some(e => e.event === 'correction-decision' && e.data.source === 'algorithm' && e.data.reason === 'accepted')).toBe(true);
    expect(events.find(e => e.event === 'correction-applied')?.data.appliedDeg).toBeCloseTo(2);
    expect(gyroPoseMetrics(engine.correction).tiltDeg).toBeLessThan(.0001);
    expect(gyroPoseMetrics(engine.correction).yawDeg).toBeCloseTo(-2);
  });

  it('allows a delayed endpoint without assuming that the cube is steady during missing packets', () => {
    const { engine, events } = harness();
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    for (let at = 90; at <= 1800; at += 90) engine.update(rotation('y', at % 180 ? 20 : -20), at);
    expect(events.some(e => e.data.source === 'algorithm')).toBe(false);
    for (let at = 1890; at <= 2790; at += 90) engine.update(rotation('y', 4), at);
    expect(events.find(e => e.event === 'correction-applied')?.data.appliedDeg).toBeCloseTo(2);
  });

  it('stops heading correction immediately on yaw motion, even after accepting the endpoint', () => {
    const { engine, events, samples } = harness();
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    samples(rotation('y', 6), 40, 360);
    const partial = engine.correction.clone();
    engine.update(rotation('y', 20), 380);
    expect(engine.correction.angleTo(partial)).toBeLessThan(1e-6);
    expect(events.find(e => e.event === 'correction-applied')?.data.reason).toBe('heading-motion');
  });

  it('requires three fresh endpoint samples and does not apply correction time from before acceptance', () => {
    const { engine, events } = harness();
    engine.update(new Quaternion(), 0);
    engine.armAlgorithm('R', null, 0);
    engine.noteMove(10, new Quaternion());
    engine.completeAlgorithm(new Quaternion(), 20);
    engine.update(rotation('y', 4), 100);
    engine.update(rotation('y', 4), 280);
    expect(events.some(e => e.event === 'correction-start')).toBe(false);
    engine.update(rotation('y', 4), 400);
    expect(events.some(e => e.event === 'correction-start')).toBe(true);
    expect(engine.correction.angleTo(new Quaternion())).toBe(0);
    engine.update(rotation('y', 4), 500);
    expect(Math.abs(gyroPoseMetrics(engine.correction).yawDeg!)).toBeCloseTo(.4);
  });

  it('records the GAN recovery pose without treating an approximate holding angle as calibration', () => {
    const { engine, events } = harness();
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
    const reference = events.find(e => e.event === 'guided-reference')!;
    expect(reference.data).toMatchObject({ reason: 'observed-grip-only', applied: false, headingAdjustmentDeg: 0 });
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
      const { engine, events } = harness();
      if (scenario === 'disabled') engine.setEnabled(false, 0);
      const q = rotation('y', scenario === 'quarter-turn' ? 90 : 20);
      engine.update(q, 0);
      engine.observeGuidedGrip(scenario === 'unknown-frame' ? null : new Quaternion(), scenario === 'stale' ? 300 : 30);
      expect(engine.correction.angleTo(new Quaternion())).toBe(0);
      expect(events.find(e => e.event === 'guided-reference')?.data.applied).toBe(false);
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
