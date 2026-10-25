import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { HOME_ORIENTATION } from '../../src/lib/cube-orientation';
import { referenceViewOrientation, TrainingCubeOrientation, type TrainingCubeView } from '../../src/lib/training-cube-view';

const turn = (axis: 'x' | 'y' | 'z', degrees: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), degrees * Math.PI / 180);

describe('training reference view', () => {

  it('changes the default Y angle in both directions while keeping the same X tilt', () => {
    const up = new Vector3(0, 1, 0).applyQuaternion(referenceViewOrientation(0));
    for (const angle of [-45, -10, 0, 10, 45]) {
      const reference = referenceViewOrientation(angle);
      expect(reference.angleTo(turn('x', 15).multiply(turn('y', -angle)))).toBeLessThan(1e-7);
      expect(new Vector3(0, 1, 0).applyQuaternion(reference).distanceTo(up)).toBeLessThan(1e-7);
    }
    expect(new Vector3(0, 0, 1).applyQuaternion(referenceViewOrientation(-30)).x).toBeGreaterThan(0);
    expect(new Vector3(0, 0, 1).applyQuaternion(referenceViewOrientation(30)).x).toBeLessThan(0);
  });

  it.each([-1, 1])('allows immediate %i Y inspection, retains side stickers for several seconds and gently recenters', sign => {
    const orientation = new TrainingCubeOrientation();
    const view: TrainingCubeView = { phase: 'ready', anchor: null };
    const reference = referenceViewOrientation(10);
    orientation.target(HOME_ORIENTATION, new Quaternion(), view, 10, 0);
    const pose = HOME_ORIENTATION.clone().multiply(turn('y', sign * 30)).multiply(turn('x', 20));
    const first = orientation.target(pose, new Quaternion(), view, 10, 100);
    expect(first.angleTo(reference)).toBeGreaterThan(25 * Math.PI / 180);
    let shown = first;
    for (let at = 200; at <= 5000; at += 100) shown = orientation.target(pose, new Quaternion(), view, 10, at);
    expect(shown.angleTo(reference.clone().multiply(turn('x', 20)))).toBeGreaterThan(24 * Math.PI / 180);
    const duringPeek = shown.clone();
    const anchor = pose.clone();
    const executing: TrainingCubeView = { phase: 'executing', anchor };
    expect(orientation.target(pose, new Quaternion(), executing, 10, 5100).angleTo(duringPeek)).toBeLessThan(1e-7);
    const rotation = turn('y', sign * 90);
    const running = pose.clone().multiply(rotation);
    expect(orientation.target(running, new Quaternion(), executing, 10, 5200)
      .angleTo(duringPeek.clone().multiply(rotation))).toBeLessThan(1e-7);
    // Completing an attempt retains its center and still permits peeking.
    const nextReady: TrainingCubeView = { phase: 'ready', anchor: null };
    orientation.target(HOME_ORIENTATION, new Quaternion(), nextReady, 10, 5300);
    for (let at = 5400; at <= 155_300; at += 100) shown = orientation.target(pose, new Quaternion(), nextReady, 10, at);
    expect(shown.angleTo(reference.clone().multiply(turn('x', 20)))).toBeLessThan(.3 * Math.PI / 180);
  });

  it.each([-1, 1])('returns to the same neutral view after algorithms ending in direction %i', sign => {
    const orientation = new TrainingCubeOrientation();
    const reference = referenceViewOrientation(10);
    const pose = (degrees: number) => HOME_ORIENTATION.clone().multiply(turn('y', degrees));
    let at = 0;
    orientation.target(pose(0), new Quaternion(), { phase: 'ready', anchor: null }, 10, at);
    for (const ending of [sign * 30, -sign * 30, sign * 20]) {
      const executing: TrainingCubeView = { phase: 'executing', anchor: pose(0) };
      orientation.target(pose(0), new Quaternion(), executing, 10, at += 100);
      orientation.target(pose(ending), new Quaternion(), executing, 10, at += 1000);
      const nextReady: TrainingCubeView = { phase: 'ready', anchor: null };
      const end = orientation.target(pose(ending), new Quaternion(), nextReady, 10, at += 10);
      expect(end.angleTo(reference.clone().multiply(turn('y', ending)))).toBeLessThan(1e-7);
      const normal = orientation.target(pose(0), new Quaternion(), nextReady, 10, at += 100);
      expect(normal.angleTo(reference)).toBeLessThan(1e-7);
      // A duplicate/new ready event during a regrip must not define a new home.
      const repeatedReady: TrainingCubeView = { phase: 'ready', anchor: null };
      orientation.target(pose(ending), new Quaternion(), repeatedReady, 10, at += 10);
      expect(orientation.target(pose(0), new Quaternion(), repeatedReady, 10, at += 100)
        .angleTo(reference)).toBeLessThan(1e-7);
    }
  });

  it.each([-1, 1])('allows large inspection in direction %i through algorithm transitions and returns home', sign => {
    const orientation = new TrainingCubeOrientation();
    const view: TrainingCubeView = { phase: 'ready', anchor: null };
    const reference = referenceViewOrientation(10);
    const pose = (degrees: number) => HOME_ORIENTATION.clone().multiply(turn('y', degrees));
    orientation.target(pose(0), new Quaternion(), view, 10, 0);
    const inspection = orientation.target(pose(sign * 90), new Quaternion(), view, 10, 100);
    expect(inspection.angleTo(reference.clone().multiply(turn('y', sign * 90)))).toBeLessThan(.3 * Math.PI / 180);
    const executing: TrainingCubeView = { phase: 'executing', anchor: pose(sign * 90) };
    expect(orientation.target(pose(sign * 90), new Quaternion(), executing, 10, 110).angleTo(inspection)).toBeLessThan(1e-7);
    const running = orientation.target(pose(sign * 150), new Quaternion(), executing, 10, 200);
    expect(running.angleTo(inspection.clone().multiply(turn('y', sign * 60)))).toBeLessThan(1e-7);
    const nextReady: TrainingCubeView = { phase: 'ready', anchor: null };
    expect(orientation.target(pose(sign * 150), new Quaternion(), nextReady, 10, 300).angleTo(running)).toBeLessThan(1e-7);
    expect(orientation.target(pose(0), new Quaternion(), nextReady, 10, 400)
      .angleTo(reference)).toBeLessThan(.3 * Math.PI / 180);
  });

  it('retains a cold execution anchor as the center after completion', () => {
    const orientation = new TrainingCubeOrientation();
    const start = HOME_ORIENTATION.clone().multiply(turn('y', 25));
    orientation.target(start, new Quaternion(), { phase: 'executing', anchor: start }, 10, 0);
    const ready: TrainingCubeView = { phase: 'ready', anchor: null };
    orientation.target(start.clone().multiply(turn('y', 30)), new Quaternion(), ready, 10, 1000);
    expect(orientation.target(start, new Quaternion(), ready, 10, 1100)
      .angleTo(referenceViewOrientation(10))).toBeLessThan(1e-7);
  });

  it('reinitializes the ready center when Reset Gyro changes the sensor basis', () => {
    const orientation = new TrainingCubeOrientation();
    const ready: TrainingCubeView = { phase: 'ready', anchor: null };
    orientation.target(Object.assign(HOME_ORIENTATION.clone().multiply(turn('y', 40)), { basisVersion: 1 }),
      new Quaternion(), ready, 10, 0);
    expect(orientation.target(Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 2 }),
      new Quaternion(), ready, 10, 100).angleTo(referenceViewOrientation(10))).toBeLessThan(1e-7);
  });

  it('uses the new basis when an execution starts before the first ready render after Reset Gyro', () => {
    const orientation = new TrainingCubeOrientation();
    orientation.target(Object.assign(HOME_ORIENTATION.clone().multiply(turn('y', 40)), { basisVersion: 1 }),
      new Quaternion(), { phase: 'ready', anchor: null }, 10, 0);
    const reset = Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 2 });
    expect(orientation.target(reset, new Quaternion(), { phase: 'executing', anchor: reset }, 10, 100)
      .angleTo(referenceViewOrientation(10))).toBeLessThan(1e-7);
  });

  it.each([-1, 1])('follows large Y turns in direction %i across the heading wrap while retaining X tilt', sign => {
    const orientation = new TrainingCubeOrientation();
    const view: TrainingCubeView = { phase: 'ready', anchor: null };
    orientation.target(HOME_ORIENTATION.clone().multiply(turn('y', sign * 170)), new Quaternion(), view, 10, 0);
    const crossed = HOME_ORIENTATION.clone().multiply(turn('y', -sign * 170));
    expect(orientation.target(crossed, new Quaternion(), view, 10, 100)
      .angleTo(referenceViewOrientation(10).multiply(turn('y', sign * 20)))).toBeLessThan(.1 * Math.PI / 180);
    const far = HOME_ORIENTATION.clone().multiply(turn('y', -sign * 70)).multiply(turn('x', 100));
    expect(orientation.target(far, new Quaternion(), view, 10, 200)
      .angleTo(referenceViewOrientation(10).multiply(turn('y', sign * 120)).multiply(turn('x', 100)))).toBeLessThan(.5 * Math.PI / 180);
  });

  it.each([-1, 1])('follows two complete ready turns in direction %i without a stop or a wrap jump', sign => {
    const orientation = new TrainingCubeOrientation();
    const view: TrainingCubeView = { phase: 'ready', anchor: null };
    const frame = turn('z', 90);
    const referenceInverse = referenceViewOrientation(-25).invert();
    const pose = (degrees: number) => HOME_ORIENTATION.clone().multiply(turn('y', 170 + degrees))
      .multiply(turn('x', 25)).multiply(frame.clone().invert());
    let previous = orientation.target(pose(0), frame, view, -25, 0);
    let accumulated = 0;
    for (let degrees = 6; degrees <= 720; degrees += 6) {
      const raw = pose(sign * degrees);
      // q and -q are the same sensor pose, including across protocol wraps.
      if (degrees % 12 === 0) raw.set(-raw.x, -raw.y, -raw.z, -raw.w);
      const before = raw.clone();
      const shown = orientation.target(raw, frame, view, -25, degrees / 6 * 16);
      const delta = referenceInverse.clone().multiply(shown)
        .multiply(referenceInverse.clone().multiply(previous).invert());
      const yaw = 2 * Math.atan2(delta.y, delta.w);
      const step = Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 180 / Math.PI;
      expect(sign * step).toBeGreaterThan(5.8);
      expect(sign * step).toBeLessThan(6.2);
      expect(shown.angleTo(previous)).toBeLessThan(6.2 * Math.PI / 180);
      expect(raw.equals(before)).toBe(true);
      accumulated += step;
      previous = shown;
    }
    expect(sign * accumulated).toBeGreaterThan(718);
    expect(sign * accumulated).toBeLessThan(722);
    expect(previous.angleTo(referenceViewOrientation(-25).multiply(turn('x', 25)))).toBeLessThan(2 * Math.PI / 180);
  });

  it('recenters at the same rate at different rendering cadences and holds across missing packets', () => {
    const results = [10, 50, 100].map(step => {
      const orientation = new TrainingCubeOrientation();
      const view: TrainingCubeView = { phase: 'ready', anchor: null };
      orientation.target(HOME_ORIENTATION, new Quaternion(), view, 10, 0);
      let shown = new Quaternion();
      const pose = HOME_ORIENTATION.clone().multiply(turn('y', 30));
      for (let at = step; at <= 5000; at += step) shown = orientation.target(pose, new Quaternion(), view, 10, at);
      expect(orientation.target(null, new Quaternion(), view, 10, 60_000).angleTo(shown)).toBeLessThan(1e-7);
      return shown;
    });
    expect(results[0].angleTo(results[1])).toBeLessThan(1e-7);
    expect(results[0].angleTo(results[2])).toBeLessThan(1e-7);
  });

  it.each(['x', 'z'] as const)('keeps live %s tilts between algorithms while removing either sign of heading drift', axis => {
    const frame = turn('z', 90);
    for (const yaw of [-170, -45, 0, 75, 179]) {
      const view = new TrainingCubeOrientation();
      const ready: TrainingCubeView = { phase: 'ready', anchor: null };
      for (const degrees of [-120, -30, 0, 25, 100]) {
        const tilt = turn(axis, degrees);
        const raw = HOME_ORIENTATION.clone().multiply(turn('y', yaw)).multiply(tilt).multiply(frame.clone().invert());
        const before = raw.clone();
        const shown = view.target(raw, frame, ready, 10);
        expect(shown.angleTo(referenceViewOrientation(10).multiply(tilt))).toBeLessThan(1e-7);
        expect(raw.equals(before)).toBe(true);
      }
      expect(view.target(null, new Quaternion(), ready, 25)
        .angleTo(referenceViewOrientation(25).multiply(turn(axis, 100)))).toBeLessThan(1e-7);
    }
  });

  it('preserves a combined diagonal tilt and handles an exactly inverted pose without losing motion', () => {
    const view = new TrainingCubeOrientation();
    const diagonal = new Vector3(1, 0, 1).normalize();
    for (const degrees of [30, 90, 179, 180, 181, 230]) {
      const tilt = new Quaternion().setFromAxisAngle(diagonal, degrees * Math.PI / 180);
      const raw = HOME_ORIENTATION.clone().multiply(turn('y', 60)).multiply(tilt);
      expect(view.target(raw, new Quaternion(), { phase: 'ready', anchor: null }, 10)
        .angleTo(referenceViewOrientation(10).multiply(tilt))).toBeLessThan(1e-7);
    }
  });

  it.each(['x', 'y', 'z'] as const)('follows real %s rotations from a drifted starting pose and changing 2×2 frames', axis => {
    const orientation = new TrainingCubeOrientation();
    const reference = referenceViewOrientation(10);
    const start = HOME_ORIENTATION.clone().multiply(turn('y', 40)).multiply(turn('x', 15));
    const startFrame = turn('z', 90);
    const anchor = Object.assign(start.clone(), { basisVersion: 3 });
    const view: TrainingCubeView = { phase: 'executing', anchor };
    const initial = Object.assign(start.clone().multiply(startFrame.clone().invert()), { basisVersion: 3 });
    const ready = orientation.target(initial, startFrame, { phase: 'ready', anchor: null }, 10);
    expect(ready.angleTo(reference.clone().multiply(turn('x', 15)))).toBeLessThan(1e-7);
    expect(orientation.target(initial, startFrame, view, 10).angleTo(ready)).toBeLessThan(1e-7);
    for (const degrees of [-90, 30, 90]) {
      const frame = turn('y', degrees);
      const relative = turn(axis, degrees);
      const raw = Object.assign(anchor.clone().multiply(relative).multiply(frame.clone().invert()), { basisVersion: 3 });
      const before = raw.clone();
      const displayed = orientation.target(raw, frame, view, 10);
      expect(displayed.angleTo(reference.clone().multiply(turn('x', 15)).multiply(relative))).toBeLessThan(1e-7);
      expect(raw.equals(before)).toBe(true);
    }
    expect(orientation.target(initial, startFrame, { phase: 'ready', anchor: null }, 10).angleTo(ready)).toBeLessThan(1e-7);
  });

  it('honors a gyro reset during execution and continues motion from the new reference', () => {
    const orientation = new TrainingCubeOrientation();
    const anchor = Object.assign(HOME_ORIENTATION.clone().multiply(turn('y', 30)), { basisVersion: 1 });
    const view: TrainingCubeView = { phase: 'executing', anchor };
    const running = Object.assign(anchor.clone().multiply(turn('z', 40)), { basisVersion: 1 });
    const before = orientation.target(running, new Quaternion(), view, 10);
    expect(orientation.target(null, new Quaternion(), view, 10).angleTo(before)).toBeLessThan(1e-7);
    const reset = Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 2 });
    const reference = referenceViewOrientation(10);
    expect(before.angleTo(reference)).toBeGreaterThan(.5);
    expect(orientation.target(reset, new Quaternion(), view, 10).angleTo(reference)).toBeLessThan(1e-7);
    const next = Object.assign(reset.clone().multiply(turn('x', 20)), { basisVersion: 2 });
    const expected = reference.clone().multiply(turn('x', 20));
    expect(orientation.target(next, new Quaternion(), view, 10).angleTo(expected)).toBeLessThan(1e-7);
    expect(orientation.target(next, new Quaternion(), { phase: 'ready', anchor: null }, 10)
      .angleTo(expected)).toBeLessThan(1e-7);
  });

  it.each([-25, 0, 25])('keeps the new basis motion and sticker frame after a reset at view angle %i', angle => {
    const orientation = new TrainingCubeOrientation();
    const frame = turn('y', 90).multiply(turn('z', -90));
    const anchor = Object.assign(HOME_ORIENTATION.clone().multiply(turn('y', 40)), { basisVersion: 1 });
    const view: TrainingCubeView = { phase: 'executing', anchor };
    const initial = Object.assign(anchor.clone().multiply(frame.clone().invert()), { basisVersion: 1 });
    orientation.target(initial, frame, view, angle, 0);
    // The renderer may first see the new reference after the cube has moved again.
    const movement = turn('y', 15).multiply(turn('x', 20));
    const reset = Object.assign(HOME_ORIENTATION.clone().multiply(movement), { basisVersion: 2 });
    const expected = referenceViewOrientation(angle).multiply(movement).multiply(frame);
    const before = reset.clone();
    expect(orientation.target(reset, frame, view, angle, 100).angleTo(expected)).toBeLessThan(1e-7);
    expect(reset.equals(before)).toBe(true);
    expect(orientation.target(reset, frame, { phase: 'ready', anchor: null }, angle, 110)
      .angleTo(expected)).toBeLessThan(1e-7);
    // Resetting a second time must also discard the preceding view offset.
    const second = Object.assign(HOME_ORIENTATION.clone(), { basisVersion: 3 });
    expect(orientation.target(second, frame, view, angle, 200)
      .angleTo(referenceViewOrientation(angle).multiply(frame))).toBeLessThan(1e-7);
  });

  it('changes the configured view angle without changing the execution anchor or physical delta', () => {
    const orientation = new TrainingCubeOrientation();
    const anchor = HOME_ORIENTATION.clone().multiply(turn('y', -35));
    const view: TrainingCubeView = { phase: 'executing', anchor };
    const delta = turn('y', 60).multiply(turn('x', 20));
    const raw = anchor.clone().multiply(delta);
    orientation.target(raw, new Quaternion(), view, 10);
    expect(orientation.target(raw, new Quaternion(), view, 35)
      .angleTo(referenceViewOrientation(35).multiply(delta))).toBeLessThan(1e-7);
  });

  it('keeps absolute tracking outside training and live tilt with an unavailable execution anchor', () => {
    const orientation = new TrainingCubeOrientation();
    const raw = HOME_ORIENTATION.clone().multiply(turn('x', 30));
    expect(orientation.target(raw, new Quaternion(), { phase: 'free', anchor: null }, 10)
      .angleTo(referenceViewOrientation(10).multiply(turn('x', 30)))).toBeLessThan(1e-7);
    orientation.target(raw, new Quaternion(), { phase: 'executing', anchor: HOME_ORIENTATION }, 10);
    // A missing starting frame must not freeze otherwise valid tilt packets.
    expect(orientation.target(raw, new Quaternion(), { phase: 'executing', anchor: null }, 10)
      .angleTo(referenceViewOrientation(10).multiply(turn('x', 30)))).toBeLessThan(1e-7);
  });
});
