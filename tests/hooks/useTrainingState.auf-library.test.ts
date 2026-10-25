import { act, cleanup, renderHook } from '@testing-library/react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import defaults from '../../src/data/defaultAlgs.json';
import { useTrainingState, type TrainingPracticeOptions } from '../../src/hooks/useTrainingState';
import { categoryPuzzle, PUZZLES, puzzleLoader } from '../../src/lib/puzzles';
import { expandNotation } from '../../src/lib/storage';
import { fixOrientation } from '../../src/lib/scramble';
import { createCaseGoalMatcher } from '../../src/lib/training-goal';
import { isWholeCubeRotationMove } from '../../src/lib/move-helpers';
import { selectedCases } from './useTrainingStateTestUtils';

const options: TrainingPracticeOptions = {
  selectionChangeMode: 'manual', countdownMode: false, randomizeAUF: true,
  randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
  prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
};
const choices = [
  { auf: '', random: 0.9 }, { auf: 'U', random: 0 },
  { auf: 'U2', random: 0.6 }, { auf: "U'", random: 0.3 },
];
const categories = Object.keys(defaults).filter(category => PUZZLES[categoryPuzzle(category)].smartcube);
const report: Array<{ category: string; cases: number; routes: number; failures: Array<Record<string, unknown>> }> = [];
afterAll(() => {
  if (report.length > 0) writeFileSync('/tmp/cubedex-auf-library-audit.json', JSON.stringify(report, null, 2));
});

describe('bundled cube algorithms with random AUF', () => {
  it.each(categories)('replays every valid AUF route in %s', async category => {
    const puzzle = categoryPuzzle(category);
    const solved = (await puzzleLoader(puzzle).kpuzzle()).defaultPattern();
    const subsets = defaults[category as keyof typeof defaults];
    const summary = { category, cases: subsets.reduce((count, subset) => count + subset.algorithms.length, 0),
      routes: 0, failures: [] as Array<Record<string, unknown>> };
    report.push(summary);
    const postEnabled = /pll|zbll/i.test(category);
    const setups = choices.flatMap((pre, preIndex) => (postEnabled ? choices : [choices[0]])
      .flatMap((postChoice, postIndex) => [true, false].map(prepared => ({ pre, preIndex, postChoice, postIndex, prepared }))));
    for (const [subsetIndex, subset] of subsets.entries()) {
      for (const [caseIndex, entry] of subset.algorithms.entries()) {
        const algorithm = new Alg(expandNotation(entry.algorithm, puzzle)).expand().toString();
        for (const { pre, preIndex, postChoice, postIndex, prepared } of setups) {
          const post = postChoice.auf;
          const displayed = `${pre.auf} ${algorithm} ${post}`.trim();
          const initial = prepared ? solved.applyAlg(new Alg(displayed).invert()) : solved.applyAlg('D R B y');
          const endpoint = initial.applyAlg(displayed);
          const partialGoal = createCaseGoalMatcher(endpoint, category, subset.subset);
          for (const [actualIndex, actual] of choices.entries()) {
            const afterBody = initial.applyAlg(`${actual.auf} ${algorithm}`);
            const correction = partialGoal ? (partialGoal(afterBody) ? '' : undefined)
              : choices.find(choice => fixOrientation(afterBody.applyAlg(choice.auf)).isIdentical(fixOrientation(endpoint)))?.auf;
            if (correction === undefined) continue;
            summary.routes += 1;
            const scope = `audit-${category}-${subsetIndex}-${caseIndex}-${preIndex}-${postIndex}-${actualIndex}-${prepared}`;
            const card = { ...selectedCases[0], id: scope, name: entry.name, category, subset: subset.subset, algorithm };
            const next = { ...selectedCases[1], id: `${scope}-next`, category, algorithm: 'R U' };
            const hook = renderHook(() => useTrainingState([card, next], category, { ...options, puzzle }));
            const random = vi.spyOn(Math, 'random').mockReturnValueOnce(pre.random)
              .mockReturnValueOnce(postChoice.random).mockReturnValue(0.9);
            let physical = initial;
            let complete = false;
            let reason = '';
            let lastMove = '';
            let packet = 0;
            try {
              await act(async () => { await hook.result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
              const originalPicture = hook.result.current.caseAlgorithm;
              const moves = new Alg(`${actual.auf} ${algorithm} ${correction}`).expand().toString().split(/\s+/).filter(Boolean)
                .flatMap(move => /2'?$/.test(move)
                  ? [prepared ? move[0] : `${move[0]}'`, prepared ? move[0] : `${move[0]}'`] : [move]);
              for (const move of moves) {
                physical = physical.applyMove(move);
                if (isWholeCubeRotationMove(move)) continue;
                lastMove = move;
                packet += 1;
                await act(async () => { complete = hook.result.current.handleSmartcubeMove(fixOrientation(physical), move); });
                if (complete) {
                  if (!(partialGoal?.(physical) ?? fixOrientation(physical).isIdentical(fixOrientation(endpoint)))) reason = 'premature completion';
                  break;
                }
                if (hook.result.current.recoveryTarget) reason = 'unexpected recovery';
                else if (hook.result.current.displayMoves.some(move => move.color === 'red')) reason = 'valid move colored red';
                else if (hook.result.current.caseAlgorithm !== originalPicture) reason = 'case stickers replaced';
                else if (!hook.result.current.caseCurrentPattern?.isIdentical(physical)) reason = 'sticker frame drift';
                if (reason) break;
              }
              if (!reason && !complete) reason = 'valid endpoint did not complete';
              if (reason) summary.failures.push({ name: entry.name, subset: subset.subset, pre: pre.auf, post,
                actual: actual.auf, correction, prepared, reason, packet, lastMove,
                guidance: hook.result.current.displayAlg, fix: hook.result.current.fixText });
            } catch (error) {
              summary.failures.push({ name: entry.name, pre: pre.auf, actual: actual.auf, error: String(error) });
            } finally {
              cleanup();
              random.mockRestore();
            }
          }
        }
      }
    }
    console.log(`${category}: ${summary.routes} routes, ${summary.failures.length} failures`);
    expect(summary.failures.slice(0, 15), `${category}: ${summary.failures.length} failures`).toEqual([]);
  }, 180_000);

  it.each(categories)('still reports an unrelated wrong face turn in %s', async category => {
    const puzzle = categoryPuzzle(category);
    const solved = (await puzzleLoader(puzzle).kpuzzle()).defaultPattern();
    const subsets = defaults[category as keyof typeof defaults];
    const entry = subsets.flatMap(subset => subset.algorithms.map(algorithm => ({ ...algorithm, subset: subset.subset })))[0];
    const algorithm = new Alg(expandNotation(entry.algorithm, puzzle)).expand().toString();
    const initial = solved.applyAlg(new Alg(algorithm).invert());
    const scope = `audit-wrong-face-${category}`;
    const card = { ...selectedCases[0], id: scope, name: entry.name, category, subset: entry.subset, algorithm };
    const hook = renderHook(() => useTrainingState([card], category, { ...options, puzzle }));
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      await act(async () => { await hook.result.current.trainCurrent(initial, { algorithm, statsScopeId: scope }); });
      const moves = new Alg(hook.result.current.displayAlg).expand().toString().split(/\s+/);
      const known: KPattern[] = [fixOrientation(initial)];
      let expected = initial;
      for (const move of moves) {
        if (/2'?$/.test(move)) {
          known.push(fixOrientation(expected.applyMove(move[0])), fixOrientation(expected.applyMove(`${move[0]}'`)));
        }
        expected = expected.applyMove(move);
        known.push(fixOrientation(expected));
      }
      let physical = initial;
      for (const move of moves) {
        physical = physical.applyMove(move);
        if (isWholeCubeRotationMove(move)) continue;
        await act(async () => { expect(hook.result.current.handleSmartcubeMove(fixOrientation(physical), move)).toBe(false); });
        if (!/^U(?:2'?|')?$/.test(move)) break;
      }
      const wrongMove = ['U', 'R', 'F', 'D', 'L', 'B'].find(move =>
        !known.some(pattern => pattern.isIdentical(fixOrientation(physical.applyMove(move)))));
      expect(wrongMove).toBeDefined();
      physical = physical.applyMove(wrongMove!);
      await act(async () => { expect(hook.result.current.handleSmartcubeMove(fixOrientation(physical), wrongMove!)).toBe(false); });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
      expect(hook.result.current.fixVisible).toBe(true);
      expect(hook.result.current.failedCounts[scope]).toBe(1);
    } finally {
      cleanup();
    }
  });
});
