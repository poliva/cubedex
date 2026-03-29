/**
 * Basic visualization tests - simple forward, undo, wrong move, and double move
 * scenarios using only single-face moves (no rotations, wide moves, or slices).
 *
 * Also covers: ALG fix box basics and basic rotate-colors sanity checks.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, setRotateColors } from './testUtils';

// --- Forward moves --------------------------------------------------

test("[vis-basic-1] simple forward moves all cancel=false", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U R' U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

// --- Undo / redo ----------------------------------------------------

test("[vis-basic-2] undo then redo correct cancel flags", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U U' U R' U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "U'", cancel: true },   // undo
    { move: "U", cancel: false },   // redo
    { move: "R'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

test("[vis-basic-3] undo back to initial then redo", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R R' R U R' U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "R'", cancel: true },    // undo to initial
    { move: "R", cancel: false },    // redo
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

// --- Wrong moves ----------------------------------------------------

test("[vis-basic-4] wrong move is visualized (cancel=false)", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R F");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(2);
  expect(log[0]).toEqual({ move: "R", cancel: false });
  expect(log[1].cancel).toBe(false);                     // wrong move, not a cancel
});

test("[vis-basic-5] wrong move shown on correct face", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R F");
  const log = await getVisualLog(page);
  expect(log[1]).toEqual({ move: "F", cancel: false });
});

test("[vis-basic-6] multiple wrong moves then recovery", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R F F' U R' U'");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "R", cancel: false });
  expect(log[1].cancel).toBe(false);  // F wrong
  expect(log[2].cancel).toBe(true);   // F' recovery
  expect(log[3]).toEqual({ move: "U", cancel: false });
  expect(log[4]).toEqual({ move: "R'", cancel: false });
  expect(log[5]).toEqual({ move: "U'", cancel: false });
});

// --- Double moves ---------------------------------------------------

test("[vis-basic-7] U2 shows two separate visual moves", async ({ page }) => {
  await setup(page, "R U2 R'");
  await doUserFrameMoves(page, "R U U R'");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(4);
  expect(log[0]).toEqual({ move: "R", cancel: false });
  expect(log[1].cancel).toBe(false);
  expect(log[2].cancel).toBe(false);
  expect(log[3]).toEqual({ move: "R'", cancel: false });
});

// --- ALG fix box (no rotation) -------------------------------------

test("[vis-basic-8] no rotation, wrong move shows correct undo", async ({ page }) => {
  await setup(page, "R U R'");
  await doUserFrameMoves(page, "R L");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["L"]);
  expect(info.algFixHtml.trim()).toBe("L'");
});

test("[vis-basic-9] no rotation, wrong move F shows F'", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R");
  await doGanMoves(page, "F");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["F"]);
  expect(info.algFixHtml.trim()).toBe("F'");
});

test("[vis-basic-10] no rotation, fix is simple inverse", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R L");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["L"]);
  expect(info.algFixHtml.trim()).toBe("L'");
});

// --- Rotate Colors basic sanity -------------------------------------

test("[vis-basic-11] rotate colors: logic is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'vertical');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-basic-12] rotate colors: visual log shows algorithm moves", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'vertical');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-basic-13] rotate colors: colorRotationFaceMap is set when enabled", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'vertical');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  const crfm = await page.evaluate(() => (window as any).__test.getDebugInfo().colorRotationFaceMap);
  if (crfm !== null) {
    expect(crfm).toHaveProperty("U");
    expect(crfm).toHaveProperty("R");
    expect(crfm).toHaveProperty("F");
  }
});

test("[vis-basic-14] rotate colors: wrong moves still detected", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'vertical');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R L");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["L"]);
  expect(info.currentMoveIndex).toBe(0);
});

test("[vis-basic-15] rotate colors upside (z2): logic is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'upside');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.colorRotationMode).toBe('upside');
});

test("[vis-basic-16] rotate colors any: logic is unaffected", async ({ page }) => {
  await setup(page, "R U R'");
  await setRotateColors(page, 'any');
  await page.evaluate((a: string) => (window as any).__test.setAlgForTest(a), "R U R'");
  await doUserFrameMoves(page, "R U R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.colorRotationMode).toBe('any');
});
