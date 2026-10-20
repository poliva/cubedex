import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { useGuidanceOrientation } from '../../src/hooks/useGuidanceOrientation';
import type { SmartcubeConnectionState } from '../../src/hooks/useSmartcubeConnection';
import { HOME_ORIENTATION } from '../../src/lib/cube-orientation';
import { solvedPattern } from '../../src/lib/cube-utils';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const pose = (angle: number, axis: 'x' | 'y' | 'z' = 'y') => HOME_ORIENTATION.clone().multiply(
  new Quaternion().setFromAxisAngle(new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), angle * Math.PI / 180));

async function fixture() {
  const pattern = (await solvedPattern(2)).applyAlg('R U F');
  const smartcube = { connected: true, gyroSupported: true, cubeQuaternionRef: { current: pose(0) } } as unknown as SmartcubeConnectionState;
  return { pattern, smartcube };
}

it('detects gyro-only changes and clears the warning without any layer turn or React input update', async () => {
  const { pattern, smartcube } = await fixture();
  const { result, unmount } = renderHook(() => useGuidanceOrientation(smartcube, pattern, pattern));
  expect(result.current?.misaligned).toBe(false);
  smartcube.cubeQuaternionRef.current = pose(90);
  act(() => vi.advanceTimersByTime(699));
  expect(result.current?.misaligned).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current?.misaligned).toBe(true);
  expect(result.current?.rotation.instruction).toMatch(/left/);
  smartcube.cubeQuaternionRef.current = pose(0);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['x', 'y', 'z'] as const)('allows sustained ordinary tilts around %s', async axis => {
  const { pattern, smartcube } = await fixture();
  const { result } = renderHook(() => useGuidanceOrientation(smartcube, pattern, pattern));
  for (const angle of [30, -40, 50, -59]) {
    smartcube.cubeQuaternionRef.current = pose(angle, axis);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current?.misaligned).toBe(false);
  }
});

it('ignores brief regrips, restarts the delay after a tilt, and clears without exact alignment', async () => {
  const { pattern, smartcube } = await fixture();
  const { result } = renderHook(() => useGuidanceOrientation(smartcube, pattern, pattern));
  smartcube.cubeQuaternionRef.current = pose(90);
  act(() => vi.advanceTimersByTime(400));
  expect(result.current?.misaligned).toBe(false);
  smartcube.cubeQuaternionRef.current = pose(50);
  act(() => vi.advanceTimersByTime(500));
  expect(result.current?.misaligned).toBe(false);
  smartcube.cubeQuaternionRef.current = pose(90);
  act(() => vi.advanceTimersByTime(600));
  expect(result.current?.misaligned).toBe(false);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(true);
  smartcube.cubeQuaternionRef.current = pose(50);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(true);
  smartcube.cubeQuaternionRef.current = pose(39);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(false);
});

it('uses the white-up/green-front reference immediately and follows Reset Gyro', async () => {
  const { pattern, smartcube } = await fixture();
  smartcube.cubeQuaternionRef.current = pose(90);
  const { result } = renderHook(() => useGuidanceOrientation(smartcube, pattern, pattern));
  act(() => vi.advanceTimersByTime(600));
  expect(result.current?.misaligned).toBe(true);
  smartcube.cubeQuaternionRef.current = null;
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBeNull();
  smartcube.cubeQuaternionRef.current = { x: HOME_ORIENTATION.x, y: HOME_ORIENTATION.y,
    z: HOME_ORIENTATION.z, w: HOME_ORIENTATION.w, basisVersion: 2 };
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(false);
});

it('keeps detecting a wrong grip while rapid layer turns replace the sticker snapshots', async () => {
  const { pattern, smartcube } = await fixture();
  smartcube.cubeQuaternionRef.current = pose(90);
  const { result, rerender } = renderHook(({ current }) => useGuidanceOrientation(smartcube, current, current),
    { initialProps: { current: pattern } });
  act(() => vi.advanceTimersByTime(100));
  rerender({ current: pattern.applyMove('R') });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.misaligned).toBe(false);
  rerender({ current: pattern.applyAlg('R U') });
  act(() => vi.advanceTimersByTime(400));
  expect(result.current?.misaligned).toBe(true);
  rerender({ current: pattern.applyAlg('R U') });
  expect(result.current?.misaligned).toBe(true);
});

it('does not claim an orientation when gyro is missing, unsupported, disconnected, or stickers differ', async () => {
  const { pattern, smartcube } = await fixture();
  smartcube.cubeQuaternionRef.current = null;
  const { result, rerender } = renderHook(({ supported, connected, picture }) =>
    useGuidanceOrientation({ ...smartcube, gyroSupported: supported, connected }, pattern, picture),
  { initialProps: { supported: true, connected: true, picture: pattern } });
  expect(result.current).toBeNull();
  smartcube.cubeQuaternionRef.current = pose(90);
  rerender({ supported: false, connected: true, picture: pattern });
  act(() => vi.advanceTimersByTime(400));
  expect(result.current).toBeNull();
  rerender({ supported: true, connected: false, picture: pattern });
  expect(result.current).toBeNull();
  rerender({ supported: true, connected: true, picture: pattern.applyMove('R') });
  expect(result.current).toBeNull();
});
