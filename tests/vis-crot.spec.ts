/**
 * Color rotation visualization tests - verifies that the Rotate Colors feature
 * (which randomly rotates the visual display around the y-axis) does not affect
 * move detection, pattern matching, or the visual log.
 *
 * Uses __setColorRotation to control the random y-rotation deterministically.
 * Also tests combinations of color rotation with masterRepairFaceMap.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, setKeepRotation, loadNextAlgForTest, setColorRotation } from './testUtils';

// --- Deterministic color rotation -----------------------------------

test("[vis-crot-1] y rotation: move detection is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-2] y' rotation: move detection is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y'");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-3] y2 rotation: move detection is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y2");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-4] visual log records alg moves (no color transform)", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-crot-5] wrong move detection works", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doGanMoves(page, "R L");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["L"]);
  expect(info.currentMoveIndex).toBe(0);
});

test("[vis-crot-6] undo works correctly", async ({ page }) => {
  await setup(page, "R U R' F");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R' F");
  await doUserFrameMoves(page, "R U U' U R' F");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-7] with wide move d' in alg", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' R U2 R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-8] with slice move S in alg", async ({ page }) => {
  await setup(page, "S R' S'");
  await setColorRotation(page, "y");
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "S R' S'");
  await doGanMoves(page, "F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-9] colorRotationFaceMap is set correctly", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, "y");
  const info = await getDebug(page);
  expect(info.colorRotationFaceMap).not.toBeNull();
  expect(info.colorRotationFaceMap.U).toBe("U");
  expect(info.colorRotationFaceMap.D).toBe("D");
});

test("[vis-crot-10] empty rotation (disabled) has null map", async ({ page }) => {
  await setup(page, "R U R'");
  await setColorRotation(page, '');
  const info = await getDebug(page);
  expect(info.colorRotationFaceMap).toBeNull();
});

// --- masterRepairFaceMap + Rotate Colors combination ----------------

test("[vis-crot-11] MRM y + colorRotation y: detection still works", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await setColorRotation(page, "y");
  await loadNextAlgForTest(page, "R U R'");
  await doGanMoves(page, "B U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-12] MRM y + colorRotation y': detection still works", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await setColorRotation(page, "y'");
  await loadNextAlgForTest(page, "R U R'");
  await doGanMoves(page, "B U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-crot-13] MRM y + colorRotation y: wrong move still detected", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await setColorRotation(page, "y");
  await loadNextAlgForTest(page, "R U R'");
  await doGanMoves(page, "B");
  await clearVisualLog(page);
  await doGanMoves(page, "F");
  const info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
});

test("[vis-crot-14] MRM y + colorRotation y2: vis log shows alg frame moves", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");

  await setColorRotation(page, "y2");
  await loadNextAlgForTest(page, "R U R'");
  await doGanMoves(page, "B U B'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
  ]);
});
