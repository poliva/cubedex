import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import { prepareTrainingAlgorithm } from '../../src/lib/auf';
import defaults from '../../src/data/defaultAlgs.json';
import { puzzleLoader } from '../../src/lib/puzzles';

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

  const symmetricCases = [
    { category: 'OLL', name: 'OLL-21 H / Cross', puzzle: '3x3x3' },
    { category: 'OLL', name: 'OLL-20 X', puzzle: '3x3x3' },
    { category: '2x2x2:OLL', name: 'H', puzzle: '2x2x2' },
    { category: 'PLL', name: 'H Perm', puzzle: '3x3x3' },
  ] as const;
  const aufChoices = [
    { auf: 'U', random: 0 },
    { auf: "U'", random: 0.3 },
    { auf: 'U2', random: 0.6 },
    { auf: '', random: 0.9 },
  ];

  it.each(symmetricCases.flatMap(testCase => aufChoices.map(choice => ({ ...testCase, ...choice }))))(
    'allows pre-AUF "$auf" for $name on $puzzle', async ({ category, name, puzzle, auf, random }) => {
      const algorithm = defaults[category].flatMap(subset => subset.algorithms).find(alg => alg.name === name)!.algorithm;
      const inputMoves = Alg.fromString(algorithm).expand().toString().split(/\s+/);
      // Keep any PLL post-AUF empty so the resulting setup isolates the pre-AUF.
      vi.spyOn(Math, 'random').mockReturnValueOnce(random).mockReturnValue(0.9);

      const prepared = await prepareTrainingAlgorithm(inputMoves, category, true);

      expect(prepared.moves[0]).toBe(auf || inputMoves[0]);
      expect(prepared.originalMoves).toEqual(inputMoves);
      const solved = (await puzzleLoader(puzzle).kpuzzle()).defaultPattern();
      const originalSetup = solved.applyAlg(Alg.fromString(algorithm).invert());
      const randomizedSetup = solved.applyAlg(Alg.fromString(prepared.displayAlgorithm).invert());
      expect(randomizedSetup.isIdentical(originalSetup.applyAlg(Alg.fromString(auf).invert()))).toBe(true);
    },
  );

  it.each(['PLL', 'ZBLL'])('randomizes post-AUF independently of an empty pre-AUF for %s', async category => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0);

    const result = await prepareTrainingAlgorithm(['R', 'U', "R'"], category, true);

    expect(result.moves).toEqual(['R', 'U', "R'", 'U']);
  });

  it('preserves authored slice and wide-turn sequences when adding AUF', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const moves = ['r', 'U', "r'", 'R', 'U', "R'", "U'", 'r', "U'", "r'"];
    const result = await prepareTrainingAlgorithm(moves, 'OLL', true);
    expect(result.moves).toEqual(['U', ...moves]);
  });

  it.each(['2x2x2', '3x3x3'] as const)('reduces boundary AUFs modulo four on %s without changing the body', async puzzle => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const result = await prepareTrainingAlgorithm(['U2', 'R', 'U', "R'"], 'OLL', true, [], puzzle);
    expect(result.moves).toEqual(['R', 'U', "R'"]);
    expect(result.displayAlgorithm).not.toMatch(/U[34]/);
  });
});
