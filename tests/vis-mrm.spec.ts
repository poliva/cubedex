/**
 * masterRepairFaceMap visualization tests - verifies that after one algorithm
 * accumulates rotation in masterRepairFaceMap, subsequent algorithms correctly
 * map GAN moves to canonical moves for visualization and detection.
 *
 * Covers: basic MRM, MRM + rotation in alg, MRM + slice, MRM + wide,
 * rotation reset button, and MRM accumulation from different move types.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, setKeepRotation, loadNextAlgForTest, resetRotation } from './testUtils';

// --- Basic masterRepairFaceMap -------------------------------------

test("[vis-mrm-1] after d' alg, second alg vis is correct", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  await loadNextAlgForTest(page, "R U R' U'");
  await doGanMoves(page, "B U B' U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

test("[vis-mrm-2] wrong move with masterRepairFaceMap shows correct face", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");

  await loadNextAlgForTest(page, "R U R' U'");
  await doGanMoves(page, "B");
  await clearVisualLog(page);
  await doGanMoves(page, "F");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "L", cancel: false });
});

// --- MRM + rotation in algorithm ------------------------------------

test("[vis-mrm-3] masterRepairFaceMap y + alg with d' shows correct vis", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");

  await loadNextAlgForTest(page, "R d' R'");
  await doGanMoves(page, "B U' L'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "d'", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

// --- MRM + slice/wide combinations ---------------------------------

test("[vis-mrm-4] masterRepairFaceMap y + slice alg S R' S' forward", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  await loadNextAlgForTest(page, "S R' S'");
  await doGanMoves(page, "R' L");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
});

test("[vis-mrm-5] masterRepairFaceMap y + slice alg wrong move", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await loadNextAlgForTest(page, "S R' S'");
  await doGanMoves(page, "R' L");
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(1);
  expect(log[0].cancel).toBe(false);
});

test("[vis-mrm-6] MRM y + S R' S' wrong move shows correct face", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");
   
  await loadNextAlgForTest(page, "S R' S'");
  await doGanMoves(page, "R' L");
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(1);
  expect(log[0].cancel).toBe(false);
  expect(log[0].move).toBe("R");
});

// --- MRM accumulation from different move types ---------------------

test("[vis-mrm-7] masterRepairFaceMap + f move accumulation", async ({ page }) => {
  await setup(page, "R f R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R B U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).not.toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
});

test("[vis-mrm-8] masterRepairFaceMap + S move accumulation", async ({ page }) => {
  await setup(page, "S R' S'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-mrm-9] masterRepairFaceMap + E move accumulation", async ({ page }) => {
  await setup(page, "E R E'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "E R E'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Rotation reset button -----------------------------------------

test("[vis-mrm-10] rotation reset clears masterRepairFaceMap", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).not.toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  await resetRotation(page);
  info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  await loadNextAlgForTest(page, "R U R'");
  await doGanMoves(page, "R U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-mrm-11] rotation reset after one accumulated alg", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).not.toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  await resetRotation(page);
  info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doGanMoves(page, "R U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});
