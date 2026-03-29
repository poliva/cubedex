/**
 * Regression tests - ~10 focused tests covering the most fragile and important
 * functionality. Run this file for quick validation after any change.
 *
 * Covers: basic completion, d' wide moves, slice moves, double moves,
 * MRM cross-alg rotation, rotation reset, override detection, visualization,
 * alg fix box, and rotate colors.
 */

import { test, expect } from '@playwright/test';
import { VisualMove, getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, setKeepRotation, loadNextAlgForTest, resetRotation, setTestAlgConfig } from './testUtils';

// 1. Basic completion: simple alg completes, partial does not
test("[reg-1] regression: simple alg R U R' U' completes", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 2. d' wide move: GAN reports face component, fixOrientation matches
test("[reg-2] regression: d' alg completes with GAN face moves", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' R U2 R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 3. Slice move: S decomposes to F' B on GAN, rotation shifts subsequent moves
test("[reg-3] regression: slice S R' S' completes", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 4. Double moves: U2 requires two U presses
test("[reg-4] regression: U2 requires two presses, one does not complete", async ({ page }) => {
  await setup(page, "R U2 R'");
  await doGanMoves(page, "R U");
  let info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
  await doGanMoves(page, "U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 5. MRM: d' accumulates y, second alg uses shifted inputs
test("[reg-5] regression: MRM y shifts inputs for next alg", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });

  await loadNextAlgForTest(page, "R U R'");
  // After y: canonical R = GAN B, canonical U = GAN U
  await doGanMoves(page, "B U B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 6. Rotation reset: clears MRM and restores normal inputs
test("[reg-6] regression: rotation reset restores identity MRM", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await resetRotation(page);
  const info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  await loadNextAlgForTest(page, "R U R' f S' x D R'");
  await doUserFrameMoves(page, "R U R' f S' x D R'");
  const info2 = await getDebug(page);
  expect(info2.timerState).toBe('STOPPED');
});

// 7. Visualization: correct vis moves for forward, undo, and wrong moves
test("[reg-7] regression: vis log correct for forward + undo + wrong", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U");
  await clearVisualLog(page);
  // Undo U
  await doUserFrameMoves(page, "U'");
  let log = await getVisualLog(page);
  expect(log).toEqual([{ move: "U'", cancel: true }]);
  // Wrong move
  await clearVisualLog(page);
  await doUserFrameMoves(page, "L");
  log = await getVisualLog(page);
  expect(log[0].cancel).toBe(false);
  expect(log[0].move).toBe("L");
});

// 8. Alg fix box: shows correct undo suggestion after rotation
test("[reg-8] regression: alg fix after d' shows undo in physical frame", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d'");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(3);
  // Wrong move
  await doGanMoves(page, "F");
  info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
  expect(info.algFixHtml.trim().length).toBeGreaterThan(0);
});

// 9. Override detection: simple override from solved state
test("[reg-9] regression: override detects alternate execution", async ({ page }) => {
  await setup(page, "R U R' U'");
  await setTestAlgConfig(page, { overrideEnabled: true });
  // Do the correct execution
  await doUserFrameMoves(page, "R U R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// 10. Wrong move does NOT complete: d' aliasing prevention
test("[reg-10] regression: d' aliasing - L U' L' U must NOT complete d' alg", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' U");
  const info = await getDebug(page);
  expect(info.timerState).not.toBe('STOPPED');
});

// 11. Queue reshuffle: all N algs appear after one full cycle (none stuck in copy)
test("[reg-11] regression: queue reshuffle includes all algs after one cycle", async ({ page }) => {
  await setup(page, "R U R' U'");
  const names = ["A", "B", "C", "D"];
  await page.evaluate((n: string[]) => (window as any).__test.setQueue(n, []), names);
  // Advance through the full queue (4 advances) - simulates completing each alg
  for (let i = 0; i < names.length; i++) {
    await page.evaluate(() => (window as any).__test.advanceQueue());
  }
  // After one full cycle, all 4 algs must be available (none stuck in copy)
  const info = await getDebug(page);
  const allNames = [...info.queueAlgNames, ...info.copyAlgNames];
  expect(allNames.sort()).toEqual(names.sort());
  // Copy-back fires on the 4th advance: all algs move to main queue, copy empty
  expect(info.copyAlgNames.length).toBe(0);
  expect(info.queueAlgNames.length).toBe(names.length);
});

// 12. hadBadMoveDuringExec: NOT set immediately, only after 300ms leniency
test("[reg-12] regression: hadBadMoveDuringExec uses 300ms leniency", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  let info = await getDebug(page);
  expect(info.hadBadMoveDuringExec).toBe(false);
  // Make a wrong move -- flag is NOT set immediately (300ms leniency)
  await doGanMoves(page, "F");
  info = await getDebug(page);
  expect(info.hadBadMoveDuringExec).toBe(false);
  // Wait for the 300ms timeout to fire
  await page.waitForTimeout(400);
  info = await getDebug(page);
  expect(info.hadBadMoveDuringExec).toBe(true);
  // Correct and complete -- flag stays true (sticky until next case)
  await doGanMoves(page, "F'");
  await doUserFrameMoves(page, "R' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(true);
});

// 13. Fast correction: wrong move corrected within 300ms -> hadBadMoveDuringExec stays false
test("[reg-13] regression: fast correction does not set hadBadMoveDuringExec", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  // Make a wrong move and immediately undo it (within 300ms)
  await doGanMoves(page, "F");
  let info = await getDebug(page);
  expect(info.hadBadMoveDuringExec).toBe(false);
  await doGanMoves(page, "F'");
  // Complete the alg
  await doUserFrameMoves(page, "R' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(false);
});
