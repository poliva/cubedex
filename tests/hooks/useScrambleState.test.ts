import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/cube-utils', () => ({
  solvedPattern: vi.fn(async () => ({ kind: 'solved-pattern' })),
}));

vi.mock('../../src/lib/scramble', () => ({
  getScrambleToSolution: vi.fn(),
}));

vi.mock('../../src/lib/auf', () => ({
  prepareTrainingAlgorithm: vi.fn(),
}));

import { useScrambleState } from '../../src/hooks/useScrambleState';
import { prepareTrainingAlgorithm } from '../../src/lib/auf';
import { getScrambleToSolution } from '../../src/lib/scramble';

const mockedGetScrambleToSolution = vi.mocked(getScrambleToSolution);
const mockedPrepareTrainingAlgorithm = vi.mocked(prepareTrainingAlgorithm);

describe('useScrambleState', () => {
  beforeEach(() => {
    mockedGetScrambleToSolution.mockReset();
    mockedPrepareTrainingAlgorithm.mockReset();
    mockedPrepareTrainingAlgorithm.mockResolvedValue({
      displayAlgorithm: "U R U R'",
      moves: ['U', 'R', 'U', "R'"],
      originalMoves: ['R', 'U', "R'"],
    });
  });

  it('returns false and clears state for blank scramble requests', async () => {
    const { result } = renderHook(() => useScrambleState());

    await act(async () => {
      await expect(result.current.startScrambleTo('   ', null)).resolves.toBe(false);
    });

    expect(result.current.scrambleMode).toBe(false);
    expect(result.current.scrambleText).toBe('');
    expect(result.current.targetAlgorithm).toBe('');
    expect(result.current.helpTone).toBe('hidden');
  });

  it('starts scramble mode and uses the prepared algorithm when random AUF is enabled', async () => {
    mockedGetScrambleToSolution.mockResolvedValue('R U');

    const { result } = renderHook(() => useScrambleState());

    await act(async () => {
      await expect(
        result.current.startScrambleTo("R U R'", { category: 'PLL' } as never, null, true),
      ).resolves.toBe(true);
    });

    expect(mockedPrepareTrainingAlgorithm).toHaveBeenCalledWith(['R', 'U', "R'"], 'PLL', true);
    expect(result.current.scrambleMode).toBe(true);
    expect(result.current.scrambleText).toBe('R U');
    expect(result.current.targetAlgorithm).toBe("U R U R'");
    expect(result.current.isComputing).toBe(false);
  });

  it('advances scramble progress and completes when no moves remain', async () => {
    mockedGetScrambleToSolution
      .mockResolvedValueOnce('R')
      .mockResolvedValueOnce('');

    const { result } = renderHook(() => useScrambleState());

    await act(async () => {
      await result.current.startScrambleTo("R U R'", null, null, false);
    });

    await act(async () => {
      await expect(result.current.advanceScramble('R', {} as never)).resolves.toBe(true);
    });

    expect(result.current.scrambleMode).toBe(false);
    expect(result.current.scrambleText).toBe('');
    expect(result.current.targetAlgorithm).toBe('');
    expect(result.current.helpTone).toBe('hidden');
  });

  it('shows green help when the recomputed scramble grows', async () => {
    mockedGetScrambleToSolution
      .mockResolvedValueOnce('R U')
      .mockResolvedValueOnce('R U F');

    const { result } = renderHook(() => useScrambleState());

    await act(async () => {
      await result.current.startScrambleTo("R U R'", null, null, false);
    });

    await act(async () => {
      await expect(result.current.advanceScramble('R', {} as never)).resolves.toBe(false);
    });

    expect(result.current.scrambleText).toBe('U');
    expect(result.current.helpTone).toBe('green');
  });

  it('clears scramble state explicitly', async () => {
    mockedGetScrambleToSolution.mockResolvedValue('R U');

    const { result } = renderHook(() => useScrambleState());

    await act(async () => {
      await result.current.startScrambleTo("R U R'", null, null, false);
    });

    act(() => {
      result.current.clearScramble();
    });

    expect(result.current.scrambleMode).toBe(false);
    expect(result.current.scrambleText).toBe('');
    expect(result.current.targetAlgorithm).toBe('');
  });
});
