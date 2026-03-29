/**
 * Complex visualization tests - multi-step scenarios mixing wide moves, slices,
 * explicit rotations, undo, wrong moves, and recovery.
 *
 * Also covers: encapsulated algorithms (wide-move wrappers), explicit rotation
 * forward detection, override detection vis, and bug reproductions.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, setKeepRotation, loadNextAlgForTest, extractSeqFromVis } from './testUtils';

// --- Encapsulated algorithms (wide-move wrappers) -------------------

test("[vis-complex-1] r f U f' r' completes correctly", async ({ page }) => {
  await setup(page, "r f U f' r'");
  await doUserFrameMoves(page, "L");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
});

test("[vis-complex-2] d' S F B forward detection", async ({ page }) => {
  await setup(page, "d' S F B");
  await doGanMoves(page, "U'");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
  await doGanMoves(page, "R' L");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(1);
});

test("[vis-complex-3] r f U f' r' vis log shows alg moves", async ({ page }) => {
  await setup(page, "r f U f' r'");
  await doGanMoves(page, "L");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "r", cancel: false }]);
});

test("[vis-complex-4] completion of d' S F B", async ({ page }) => {
  await setup(page, "d' S F B");
  await doGanMoves(page, "U'");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
  await doGanMoves(page, "R' L");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(1);
  await doGanMoves(page, "R");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(2);
  await doGanMoves(page, "L");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Explicit rotations (x, y, z) forward --------------------------

test("[vis-complex-5] L y' L' S U S' forward", async ({ page }) => {
  await setup(page, "L y' L' S U S'");
  await doGanMoves(page, "L");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
  await doGanMoves(page, "B'");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(2);
});

// --- Forward + undo + wrong move combinations ----------------------

test("[vis-complex-6] d' alg forward then wrong then recovery continues", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U'");
  await doGanMoves(page, "F");
  await doGanMoves(page, "F'");
  await doGanMoves(page, "B U U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-complex-7] S alg forward then wrong then recovery", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await doGanMoves(page, "L");
  await doGanMoves(page, "L'");
  await doGanMoves(page, "U'");
  await doGanMoves(page, "F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-complex-8] multiple undo-redo across d' boundary", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U' U U' B U U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Override detection vis -----------------------------------------

test("[vis-complex-9] J A perm alternate vis shows correct moves", async ({ page }) => {
  const origAlg = "R' U L' U2 R U' R' U2 R L";
  await setup(page, origAlg);
  await page.evaluate(({ category, overrideEnabled, algorithm }) =>
    (window as any).__test.setTestAlgConfig({ category, overrideEnabled, algorithm }),
    { category: 'PLL', overrideEnabled: true, algorithm: origAlg });
  await page.evaluate((s: string) => (window as any).__test.setupCaseFromAlg(s),
    "L' R' U2 R U R' U2 L U' R");

  await doGanMoves(page, "U' L' U' L F L' U' L U L F' L L U L U'");

  const info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(true);

  const log = await getVisualLog(page);
  const lastMove = log[log.length - 1];
  expect(lastMove.move).toBe("U'");
  const expectedMoves = ["U'", "L'", "U'", "L", "F", "L'", "U'", "L", "U", "L", "F'", "L", "L", "U", "L", "U'"];
  expect(log.map(m => m.move)).toEqual(expectedMoves);
});

// --- Bug reproductions ---------------------------------------------

test("[vis-complex-10] L U' L' d' with wrong U U U shows correct vis", async ({ page }) => {
  await setup(page, "L U' L' d'");
  await doGanMoves(page, "L U' L'");
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log1 = await getVisualLog(page);
  expect(log1).toEqual([
    { move: "U", cancel: false },
  ]);
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log2 = await getVisualLog(page);
  expect(log2).toEqual([
    { move: "U", cancel: false },
  ]);
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log3 = await getVisualLog(page);
  expect(log3).toEqual([
    { move: "d'", cancel: false },
  ]);
});
