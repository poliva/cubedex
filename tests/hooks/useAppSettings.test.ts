import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppSettings } from '../../src/hooks/useAppSettings';

describe('useAppSettings', () => {
  it('detects the initial theme from stored options and persists dark mode changes', async () => {
    localStorage.setItem('theme', 'dark');

    const { result } = renderHook(() => useAppSettings());

    expect(result.current.darkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.setDarkMode(false);
    });

    await waitFor(() => {
      expect(localStorage.getItem('theme')).toBe('light');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('forces whiteOnBottom off when full stickering is disabled', async () => {
    const { result } = renderHook(() => useAppSettings());

    act(() => {
      result.current.setFullStickering(true);
      result.current.setWhiteOnBottom(true);
    });

    expect(result.current.whiteOnBottom).toBe(true);

    act(() => {
      result.current.setFullStickering(false);
    });

    await waitFor(() => {
      expect(result.current.whiteOnBottom).toBe(false);
      expect(localStorage.getItem('whiteOnBottom')).toBe('false');
    });
  });

  it('clamps cube size from persisted values and setter updates', async () => {
    localStorage.setItem('cubeSizePx', '999');

    const { result } = renderHook(() => useAppSettings());

    expect(result.current.cubeSizePx).toBe(600);

    act(() => {
      result.current.setCubeSizePx(1);
    });

    await waitFor(() => {
      expect(result.current.cubeSizePx).toBe(240);
      expect(localStorage.getItem('cubeSizePx')).toBe('240');
    });
  });

  it('loads non-default partner options from persisted storage', () => {
    localStorage.setItem('visualization', '2D');
    localStorage.setItem('backview', 'side-by-side');
    localStorage.setItem('hintFacelets', 'floating');
    localStorage.setItem('control-panel', 'bottom-row');

    const { result } = renderHook(() => useAppSettings());

    expect(result.current.visualization).toBe('2D');
    expect(result.current.backview).toBe('side-by-side');
    expect(result.current.hintFacelets).toBe('floating');
    expect(result.current.controlPanel).toBe('bottom-row');
  });

  it('defaults countdown mode off and persists changes', async () => {
    const { result } = renderHook(() => useAppSettings());

    expect(result.current.countdownMode).toBe(false);

    act(() => {
      result.current.setCountdownMode(true);
    });

    await waitFor(() => {
      expect(result.current.countdownMode).toBe(true);
      expect(localStorage.getItem('countdownMode')).toBe('true');
    });
  });

  it('defaults auto learning state on and persists changes', async () => {
    const { result } = renderHook(() => useAppSettings());

    expect(result.current.autoUpdateLearningState).toBe(true);

    act(() => {
      result.current.setAutoUpdateLearningState(false);
    });

    await waitFor(() => {
      expect(result.current.autoUpdateLearningState).toBe(false);
      expect(localStorage.getItem('autoUpdateLearningState')).toBe('false');
    });
  });
});
