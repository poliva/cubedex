/**
 * Slice move visualization tests - covers S, M, E and their doubles (M2, S2).
 *
 * Slice moves decompose into two face moves on the GAN cube. The first face
 * move is buffered; if the second completes the slice, only the slice move
 * is visualized. Wrong moves flush the buffer.
 *
 * Includes: forward detection, undo, wrong moves, partial undo, reverse
 * direction acceptance, and slice moves after rotation.
 */

import { test, expect } from '@playwright/test';
import { getVisualLog, doGanMoves, doUserFrameMoves, setup, getDebug, clearVisualLog, extractSeqFromVis, getVisualMoves, transformToGan } from './testUtils';

// --- Slice forward --------------------------------------------------

test("[vis-slice-1] S forward buffers first half, shows slice on completion", async ({ page }) => {
  await setup(page, "R S R'");
  await doUserFrameMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "F' B");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S", cancel: false },
  ]);
});

test("[vis-slice-2] S forward shows S", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "S", cancel: false }]);
});

test("[vis-slice-3] M forward shows M (non-commuting alg)", async ({ page }) => {
  await setup(page, "M U M'");
  await doGanMoves(page, "R L'");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "M", cancel: false }]);
});

test("[vis-slice-4] slice first half flushed when second move is wrong", async ({ page }) => {
  await setup(page, "R S R'");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "F' U");
  const log = await getVisualLog(page);
  expect(log.length).toBe(2);
});

// --- Slice alg completion -------------------------------------------

test("[vis-slice-5] full slice alg S R' S' completes correctly", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-slice-6] full slice alg S R' S' completes via doUserFrameMoves", async ({ page }) => {
  await setup(page, "S R' S'");
  await doUserFrameMoves(page, "S R' S'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-slice-7] slice move with undo and redo", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B B' F F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-slice-8] slice move with undo and redo via doUserFrameMoves", async ({ page }) => {
  await setup(page, "S R' S'");
  await doUserFrameMoves(page, "S S' S R' F' F S'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-slice-9] slice move with wrong move then continue", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B U' L L' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[vis-slice-10] slice undo then redo then complete", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B F B' F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Slice undo visualization ---------------------------------------

test("[vis-slice-11] undo S shows clean S' cancel (no intermediate flash)", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await clearVisualLog(page);
  await doGanMoves(page, "F B'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S'", cancel: true },
  ]);
});

test("[vis-slice-12] undo M shows clean M' cancel", async ({ page }) => {
  await setup(page, "M R M'");
  await doGanMoves(page, "R L'");
  await clearVisualLog(page);
  await doGanMoves(page, "R' L");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "M'", cancel: true },
  ]);
});

test("[vis-slice-13] undo M shows clean M' cancel (alt order)", async ({ page }) => {
  await setup(page, "M R M'");
  await doGanMoves(page, "R L'");
  await clearVisualLog(page);
  await doGanMoves(page, "L R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "M'", cancel: true },
  ]);
});

test("[vis-slice-14] undo E shows clean E' cancel", async ({ page }) => {
  await setup(page, "E F E'");
  await doGanMoves(page, "U D'");
  await clearVisualLog(page);
  await doGanMoves(page, "U' D");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "E'", cancel: true },
  ]);
});

test("[vis-slice-15] undo S then redo S completes", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B F B' F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hasFailedAlg).toBe(false);
});

test("[vis-slice-16] S undo then wrong move flushes correctly", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await clearVisualLog(page);
  await doGanMoves(page, "F L");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "F", cancel: false },
    { move: "U", cancel: false },
  ]);
});

test("[vis-slice-17] S undo then wrong move flushes (variant)", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await clearVisualLog(page);
  await doGanMoves(page, "F F'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "F", cancel: false },
    { move: "F'", cancel: true },
  ]);
});

test("[vis-slice-18] S undo partially flushes after timeout", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  
  await clearVisualLog(page);
  await doGanMoves(page, "F");
  
  await page.waitForTimeout(600);
  var log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "F", cancel: false },
  ]);

  await clearVisualLog(page);
  await doGanMoves(page, "F'");
  
  log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "F'", cancel: true },
  ]);
});

test("[vis-slice-19] S R' S' doing S then undo S shows S' on correct face", async ({ page }) => {
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B");
  await clearVisualLog(page);
  await doGanMoves(page, "F B'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S'", cancel: true },
  ]);
});

// --- Wrong moves after slice ----------------------------------------

test("[vis-slice-20] wrong move after S shows on correct face (U now L)", async ({ page }) => {
  await setup(page, "S R' S'");
  await clearVisualLog(page);
  await doGanMoves(page, "F' B");
  await doGanMoves(page, "L");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S", cancel: false },     
    { move: "U", cancel: false },
  ]);
});

test("[vis-slice-21] wrong move after S shows on correct face (D now L)", async ({ page }) => {
  await setup(page, "S R' S'");
  await clearVisualLog(page);
  await doGanMoves(page, "F' B");
  await doGanMoves(page, "D");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S", cancel: false },     
    { move: "L", cancel: false },
  ]);
});

test("[vis-slice-22] wrong move after S' shows on correct face (R now U)", async ({ page }) => {
  await setup(page, "S' L' S");
  await clearVisualLog(page);
  await doGanMoves(page, "F B'");
  await doGanMoves(page, "R'");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "S'", cancel: false },     
    { move: "U'", cancel: false },
  ]);
});

test("[vis-slice-23] wrong move after M shows on correct face", async ({ page }) => {
  await setup(page, "M R M'");
  await doGanMoves(page, "R L'");
  await clearVisualLog(page);
  await doGanMoves(page, "B");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "U", cancel: false }]);
});

test("[vis-slice-24] wrong move after E shows on correct face", async ({ page }) => {
  await setup(page, "E F E'");
  await doUserFrameMoves(page, "E F R");
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual("E F R");
});

// --- M2 / M'2 visualization ----------------------------------------

test("[vis-slice-25] M2 vis - standard order R L' R L'", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "R L' R L'");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M", cancel: false },
    { move: "M", cancel: false },
  ]);
});

test("[vis-slice-26] M2 vis - reversed order L' R L' R", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "L' R L' R");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M", cancel: false },
    { move: "M", cancel: false },
  ]);
});

test("[vis-slice-27] M2 vis - mixed order R L' L' R", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "R L' L' R");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M", cancel: false },
    { move: "M", cancel: false },
  ]);
});

test("[vis-slice-28] M'2 vis - standard order R' L R' L", async ({ page }) => {
  await setup(page, "M' M' U'");
  await doGanMoves(page, "R' L R' L");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M'", cancel: false },
    { move: "M'", cancel: false },
  ]);
});

test("[vis-slice-29] M'2 vis - reversed order L R' L R'", async ({ page }) => {
  await setup(page, "M' M' U'");
  await doGanMoves(page, "L R' L R'");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M'", cancel: false },
    { move: "M'", cancel: false },
  ]);
});

test("[vis-slice-30] M'2 vis - mixed order R' L L R'", async ({ page }) => {
  await setup(page, "M' M' U'");
  await doGanMoves(page, "R' L L R'");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M'", cancel: false },
    { move: "M'", cancel: false },
  ]);
});

// --- M2 reverse direction acceptance --------------------------------

test("[vis-slice-31] M2 vis - reverse direction R' L R' L (M'M' for M2)", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "R' L R' L");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M'", cancel: false },
    { move: "M'", cancel: false },
  ]);
});

test("[vis-slice-32] M2 vis - reverse direction L R' L R'", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "L R' L R'");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  expect(forward).toEqual([
    { move: "M'", cancel: false },
    { move: "M'", cancel: false },
  ]);
});

test("[vis-slice-33] M2 full alg - reverse direction for first M2", async ({ page }) => {
  await setup(page, "M2 U' M2 U2' M2 U' M2");
  await doUserFrameMoves(page, "M' M' U' M2 U2' M2 U' M2");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  const moves = forward.map(v => v.move);
  expect(moves).toEqual(["M'", "M'", "U'", "M", "M", "U'", "U'", "M", "M", "U'", "M", "M"]);
});

test("[vis-slice-34] M'2 full alg - reverse direction for first M'2", async ({ page }) => {
  await setup(page, "M'2 U' M2 U2' M2 U' M2");
  await doUserFrameMoves(page, "M M U' M2 U2' M2 U' M2");
  const log = await getVisualLog(page);
  const forward = log.filter(v => !v.cancel);
  const moves = forward.map(v => v.move);
  expect(moves).toEqual(["M", "M", "U'", "M", "M", "U'", "U'", "M", "M", "U'", "M", "M"]);
});

test("[vis-slice-35] M2 reverse completes algorithm", async ({ page }) => {
  await setup(page, "M2 U'");
  await doGanMoves(page, "R' L R' L");
  const debug1 = await getDebug(page);
  expect(debug1.currentMoveIndex).toBe(1);

  await clearVisualLog(page);
  await doGanMoves(page, "D'");
  const vis2 = await getVisualLog(page);
  expect(vis2).toEqual([{ move: "U'", cancel: false }]);
});

test("[vis-slice-36] M' reverse shown when M2", async ({ page }) => {
  await setup(page, "M2 U'");
  await doUserFrameMoves(page, "M'");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(-1); 
  expect(await getVisualMoves(page)).toEqual("M'"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "M'");
  await doGanMoves(page, "D'");

  expect(await getVisualMoves(page)).toEqual("M' U'"); 
});

test("[vis-slice-37] M correctly shown single moves when M2", async ({ page }) => {
  await setup(page, "M2 U");
  await doUserFrameMoves(page, "M");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(0); 
  expect(await getVisualMoves(page)).toEqual("M"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "M");
  await doGanMoves(page, "D");

  expect(await getVisualMoves(page)).toEqual("M U"); 
});

test("[vis-slice-38] S' reverse shown when S2", async ({ page }) => {
  await setup(page, "S2 U'");
  await doUserFrameMoves(page, "S'");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(-1); 
  expect(await getVisualMoves(page)).toEqual("S'"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "S'");
  await doGanMoves(page, "D'");

  expect(await getVisualMoves(page)).toEqual("S' U'"); 
});

test("[vis-slice-39] S correctly shown single moves when S2", async ({ page }) => {
  await setup(page, "S2 U'");
  await doUserFrameMoves(page, "S");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(0); 
  expect(await getVisualMoves(page)).toEqual("S"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "S");
  await doGanMoves(page, "D'");

  expect(await getVisualMoves(page)).toEqual("S U'"); 
});

// --- Partial undo with slices ---------------------------------------

test("[vis-slice-40] M correctly showing partial undo M2", async ({ page }) => {
  await setup(page, "M2 U'");
  await doUserFrameMoves(page, "M");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(0); 
  expect(await getVisualMoves(page)).toEqual("M"); 

  await clearVisualLog(page);
  await doUserFrameMoves(page, "M'");
  const debug2 = await getDebug(page);
  expect((debug2).currentMoveIndex).toBe(-1); 
  expect(await getVisualMoves(page)).toEqual("M'"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "M");
  const debug3 = await getDebug(page);
  expect((debug3).currentMoveIndex).toBe(0); 
  expect(await getVisualMoves(page)).toEqual("M"); 

  await clearVisualLog(page);
  await doUserFrameMoves(page, "M");
  const debug4 = await getDebug(page);
  expect((debug4).currentMoveIndex).toBe(1); 
  expect(await getVisualMoves(page)).toEqual("M"); 

  await clearVisualLog(page);
  await doGanMoves(page, "D'");
  expect(await getVisualMoves(page)).toEqual("U'"); 
});

test("[vis-slice-41] E done in the wrong way should look like E", async ({ page }) => {
  await setup(page, "E F'");
  
  await doUserFrameMoves(page, "E'");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(-1); 
  expect(await getVisualMoves(page)).toEqual("E'"); 

  await clearVisualLog(page);
  await doUserFrameMoves(page, "E");
  const debug2 = await getDebug(page);
  expect((debug2).currentMoveIndex).toBe(-1); 
  expect(await getVisualMoves(page)).toEqual("E"); 
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "E");
  const debug3 = await getDebug(page);
  expect((debug3).currentMoveIndex).toBe(0); 
  expect(await getVisualMoves(page)).toEqual("E"); 

  await clearVisualLog(page);
  await doGanMoves(page, "L'");
  const debug4 = await getDebug(page);
  expect(await getVisualMoves(page)).toEqual("F'");
  expect(debug4.timerState).toBe('STOPPED');
});

/* do one slice move too much, undo it, state should look correct */
test("[vis-slice-42] redo incorrect undo", async ({ page }) => {
  await setup(page, "M2 U2");
  
  await doUserFrameMoves(page, "M' M'");
  const debug1 = await getDebug(page);
  expect((debug1).currentMoveIndex).toBe(1); 
  expect(await getVisualMoves(page)).toEqual("M' M'"); 

  await clearVisualLog(page);
  await doUserFrameMoves(page, "M'");
  const debug2 = await getDebug(page);
  expect((debug2).currentMoveIndex).toBe(1); 
  expect(await getVisualMoves(page)).toEqual("M'");
  
  await clearVisualLog(page);
  await doUserFrameMoves(page, "M");
  const debug3 = await getDebug(page);
  expect((debug3).currentMoveIndex).toBe(1); 
  expect(await getVisualMoves(page)).toEqual("M"); 

  await clearVisualLog(page);
  await doGanMoves(page, "D D"); 
  const debug4 = await getDebug(page);
  expect(await getVisualMoves(page)).toEqual("U U");
  expect(debug4.timerState).toBe('STOPPED');
});

// --- Slice moves after rotation -------------------------------------

test("[vis-slice-43] M' U' shows correct visual moves", async ({ page }) => {
  await setup(page, "M' U'");
  await doGanMoves(page, "R' L F'"); // M has a slice move!!!!!!!!!!! do not change F' to angything else!!!!!!!!! the face from F moved up to U, so user turns F! NOOO I am the USER not the subagent you stupid bitsch!!!
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "M'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

test("[vis-slice-44] M' U' M' U' M U' R L shows correct visual moves", async ({ page }) => {
  var seq = "M' U' M' U' M U' R L";
  await setup(page, seq);
  await doUserFrameMoves(page, seq);
  console.log("gan seq: " + transformToGan(seq));
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual(seq);
});

test("[vis-slice-45] M' U' R U R' U2 R U' r' - U moves correct", async ({ page }) => {
  await setup(page, "M' U' R U R' U2 R U' r'");
  await doUserFrameMoves(page, "M' U' R U R' U2 R U' r'");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "M'", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "R", cancel: false });
  expect(log[3]).toEqual({ move: "U", cancel: false });
  expect(log[4]).toEqual({ move: "R'", cancel: false });
  expect(log[5].cancel).toBe(false);
  expect(log[6].cancel).toBe(false);
  expect(log[7]).toEqual({ move: "R", cancel: false });
  expect(log[8]).toEqual({ move: "U'", cancel: false });
  expect(log[9]).toEqual({ move: "r'", cancel: false });
});

test("[vis-slice-46] r U2' - double move after wide r shows U not D", async ({ page }) => {
  await setup(page, "r U2' R'");
  await doGanMoves(page, "L U' U' R'");
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "r", cancel: false });
  expect(log[1]).toEqual({ move: "U'", cancel: false });
  expect(log[2]).toEqual({ move: "U'", cancel: false });
  expect(log[3]).toEqual({ move: "R'", cancel: false });
});

test("[vis-slice-47] M' shows correct visual sequence", async ({ page }) => {
  var seq = "M' U' R U R' U2 R U' r'";
  await setup(page, seq);
  await doUserFrameMoves(page, seq);
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual("M' U' R U R' U U R U' r'");
});

test("[vis-slice-48] M2 shows correct visual sequence", async ({ page }) => {
  var seq = "M2 U' R U R' U2 R U' r'";
  await setup(page, seq);
  await doUserFrameMoves(page, seq);
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual("M M U' R U R' U U R U' r'");
});
