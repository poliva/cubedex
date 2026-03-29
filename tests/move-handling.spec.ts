/**
 * Move handling tests - verifies that the correct moves (and cancel flags) are
 * forwarded to the visualisation player when the user executes or undoes moves.
 *
 * The window.__test interface (exposed in src/index.ts) allows tests to:
 *   - setAlgForTest(alg)   - set up a deterministic algorithm without using the UI
 *   - simulateMove(move)   - fake a physical cube move event
 *   - getVisualLog()       - read what was sent to addVisualMove()
 *   - clearVisualLog()     - reset the log between assertions
 *   - setOverrideEnabled() - control the override-alg feature
 */

import { test, expect } from '@playwright/test';
import { VisualMove, getVisualLog as getVisualLog, doGanMoves, doUserFrameMoves, setup, clearVisualLog, extractSeqFromVis, flattenMoveSeq, setTestAlgConfig } from './testUtils';



test("[move-1] move-handling: all 4 moves appear with cancel=false", async ({ page }) => {
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

test("[move-2] move-handling: one forward move in log", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "R", cancel: false }]);
});

// --- Undo / backward moves ----------------------------------------------------

test("[move-3] move-handling: cancel=true for the undo visual move", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");              // forward: R, U
  await clearVisualLog(page);
  await doGanMoves(page, "U'");              // undo U -> should send {U', cancel:true}
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "U'", cancel: true }]);
});

test("[move-4] move-handling: cancel=true", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  await doGanMoves(page, "R'");             // undo R (returns to initial state)
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "R'", cancel: true }]);
});

test("[move-5] move-handling: forward cancel=false after undo", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U U' U");             // R fwd, U fwd, U' undo, U redo
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "U'", cancel: true },
    { move: "U", cancel: false },
  ]);
});

test("[move-6] move-handling: both have cancel=true", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  await clearVisualLog(page);
  await doGanMoves(page, "U' R'");               // undo U, then undo R
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "U'", cancel: true },
    { move: "R'", cancel: true },
  ]);
});

test("[move-7] move-handling: forward moves are cancel=false", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R R' R U R' U'");
  // R(fwd), R'(undo), R(fwd), U(fwd), R'(fwd), U'(fwd)
  const log = await getVisualLog(page);
  expect(log[0]).toEqual({ move: "R", cancel: false });
  expect(log[1]).toEqual({ move: "R'", cancel: true });    // undo
  expect(log[2]).toEqual({ move: "R", cancel: false });    // redo
  expect(log.slice(2)).toEqual([
    { move: "R", cancel: false },
    { move: "U", cancel: false },
    { move: "R'", cancel: false },
    { move: "U'", cancel: false },
  ]);
});

// --- Double moves (R2 / U2) ---------------------------------------------------

test("[move-8] move-handling: two physical U moves each produce one visual move", async ({ page }) => {
  await setup(page, "R U2 R'");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  // U U -> matches U2 on first U (index 1), then second U advances to index 1 again -> skip
  // The exact transformed move depends on the face map; at minimum two visual entries are sent.
  await doGanMoves(page, "U U");
  const log = await getVisualLog(page);
  // Each physical U maps through invertFaceMap to a visual move
  expect(log).toEqual([
    { move: "U", cancel: false },
    { move: "U", cancel: false },
  ]);
});

test("[move-9] move-handling: undo of partial double move shows U' with cancel=true", async ({ page }) => {
  await setup(page, "R U2 R'");
  await doGanMoves(page, "R U");    // R forward, then U (first half of U2 - bad move)
  await clearVisualLog(page);
  // U' cancels the partial U2 bad move, returning to R state (patternStates[0])
  await doGanMoves(page, "U'");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "U'", cancel: true }]);
});

// --- Wide moves ---------------------------------------------------------------

test("[move-10] move-handling: single forward move visualises as R", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "R", cancel: false }]);
});

// --- Mixed: wide + regular + undo --------------------------------------------

test("[move-11] move-handling: bad move F after R is shown as F in visual log", async ({ page }) => {
  await setup(page, "R U R' U'");
  // F is a bad move - doesn't match any pattern state.
  // The app still sends it to the visualisation so the user sees their mistake.
  await doGanMoves(page, "R F");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },
    { move: "F", cancel: false },
  ]);
});

// --- Override dialog ---------------------------------------------------------

test("[move-12] move-handling: override container hidden when alg completed without bad moves", async ({ page }) => {
  await setup(page, "R U R' U'");
  setTestAlgConfig(page, { overrideEnabled: true });
  await doGanMoves(page, "R U R' U'");
  const hidden = await page.$eval('#alg-override-container', (el: HTMLElement) =>
    el.style.display === 'none' || el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
  );
  expect(hidden).toBe(true);
});
test("[move-12b] move-handling: override container showing for minimal alternate direction ", async ({ page }) => {
  await setup(page, "M2 U' M2 U2' M2 U' M2");
  // enable override
  await setTestAlgConfig(page, { overrideEnabled: true, category: 'PLL' });
  await doUserFrameMoves(page, "M2 U M2 U2' M2 U M2");
  const hidden = await page.$eval('#alg-override-container', (el: HTMLElement) =>
    el.style.display === 'none' || el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
  );
  expect(hidden).toBe(false);
});

// --- Visual log integrity -----------------------------------------------------

test("[move-13] move-handling: clearVisualLog resets the log", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R");
  await clearVisualLog(page);
  const log = await getVisualLog(page);
  expect(log).toHaveLength(0);
});

test("[move-14] move-handling: setAlgForTest clears the visual log", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R");
  // Re-setup same alg - log should be reset
  await page.evaluate(() => (window as any).__test.setAlgForTest("U R U' R'"));
  const log = await getVisualLog(page);
  expect(log).toHaveLength(0);
});

// --- Longer alg: CFOP F2L case ------------------------------------------------

test("[move-15] move-handling: correct forward sequence matches algorithm moves", async ({ page }) => {
  await setup(page, "R U R' U' R' F R F'");
  await doUserFrameMoves(page, "R U R' U' R' F R F'");
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual(flattenMoveSeq("R U R' U' R' F R F'"));
  for (const entry of log) {
    expect(entry.cancel).toBe(false);
  }
});

test("[move-16] move-handling: undo sequence has cancel=true", async ({ page }) => {
  await setup(page, "R U R' U' R' F R F'");
  await doUserFrameMoves(page, "R U R'");          // forward 3 moves
  await clearVisualLog(page);
  // Undo R' by doing R (backward from index 2 -> index 1)
  await doUserFrameMoves(page, "R");
  const log = await getVisualLog(page);
  expect(log).toEqual([{ move: "R", cancel: true }]);
});

// --- Different alg structures -------------------------------------------------

test("[move-17] move-handling: OLL forward sequence matches algorithm moves", async ({ page }) => {
  await setup(page, "R U2 R' U' R U' R'");
  await doUserFrameMoves(page, "R U U R' U' R U' R'");
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual(flattenMoveSeq("R U2 R' U' R U' R'"));
  for (const entry of log) {
    expect(entry.cancel).toBe(false);
  }
});

// --- Partial double-move undo (same-index recovery) ---------------------------
// Alg: R U2 R  (U2 is the double move in the middle)
// When the user makes bad U moves and recovers back to the same pattern state
// (index stays at 0 after R), the recovery move must use cancel=true - NOT the
// inverse of the alg move at that position.

test("[move-18] move-handling: R U U' U U' U U R solves R U2 R with correct visual log", async ({ page }) => {
  // Sequence: R fwd, then 3x (U bad + U' recovery), then U U (= U2 fwd), then R fwd.
  await setup(page, "R U2 R");
  await doGanMoves(page, "R U U' U U' U U R");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },   // R - forward alg move
    { move: "U", cancel: false },   // U - bad (no pattern match)
    { move: "U'", cancel: true },   // U' - recovery back to same index
    { move: "U", cancel: false },   // U - bad again
    { move: "U'", cancel: true },   // U' - recovery again
    { move: "U", cancel: false },   // U - bad again
    { move: "U", cancel: false },   // U - forward (second half of U2)
    { move: "R", cancel: false },   // R - forward alg move (case solved)
  ]);
  // Verify the case was actually solved
  const info: any = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(info.timerState).toBe('STOPPED');
});

test("[move-19] move-handling: R U' U U' U U' U' R solves R U2 R with correct visual log", async ({ page }) => {
  // Sequence: R fwd, then 3x (U' bad + U recovery), then U' U' (= U2 fwd), then R fwd.
  await setup(page, "R U2 R");
  await doGanMoves(page, "R U' U U' U U' U' R");
  const log = await getVisualLog(page);
  expect(log).toEqual([
    { move: "R", cancel: false },   // R - forward alg move
    { move: "U'", cancel: false },   // U' - bad
    { move: "U", cancel: true },   // U  - recovery back to same index
    { move: "U'", cancel: false },   // U' - bad
    { move: "U", cancel: true },   // U  - recovery
    { move: "U'", cancel: false },   // U' - bad
    { move: "U'", cancel: false },   // U' - forward (second half of U2)
    { move: "R", cancel: false },   // R - forward alg move (case solved)
  ]);
  // Verify the case was actually solved
  const info: any = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(info.timerState).toBe('STOPPED');
});

test("[move-20] move-handling: L U2 L' U' L U L' with correct visual log", async ({ page }) => {
  const alg = "L U2 L' U' L U L'";
  await setup(page, alg);
  await doUserFrameMoves(page, alg);
  const log = await getVisualLog(page);
  expect(extractSeqFromVis(log)).toEqual(flattenMoveSeq(alg));
  // Verify the case was actually solved
  const info: any = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(info.timerState).toBe('STOPPED');
});
