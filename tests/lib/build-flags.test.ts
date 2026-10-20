import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([
  [false, undefined, false],
  [false, 'false', false],
  [false, '1', false],
  [false, 'true', true],
  [true, undefined, true],
  [true, 'false', true],
] as const)('enables gyro testing for DEV=%s and VITE_GYRO_TESTING=%s: %s', async (dev, flag, expected) => {
  vi.stubEnv('DEV', dev);
  vi.stubEnv('VITE_GYRO_TESTING', flag);
  vi.resetModules();
  expect((await import('../../src/lib/build-flags')).GYRO_TESTING_ENABLED).toBe(expected);
});
