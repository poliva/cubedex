import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { solvedPattern } from '../../src/lib/cube-utils';
import { guidanceFrameRotation, guidanceGripRotation, HOME_ORIENTATION, tableFrameRotation } from '../../src/lib/cube-orientation';

const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(x =>
  ['', 'y', 'y2', "y'"].map(y => `${x} ${y}`.trim()));

it.each(rotations)('establishes a 2×2 table frame from exact solved stickers under %s', async rotation => {
  const solved = await solvedPattern(2);
  const device = solved.applyAlg(rotation);
  expect(tableFrameRotation(device)!.angleTo(guidanceFrameRotation(solved, device)!)).toBeLessThan(1e-5);
  expect(tableFrameRotation(device.applyMove('U'))).toBeNull();
});

describe.each([2, 3] as const)('%i× physical guidance orientation', size => {
  it.each(rotations)('recognizes the exact pictured grip %s from the connection reference', async rotation => {
    const sensor = (await solvedPattern(size)).applyAlg('R F2 U');
    const picture = sensor.applyAlg(rotation);
    const frame = guidanceFrameRotation(sensor, picture)!;
    expect(frame).not.toBeNull();
    const gyro = HOME_ORIENTATION.clone().multiply(frame);
    const aligned = guidanceGripRotation(gyro, frame)!;
    expect(aligned.angle).toBeLessThan(1e-5);
    expect(new Quaternion(aligned.visualQuaternion.x, aligned.visualQuaternion.y,
      aligned.visualQuaternion.z, aligned.visualQuaternion.w).angleTo(new Quaternion())).toBeLessThan(1e-5);
    // Moving a layer changes the picture's stickers, not the required grip.
    const progressed = sensor.applyMove('U');
    expect(guidanceFrameRotation(progressed, progressed.applyAlg(rotation))!.angleTo(frame)).toBeLessThan(1e-5);
  });
});

it.each(rotations)('agrees with actual sticker colors for the rendered rotation %s', async rotation => {
  const solved = await solvedPattern(3);
  const picture = solved.applyAlg(rotation);
  const frame = guidanceFrameRotation(solved, picture)!;
  const directions = [new Vector3(0, 1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1),
    new Vector3(0, -1, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, -1)];
  const centerOrder = 'ULFRBD';
  for (let i = 0; i < directions.length; i++) {
    const rotated = directions[i].clone().applyQuaternion(frame);
    const destination = directions.findIndex(direction => direction.distanceTo(rotated) < 1e-5);
    expect(destination).toBeGreaterThanOrEqual(0);
    expect(picture.patternData.CENTERS.pieces[centerOrder.indexOf('URFDLB'[destination])]).toBe(centerOrder.indexOf('URFDLB'[i]));
  }
});

it.each([
  ['x', 90, 'Tilt the top of the cube away from you.'],
  ['x', -90, 'Tilt the top of the cube toward you.'],
  ['y', 90, 'Turn the front of the cube to your left.'],
  ['y', -90, 'Turn the front of the cube to your right.'],
  ['z', 90, 'Roll the top of the cube to your right.'],
  ['z', -90, 'Roll the top of the cube to your left.'],
  ['y', 180, 'Turn the whole cube around.'],
] as const)('gives an undo direction for a physical %s rotation of %i°', (axis, degrees, instruction) => {
  const normal = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const gyro = HOME_ORIENTATION.clone().multiply(new Quaternion().setFromAxisAngle(normal, degrees * Math.PI / 180));
  const result = guidanceGripRotation(gyro, new Quaternion())!;
  expect(result.angle).toBeCloseTo(Math.abs(degrees));
  expect(result.axis).toBe(axis);
  expect(result.instruction).toBe(instruction);
  expect(result.direction).toBe(degrees > 0 ? -1 : 1);
  const oppositeSign = { x: -gyro.x, y: -gyro.y, z: -gyro.z, w: -gyro.w };
  const equivalent = guidanceGripRotation(oppositeSign, new Quaternion())!;
  expect(equivalent.instruction).toBe(result.instruction);
  expect(equivalent.direction).toBe(result.direction);
  expect(equivalent.angle).toBeCloseTo(result.angle);
  expect(new Quaternion(equivalent.visualQuaternion.x, equivalent.visualQuaternion.y, equivalent.visualQuaternion.z,
    equivalent.visualQuaternion.w).angleTo(new Quaternion(result.visualQuaternion.x, result.visualQuaternion.y,
      result.visualQuaternion.z, result.visualQuaternion.w))).toBeLessThan(1e-5);
});

it('compares compound poses in the same visible frame as the expected stickers', async () => {
  const sensor = (await solvedPattern(2)).applyAlg('R F U');
  const frame = guidanceFrameRotation(sensor, sensor.applyAlg('x y'))!;
  const error = new Quaternion().setFromEuler(new Euler(.4, -.8, .2));
  const gyro = HOME_ORIENTATION.clone().multiply(error).multiply(frame);
  const result = guidanceGripRotation(gyro, frame)!;
  const shown = new Quaternion(result.visualQuaternion.x, result.visualQuaternion.y, result.visualQuaternion.z, result.visualQuaternion.w);
  expect(shown.angleTo(error)).toBeLessThan(1e-5);
});

it('does not infer a grip from mismatched stickers, puzzle sizes, or invalid gyro readings', async () => {
  const sensor = await solvedPattern(3);
  expect(guidanceFrameRotation(sensor, sensor.applyMove('R'))).toBeNull();
  expect(guidanceFrameRotation(sensor, await solvedPattern(2))).toBeNull();
  expect(guidanceGripRotation({ x: 0, y: 0, z: 0, w: 0 }, new Quaternion())).toBeNull();
  expect(guidanceGripRotation({ x: NaN, y: 0, z: 0, w: 1 }, new Quaternion())).toBeNull();
});
