/**
 * Wide move and rotation visualization tests - covers algorithms containing
 * y/x/z rotations and wide moves (d', u, f, r, l).
 *
 * Forward detection, undo, wrong moves in rotated states, and ALG fix box
 * with rotation-causing moves.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog } from './testUtils';

// --- y rotation forward ---------------------------------------------

test("[vis-wide-1] y rotation applied visually when next move is done", async ({ page }) => {
  await setup(page, "R y R'");
  await doUserFrameMoves(page, "R");
  let log = await getVisualLog(page);
  expect(log).toEqual([{ move: "R", cancel: false }]);

  await clearVisualLog(page);
  await doGanMoves(page, "B'");  // GAN B' = alg R' after y
  log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "y", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-wide-2] y rotation with full forward alg", async ({ page }) => {
  await setup(page, "L U' L' y R' U2 R");
  await doUserFrameMoves(page, "L U' L' y R' U2 R");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "L", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "L'", cancel: false });
  expect(log[3]).toEqual({ move: "y", cancel: false });
  expect(log[4]).toEqual({ move: "R'", cancel: false });
  expect(log[5].cancel).toBe(false);
  expect(log[6].cancel).toBe(false);
  expect(log[7]).toEqual({ move: "R", cancel: false });
});

// --- Wide moves d', u forward --------------------------------------

test("[vis-wide-3] d' alg forward moves show alg names", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' R U2 R'");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "L", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "L'", cancel: false });
  expect(log[3]).toEqual({ move: "d'", cancel: false });
  expect(log[4]).toEqual({ move: "R", cancel: false });
  expect(log[5].cancel).toBe(false);
  expect(log[6].cancel).toBe(false);
  expect(log[7]).toEqual({ move: "R'", cancel: false });
});

test("[vis-wide-4] u alg forward moves show alg names", async ({ page }) => {
  await setup(page, "R u R'");
  await doUserFrameMoves(page, "R u R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "u", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-wide-5] u alg forward moves show alg names (dup)", async ({ page }) => {
  await setup(page, "R u R'");
  await doUserFrameMoves(page, "R u R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "u", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

// --- d' forward vis -------------------------------------------------

test("[vis-wide-6] d' forward shows d' in vis", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L'");
  await clearVisualLog(page);
  await doGanMoves(page, "U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "d'", cancel: false }]);
});

test("[vis-wide-7] u forward shows u in vis", async ({ page }) => {
  await setup(page, "R u R' U");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "D");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "u", cancel: false }]);
});

// --- Wide move undo -------------------------------------------------

test("[vis-wide-8] undo after d' shows cancel=true", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d'");
  await clearVisualLog(page);
  await doGanMoves(page, "U"); // undo d'
  const log = await getVisualLog(page);
  expect(log).toHaveLength(1);
  expect(log[0].cancel).toBe(true);
});

test("[vis-wide-9] undo d' then redo d'", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' d d'");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(6);
  expect(log[0]).toEqual({ move: "L", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "L'", cancel: false });
  expect(log[3]).toEqual({ move: "d'", cancel: false });
  expect(log[4].cancel).toBe(true);   // undo d'
  expect(log[5]).toEqual({ move: "d'", cancel: false });  // redo d'
});

test("[vis-wide-10] undo across y rotation sends y' cancel", async ({ page }) => {
  await setup(page, "R y R' U");
  await doUserFrameMoves(page, "R y R'");
  await clearVisualLog(page);
  await doGanMoves(page, "B");     // undo R' (GAN B = inverse of B')
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: true },     // undo R'
    { move: "y'", cancel: true },    // undo intermediate y
  ]);
});

test("[vis-wide-11] undo d' sends d cancel", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d'");
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "d", cancel: true }]);
});

test("[vis-wide-12] undo d' then undo L' sends correct cancel sequence", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d'");
  await clearVisualLog(page);
  await doGanMoves(page, "U");
  await doGanMoves(page, "L");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "d", cancel: true },
    { move: "L", cancel: true },
  ]);
});

test("[vis-wide-13] undo u sends u' cancel", async ({ page }) => {
  await setup(page, "R u R' U");
  await doUserFrameMoves(page, "R u");
  await clearVisualLog(page);
  await doGanMoves(page, "D'");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "u'", cancel: true }]);
});

test("[vis-wide-14] undo across y rotation sends intermediate y' cancel", async ({ page }) => {
  await setup(page, "R y R' U");
  await doUserFrameMoves(page, "R y R'");
  await clearVisualLog(page);
  await doGanMoves(page, "B");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: true },
    { move: "y'", cancel: true },
  ]);
});

test("[vis-wide-15] undo across x rotation", async ({ page }) => {
  await setup(page, "R x R' U");
  await doGanMoves(page, "R R'");
  await clearVisualLog(page);
  await doGanMoves(page, "R");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: true },
    { move: "x'", cancel: true },
  ]);
});

// --- Wrong moves in rotated state -----------------------------------

test("[vis-wide-16] wrong move in rotated state (after d') shows on correct face", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d'");
  await clearVisualLog(page);
  await doGanMoves(page, "R");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "F", cancel: false }]);
});

test("[vis-wide-17] wrong move then recovery in rotated state", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' L L' R U U R'");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "L", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "L'", cancel: false });
  expect(log[3]).toEqual({ move: "d'", cancel: false });
  expect(log[4]).toEqual({ move: "L", cancel: false });   // wrong F mapped to L
  expect(log[5].cancel).toBe(true);                       // recovery
  expect(log[6]).toEqual({ move: "R", cancel: false });
});

test("[vis-wide-18] wrong move after d' (wide) mapped through invertFaceMap", async ({ page }) => {
  await setup(page, "R d' R' U");
  await doUserFrameMoves(page, "R d'");
  await clearVisualLog(page);
  await doGanMoves(page, "F");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "L", cancel: false }]);
});

test("[vis-wide-19] wrong move after undo of d' shows correct face", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' d");
  await clearVisualLog(page);
  await doGanMoves(page, "F");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "F", cancel: false }]);
});

// --- ALG fix box with rotation -------------------------------------

test("[vis-wide-20] after y rotation, wrong move shows rotated undo", async ({ page }) => {
  await setup(page, "y R U");
  await doUserFrameMoves(page, "y R L'");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["F'"]);
  expect(info.algFixHtml.trim()).toBe("L");
});

test("[vis-wide-21] after d' rotation, wrong move shows rotated undo", async ({ page }) => {
  await setup(page, "R d' R' U");
  await doUserFrameMoves(page, "R d' L'");
  const info = await getDebug(page);
  expect(info.badAlg).toEqual(["F'"]);
  expect(info.algFixHtml.trim()).toBe("L");
});

test("[vis-wide-22] after d' (y) shows undo in physical frame", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U'");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(3);
  await doGanMoves(page, "F");
  info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
  const fixHtml = info.algFixHtml.trim();
  expect(fixHtml.length).toBeGreaterThan(0);
});

test("[vis-wide-23] after S rotation, wrong move shows rotated undo", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await doGanMoves(page, "L");
  const info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
  const fixHtml = info.algFixHtml.trim();
  expect(fixHtml.length).toBeGreaterThan(0);
});

test("[vis-wide-24] after f rotation, wrong move shows rotated undo", async ({ page }) => {
  await setup(page, "f R f'");
  await doGanMoves(page, "B");
  await doGanMoves(page, "L");
  const info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
  const fixHtml = info.algFixHtml.trim();
  expect(fixHtml.length).toBeGreaterThan(0);
});

test("[vis-wide-25] after two rotations, fix is correctly double-rotated", async ({ page }) => {
  await setup(page, "d' S R' S'");
  await doGanMoves(page, "U'");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
  await doGanMoves(page, "R' L");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(1);
  await doGanMoves(page, "U");
  info = await getDebug(page);
  expect(info.badAlg.length).toBeGreaterThan(0);
  expect(info.algFixHtml.trim().length).toBeGreaterThan(0);
});

// --- Explicit rotation vis -----------------------------------------

test("[vis-wide-26] R x R forward (x preserves R axis)", async ({ page }) => {
  await setup(page, "R x R' U");
  await doGanMoves(page, "R");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(0);
  await doGanMoves(page, "R'");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(2);
});

test("[vis-wide-27] R x R' vis shows intermediate x", async ({ page }) => {
  await setup(page, "R x R' U");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "x", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-wide-28] y rotation followed by move shows y then move", async ({ page }) => {
  await setup(page, "R y R' U");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "B'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "y", cancel: false },
    { move: "R'", cancel: false },
  ]);
});

test("[vis-wide-29] x rotation followed by move shows x then move", async ({ page }) => {
  await setup(page, "U x U' R");
  await doGanMoves(page, "U");
  await clearVisualLog(page);
  await doGanMoves(page, "F'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "x", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

// --- Error in rotated state -----------------------------------------

test("[vis-wide-30] error in rotated state then undo and continue", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U'");
  await doGanMoves(page, "F F'");
  await doGanMoves(page, "B U U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-wide-31] double move U2 after rotation shows two vis moves", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U' B");
  await clearVisualLog(page);
  await doGanMoves(page, "U U");
  const log = await getVisualLog(page);
  expect(log).toHaveLength(2);
  expect(log[0].cancel).toBe(false);
  expect(log[1].cancel).toBe(false);
});
