import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePracticeToggles } from '../../src/hooks/usePracticeToggles';

describe('usePracticeToggles', () => {
  it('turns slow cases off when random order is enabled', () => {
    const { result } = renderHook(() => usePracticeToggles());

    act(() => {
      result.current.setPrioritizeSlowCases(true);
    });
    expect(result.current.prioritizeSlowCases).toBe(true);

    act(() => {
      result.current.setRandomOrder(true);
    });

    expect(result.current.randomOrder).toBe(true);
    expect(result.current.prioritizeSlowCases).toBe(false);
  });

  it('turns random order off when slow cases are enabled', () => {
    const { result } = renderHook(() => usePracticeToggles());

    act(() => {
      result.current.setRandomOrder(true);
    });
    expect(result.current.randomOrder).toBe(true);

    act(() => {
      result.current.setPrioritizeSlowCases(true);
    });

    expect(result.current.prioritizeSlowCases).toBe(true);
    expect(result.current.randomOrder).toBe(false);
  });

  it('updates the independent toggles directly', () => {
    const { result } = renderHook(() => usePracticeToggles());

    act(() => {
      result.current.setRandomizeAUF(true);
      result.current.setTimeAttack(true);
      result.current.setPrioritizeFailedCases(true);
    });

    expect(result.current.randomizeAUF).toBe(true);
    expect(result.current.timeAttack).toBe(true);
    expect(result.current.prioritizeFailedCases).toBe(true);
  });
});
