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
    expect(result.current.smartReviewScheduling).toBe(false);
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

  it('turns random order and slow cases off when smart order is enabled', () => {
    const { result } = renderHook(() => usePracticeToggles());

    act(() => {
      result.current.setRandomOrder(true);
      result.current.setPrioritizeSlowCases(true);
      result.current.setSmartReviewScheduling(true);
    });

    expect(result.current.smartReviewScheduling).toBe(true);
    expect(result.current.randomOrder).toBe(false);
    expect(result.current.prioritizeSlowCases).toBe(false);
  });

  it('turns smart order off when time attack is enabled', () => {
    const { result } = renderHook(() => usePracticeToggles());

    act(() => {
      result.current.setSmartReviewScheduling(true);
      result.current.setTimeAttack(true);
    });

    expect(result.current.timeAttack).toBe(true);
    expect(result.current.smartReviewScheduling).toBe(false);
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
