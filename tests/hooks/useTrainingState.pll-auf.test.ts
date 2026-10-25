import { act, renderHook } from '@testing-library/react';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { describe, expect, it, vi } from 'vitest';
import defaults from '../../src/data/defaultAlgs.json';
import { useTrainingState, type TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation } from '../../src/lib/scramble';
import { getAttemptHistory } from '../../src/lib/storage';
import { trailingWholeCubeRotationMoveCount } from '../../src/lib/move-helpers';
import { selectedCases } from './useTrainingStateTestUtils';

const options: TrainingPracticeOptions = {
  selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: true,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};
const aufChoices = [
  { auf: '', random: 0.9, turns: 0 },
  { auf: 'U', random: 0, turns: 1 },
  { auf: 'U2', random: 0.6, turns: 2 },
  { auf: "U'", random: 0.3, turns: 3 },
];
const pllCases = defaults.PLL.flatMap(subset => subset.algorithms);
const packets = (algorithm: string) => new Alg(algorithm).expand().toString().split(/\s+/).filter(Boolean)
  .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);

describe('PLL AUF symmetry', () => {
  const scenarios = ['Na Perm', 'Nb Perm', 'H Perm', 'Z Perm', 'E Perm'].flatMap(name =>
    aufChoices.flatMap(pre => aufChoices.flatMap(post =>
      aufChoices.filter(actual => !['Z Perm', 'E Perm'].includes(name) || actual.turns % 2 === pre.turns % 2)
        .flatMap(actual => [true, false].map(prepared => ({ name, pre, post, actual, prepared }))))));

  it.each(scenarios)('accepts $name: $actual.auf instead of $pre.auf, post $post.auf (prepared $prepared)',
    async ({ name, pre, post, actual, prepared }) => {
      const algorithm = pllCases.find(item => item.name === name)!.algorithm;
      const displayed = new Alg(`${pre.auf} ${algorithm} ${post.auf}`)
        .experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 });
      const solved = await solvedPattern();
      const initial = prepared ? solved.applyAlg(displayed.invert()) : solved.applyAlg('D R B y');
      const target = initial.applyAlg(displayed);
      const afterBody = initial.applyAlg(`${actual.auf} ${algorithm}`);
      const correction = aufChoices.find(choice => fixOrientation(afterBody.applyAlg(choice.auf)).isIdentical(fixOrientation(target)));
      expect(correction).toBeDefined();
      const scope = `pll-auf-${name}-${pre.turns}-${post.turns}-${actual.turns}-${prepared}`;
      const card = { ...selectedCases[0], id: scope, category: 'PLL', name, algorithm };
      const next = { ...selectedCases[1], id: `${scope}-next`, category: 'PLL', algorithm: 'R U' };
      const onGyroTrainingEvent = name === 'E Perm' ? vi.fn() : undefined;
      const { result } = renderHook(() => useTrainingState([card, next], 'PLL', { ...options, onGyroTrainingEvent }));
      vi.spyOn(Math, 'random').mockReturnValueOnce(pre.random).mockReturnValueOnce(post.random).mockReturnValue(0.9);
      await act(async () => { await result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
      expect(initial.applyAlg(result.current.displayAlg).isIdentical(target)).toBe(true);
      const caseAlgorithm = result.current.caseAlgorithm;

      let physical = initial;
      const moves = packets(`${actual.auf} ${algorithm} ${correction!.auf}`);
      const lastMoveIndex = moves.length - 1 - trailingWholeCubeRotationMoveCount(moves);
      for (const [index, move] of moves.entries()) {
        physical = physical.applyMove(move);
        // Regrips change the physical frame without producing face-turn packets.
        if (/^[xyz]/.test(move)) continue;
        let complete = false;
        await act(async () => { complete = result.current.handleSmartcubeMove(fixOrientation(physical), move); });
        expect(complete, `turn ${index + 1}: ${move}`).toBe(index === lastMoveIndex);
        if (!complete) expect(result.current.caseAlgorithm).toBe(caseAlgorithm);
        expect(result.current.recoveryTarget).toBeNull();
        expect(result.current.displayMoves.some(entry => entry.color === 'red'), `turn ${index + 1}: ${move}`).toBe(false);
        if (name === 'H Perm' && pre.turns === 3 && post.turns === 1 && actual.turns === 0 && index === 0) {
          await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
          expect(result.current.fixVisible).toBe(false);
          expect(result.current.failedCounts[scope]).toBeUndefined();
        }
      }
      expect(fixOrientation(physical).isIdentical(fixOrientation(target))).toBe(true);
      if (prepared) expect(fixOrientation(physical).isIdentical(solved)).toBe(true);
      expect(getAttemptHistory(scope)).toHaveLength(1);
      expect(getAttemptHistory(scope)[0].hadMistake).toBe(false);
      expect(result.current.practiceCounts[scope]).toBe(1);
      if (onGyroTrainingEvent) expect(onGyroTrainingEvent.mock.calls.some(([event]) => event.phase === 'cancel')).toBe(false);
      expect(result.current.currentCase?.id).toBe(next.id);
      expect(fixOrientation(result.current.caseStartPattern!).isIdentical(fixOrientation(physical))).toBe(true);
    });

  it.each(['Z Perm', 'T Perm', 'E Perm'])('rejects a quarter-turn change of starting AUF for %s', async name => {
    const algorithm = pllCases.find(item => item.name === name)!.algorithm;
    const scope = `pll-auf-invalid-${name}`;
    const card = { ...selectedCases[0], id: scope, category: 'PLL', name, algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'PLL', options));
    const initial = await solvedPattern();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValue(0.9);
    await act(async () => { await result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
    let physical = result.current.caseStartPattern!;
    let reported = 0;
    for (const move of packets(algorithm)) {
      physical = physical.applyMove(move);
      if (/^[xyz]/.test(move)) continue;
      await act(async () => { result.current.handleSmartcubeMove(fixOrientation(physical), move); });
      if (++reported === 2) break;
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(result.current.fixVisible).toBe(true);
    expect(result.current.failedCounts[scope]).toBe(1);
    expect(getAttemptHistory(scope)).toHaveLength(0);
  });

  it.each([
    { name: 'H Perm', pre: aufChoices[3], post: aufChoices[0], turns: ['U', 'U', 'U'] },
    { name: 'H Perm', pre: aufChoices[3], post: aufChoices[2], turns: ["U'", "U'", "U'"] },
    { name: 'H Perm', pre: aufChoices[3], post: aufChoices[3], turns: ["U'", "U'"] },
    { name: 'E Perm', pre: aufChoices[2], post: aufChoices[0], turns: ["U'", "U'"] },
    { name: 'E Perm', pre: aufChoices[2], post: aufChoices[1], turns: ['U', 'U', 'U'] },
    { name: 'E Perm', pre: aufChoices[2], post: aufChoices[3], turns: ["U'", "U'", "U'"] },
  ])('accepts $turns for $name final AUF after skipping $pre.auf (post $post.auf)', async ({ name, pre, post, turns }) => {
    const algorithm = pllCases.find(item => item.name === name)!.algorithm;
    const solved = await solvedPattern();
    const initial = solved.applyAlg(new Alg(`${pre.auf} ${algorithm} ${post.auf}`).invert());
    const scope = `pll-final-auf-${name}-${post.turns}`;
    const card = { ...selectedCases[0], id: scope, category: 'PLL', algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'PLL', options));
    vi.spyOn(Math, 'random').mockReturnValueOnce(pre.random).mockReturnValueOnce(post.random).mockReturnValue(0.9);
    await act(async () => { await result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
    let physical = initial;
    const body = packets(algorithm);
    const moves = [...body, ...turns];
    for (const [index, move] of moves.entries()) {
      physical = physical.applyMove(move);
      if (/^[xyz]/.test(move)) continue;
      let complete = false;
      await act(async () => { complete = result.current.handleSmartcubeMove(fixOrientation(physical), move); });
      expect(complete, `turn ${index + 1}: ${move}`).toBe(index === moves.length - 1);
      expect(result.current.displayMoves.some(entry => entry.color === 'red')).toBe(false);
      if (index >= body.length && index < moves.length - 1) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
        expect(result.current.fixVisible).toBe(false);
        expect(result.current.failedCounts[scope]).toBeUndefined();
        expect(getAttemptHistory(scope)).toHaveLength(0);
      }
    }
    expect(fixOrientation(physical).isIdentical(solved)).toBe(true);
    expect(getAttemptHistory(scope)).toHaveLength(1);
    expect(getAttemptHistory(scope)[0].hadMistake).toBe(false);
  });

  it.each([false, true])('still detects a wrong move after an equivalent PLL start (at final AUF: %s)', async atFinalAUF => {
    const algorithm = pllCases.find(item => item.name === 'H Perm')!.algorithm;
    const scope = `pll-auf-wrong-move-${atFinalAUF}`;
    const card = { ...selectedCases[0], id: scope, category: 'PLL', algorithm };
    const { result } = renderHook(() => useTrainingState([card], 'PLL', options));
    const initial = await solvedPattern();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValue(0.9);
    await act(async () => { await result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
    let physical = initial;
    const moves = [...(atFinalAUF ? packets(algorithm) : ['M', 'M']), 'F'];
    for (const move of moves) {
      physical = physical.applyMove(move);
      await act(async () => { result.current.handleSmartcubeMove(fixOrientation(physical), move); });
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(result.current.fixVisible).toBe(true);
    expect(result.current.failedCounts[scope]).toBe(1);
    expect(getAttemptHistory(scope)).toHaveLength(0);
  });
});
