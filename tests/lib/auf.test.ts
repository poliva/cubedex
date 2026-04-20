import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareTrainingAlgorithm } from '../../src/lib/auf';

describe('prepareTrainingAlgorithm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the original algorithm when random AUF is disabled', async () => {
    const result = await prepareTrainingAlgorithm(['R', 'U', "R'"], 'PLL', false);

    expect(result).toEqual({
      displayAlgorithm: "R U R'",
      moves: ['R', 'U', "R'"],
      originalMoves: ['R', 'U', "R'"],
    });
  });

  it('uses scramble-to moves when random AUF is enabled for scramble mode', async () => {
    const result = await prepareTrainingAlgorithm(['R', 'U', "R'"], 'PLL', true, ['U2', 'R2']);

    expect(result).toEqual({
      displayAlgorithm: 'U2 R2',
      moves: ['U2', 'R2'],
      originalMoves: ['R', 'U', "R'"],
    });
  });

  it('adds deterministic AUF moves for PLL cases', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.74);

    const result = await prepareTrainingAlgorithm(['R', 'U', "R'"], 'PLL', true);

    expect(result.originalMoves).toEqual(['R', 'U', "R'"]);
    expect(result.displayAlgorithm.endsWith('U2')).toBe(true);
    expect(result.moves.at(-1)).toBe('U2');
  });
});
