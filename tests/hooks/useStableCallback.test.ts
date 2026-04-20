import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStableCallback } from '../../src/hooks/useStableCallback';

describe('useStableCallback', () => {
  it('keeps a stable function identity while calling the latest callback', () => {
    const first = vi.fn((value: number) => value + 1);
    const second = vi.fn((value: number) => value + 2);

    const { result, rerender } = renderHook(({ callback }: { callback: (value: number) => number }) => useStableCallback(callback), {
      initialProps: { callback: first },
    });

    const stableCallback = result.current;
    expect(stableCallback(1)).toBe(2);
    expect(first).toHaveBeenCalledWith(1);

    rerender({ callback: second });

    expect(result.current).toBe(stableCallback);
    expect(result.current(1)).toBe(3);
    expect(second).toHaveBeenCalledWith(1);
  });
});
