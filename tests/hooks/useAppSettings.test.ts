import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppSettings } from '../../src/hooks/useAppSettings';

describe('useAppSettings', () => {
  it('defaults the view angle to 0 degrees and remembers slider changes', () => {
    const hook = renderHook(() => useAppSettings());
    expect(hook.result.current.viewAngleDeg).toBe(0);
    act(() => hook.result.current.setViewAngleDeg(28));
    expect(localStorage.getItem('viewAngleDeg')).toBe('28');
    hook.unmount();
    expect(renderHook(() => useAppSettings()).result.current.viewAngleDeg).toBe(28);
  });

  it('persists a negative view angle for inspecting the left side', () => {
    const hook = renderHook(() => useAppSettings());
    act(() => hook.result.current.setViewAngleDeg(-25));
    expect(localStorage.getItem('viewAngleDeg')).toBe('-25');
    hook.unmount();
    expect(renderHook(() => useAppSettings()).result.current.viewAngleDeg).toBe(-25);
  });

  it.each([['', 0], ['invalid', 0], ['-20', -20], ['-999', -45], ['999', 45], ['0', 0]])(
    'validates the saved view angle %s as %i', (saved, expected) => {
      localStorage.setItem('viewAngleDeg', saved);
      const hook = renderHook(() => useAppSettings());
      expect(hook.result.current.viewAngleDeg).toBe(expected);
      act(() => hook.result.current.setViewAngleDeg(Number.NaN));
      expect(hook.result.current.viewAngleDeg).toBe(0);
    });

  it('enables gyro drift correction by default and remembers opting out', () => {
    const hook = renderHook(() => useAppSettings());
    expect(hook.result.current.autoCorrectGyroDrift).toBe(true);
    act(() => hook.result.current.setAutoCorrectGyroDrift(false));
    expect(localStorage.getItem('autoCorrectGyroDrift')).toBe('false');
    hook.unmount();
    expect(renderHook(() => useAppSettings()).result.current.autoCorrectGyroDrift).toBe(false);
  });

  it('disables alternative algorithms by default and remembers enabling them', () => {
    const hook = renderHook(() => useAppSettings());
    expect(hook.result.current.allowAlternativeAlgorithms).toBe(false);
    act(() => hook.result.current.setAllowAlternativeAlgorithms(true));
    expect(localStorage.getItem('allowAlternativeAlgorithms')).toBe('true');
    hook.unmount();
    const next = renderHook(() => useAppSettings());
    expect(next.result.current.allowAlternativeAlgorithms).toBe(true);
  });

  it('matches the virtual cube on recovery by default and remembers opting out', () => {
    const hook = renderHook(() => useAppSettings());
    expect(hook.result.current.matchVirtualCubeOnRecovery).toBe(true);
    act(() => hook.result.current.setMatchVirtualCubeOnRecovery(false));
    expect(localStorage.getItem('matchVirtualCubeOnRecovery')).toBe('false');
    hook.unmount();
    const next = renderHook(() => useAppSettings());
    expect(next.result.current.matchVirtualCubeOnRecovery).toBe(false);
  });

  it('keeps guided setup as the default and remembers expert scrambler across sessions', () => {
    const hook = renderHook(() => useAppSettings());
    expect(hook.result.current.expertScrambler).toBe(false);
    act(() => hook.result.current.setExpertScrambler(true));
    expect(localStorage.getItem('expertScrambler')).toBe('true');
    hook.unmount();
    const next = renderHook(() => useAppSettings());
    expect(next.result.current.expertScrambler).toBe(true);
  });

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

    const { result } = renderHook(() => useAppSettings());

    expect(result.current.visualization).toBe('2D');
    expect(result.current.backview).toBe('side-by-side');
    expect(result.current.hintFacelets).toBe('floating');
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

  it('defaults recent times to graph and persists list mode', async () => {
    const { result } = renderHook(() => useAppSettings());

    expect(result.current.showTimesInsteadOfGraph).toBe(false);

    act(() => {
      result.current.setShowTimesInsteadOfGraph(true);
    });

    await waitFor(() => {
      expect(result.current.showTimesInsteadOfGraph).toBe(true);
      expect(localStorage.getItem('showTimesInsteadOfGraph')).toBe('true');
    });
  });

  it('loads recent times list mode from persisted storage', () => {
    localStorage.setItem('showTimesInsteadOfGraph', 'true');

    const { result } = renderHook(() => useAppSettings());

    expect(result.current.showTimesInsteadOfGraph).toBe(true);
  });
});
