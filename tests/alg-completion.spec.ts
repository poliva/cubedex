/**
 * Algorithm completion detection tests - verifies that completion is detected
 * correctly (and NOT falsely) for various algorithm structures, especially those
 * containing wide/slice/rotation moves (d', u, etc.).
 * 
 * Execute this file by typing: `npx playwright test tests/alg-completion.spec.ts` in the terminal.
 */

import { test, expect } from '@playwright/test';
import { doGanMoves, doUserFrameMoves, setup, getDebug, setupCaseFromAlg, setTestAlgConfig, setKeepRotation, loadNextAlgForTest, invertAlgString } from './testUtils';

// --- Basic completion -----------------------------------------------------

test("[alg-comp-1] basic completion + partial + wrong move", async ({ page }) => {
  // alg-comp-1: R U R' U' completes when all moves done
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U R' U'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-2: partial execution does NOT complete
  await setup(page, "R U R' U'");
  await doUserFrameMoves(page, "R U");
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
  expect(info.currentMoveIndex).toBe(1);

  // alg-comp-3: R U R' U' with wrong move does NOT complete
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U R' F"); // F is wrong
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
  expect(info.currentMoveIndex).toBe(2);
});

// --- Algorithms with d' (wide move): FALSE POSITIVE prevention --------

test("[alg-comp-4] d' false positive prevention: partial moves must NOT complete", async ({ page }) => {
  // alg-comp-4: L U' L' U must NOT complete L U' L' d' R U2 R'
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U");
  let info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-5: check currentMoveIndex after L U' L' U
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U");
  info = await getDebug(page);
  expect(info.timerState).not.toBe('STOPPED');
  console.log(`After L U' L' U on d' alg: currentMoveIndex = ${info.currentMoveIndex}`);

  // alg-comp-6: L U' L' U' must NOT complete d' alg
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U'");
  info = await getDebug(page);
  expect(info.timerState).not.toBe('STOPPED');
});

// --- Completion with trailing rotations + wide moves ------------------

test("[alg-comp-7] trailing rotation + wide move completion (raw GAN)", async ({ page }) => {
  // alg-comp-7: If alg ends with y, completing the non-rotation part triggers completion
  await setup(page, "R U R' y");
  await doUserFrameMoves(page, "R U R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-12: L U' L' d' R U2 R' with raw GAN moves L U' L' U' B U U B'
  await setup(page, "L U' L' d' R U2 R'");
  await doGanMoves(page, "L U' L' U' B U U B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Algorithms with u (wide U move) ----------------------------------

test("[alg-comp-8] u/f/y wide move completion", async ({ page }) => {
  // alg-comp-8: D is the GAN face-move for u -> matches at index 1
  await setup(page, "R u R' U'");
  await doGanMoves(page, "R D");
  let info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(1);

  // alg-comp-9: R D B' U' completes R u R' U'
  await setup(page, "R u R' U'");
  await doUserFrameMoves(page, "R u R' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-10: U L' U2 L f R f' completes
  await setup(page, "U L' U2 L f R f'");
  await doGanMoves(page, "U L' U U L B U B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-11: L U' L' y R' U2 R completes
  await setup(page, "L U' L' y R' U2 R");
  await doGanMoves(page, "L U' L' B' U U B");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-11b: same alg using doUserFrameMoves
  await setup(page, "L U' L' y R' U2 R");
  await doUserFrameMoves(page, "L U' L' y R' U2 R");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- Double moves U2 in completion ------------------------------------

test("[alg-comp-13] U2 double move handling", async ({ page }) => {
  // alg-comp-13: two U moves complete the U2 step
  await setup(page, "R U2 R'");
  await doGanMoves(page, "R U U R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-14: only one U does NOT complete
  await setup(page, "R U2 R'");
  await doGanMoves(page, "R U");
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
});

// --- Slice moves completion ------------------------------------

test("[alg-comp-15] slice move completion and partial prevention", async ({ page }) => {
  // alg-comp-15: R' U S' completes with F B'
  await setup(page, "R' U S'");
  await doGanMoves(page, "R' U F B'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-16: S R' S' completes including S rotating states
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B U' F B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-17: S R' S' completes even with wrong moves in between
  await setup(page, "S R' S'");
  await doGanMoves(page, "F' B U' L L' F B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-18: S2 R' S' completes
  await setup(page, "S2 R' S'");
  await doGanMoves(page, "F' B F' B L' F B'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-19: only one S does NOT complete
  await setup(page, "R S");
  await doGanMoves(page, "R F");
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
});

// TODO: add test for U' f' L' F L S

// --- Pattern state uniqueness + keepRotation basic ----------------------

test("[alg-comp-20] pattern state uniqueness + keepRotation basic", async ({ page }) => {
  // alg-comp-20: pattern states length matches algorithm length for d' alg
  await setup(page, "L U' L' d' R U2 R'");
  let info = await getDebug(page);
  expect(info.patternStatesLength).toBe(7);

  // alg-comp-21: completing alg does not affect NEXT alg completion detection
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U R' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- d' alg completion + false positive prevention --------------------

test("[alg-comp-22] d' completion + partial + false positive", async ({ page }) => {
  // alg-comp-22: L U' L' d' R U2 R' completes with doUserFrameMoves
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' R U2 R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-23: partial execution at moveIndex 4
  await setup(page, "L U' L' d' R U2 R'");
  await doUserFrameMoves(page, "L U' L' d' R");
  info = await getDebug(page);
  expect(info.currentMoveIndex).toBe(4);
  expect(info.timerState).not.toBe('STOPPED');

  // alg-comp-24: F U instead of F d' must NOT skip
  await setup(page, "F d' L' U' L F'");
  await doUserFrameMoves(page, "F U");
  info = await getDebug(page);
  expect(info.timerState).not.toBe('STOPPED');
});

// --- Override alg + ignore pieces: FALSE POSITIVE prevention ----------
//
// In the real app, overrideAlgEnabled=true + OLL stickering + ignore pieces
// makes partialStateEquals() very loose (only U-layer orientations + partial
// D-layer are compared). This can cause the override path to fire after just
// a few correct moves, falsely stopping the timer.
//
// These tests start from the ACTUAL OLL case (inverse of the alg applied to
// solved state) to match real-world practice conditions.

test("[alg-comp-25] override OLL false positive prevention", async ({ page }) => {
  // alg-comp-25: L U' L' U must NOT complete from real OLL case
  let alg = "L U' L' d' R U2 R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, { ignore: 'BL; BLD', category: 'OLL', overrideEnabled: true });
  await doUserFrameMoves(page, "L U' L' U");
  let info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-26: correct full execution DOES complete
  alg = "F R U R' U' F'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, { ignore: 'BL; BLD', category: 'OLL', overrideEnabled: true });
  await doUserFrameMoves(page, "F R U R' U' F'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-27: L U' L' U must NOT complete (without ignore)
  alg = "L U' L' d' R U2 R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, { category: 'OLL', overrideEnabled: true });
  await doGanMoves(page, "L U' L' U");
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-28: wrong move must NOT complete
  alg = "F R U R' U' F'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, { ignore: 'BL; BLD', category: 'OLL', overrideEnabled: true });
  await doGanMoves(page, "F U");
  info = await getDebug(page);
  expect(info.timerState).toBe('RUNNING');
});

// --- Bug 1 reproduction: override false positive with F2L stickering --------
//
// overrideAlgEnabled + F2L stickering + ignore pieces can make partialStateEquals
// too loose if the ignore mask is incorrectly rotated. The fix: override detection
// uses unrotated ignore (both states are fixOrientation-normalized).

test("[alg-comp-29] override F2L false positive prevention", async ({ page }) => {
  // alg-comp-29: L U' L' U must NOT trigger override on d' alg
  const alg = "L U' L' d' R U2 R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    ignore: 'BL; BLD',
    category: 'F2L',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "L U' L' U d");
  let info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-30: L U' L' U d' must NOT trigger override
  await setup(page, alg);
  await setTestAlgConfig(page, {
    ignore: 'BL; BLD',
    category: 'F2L',
    overrideEnabled: true,
    algorithm: "L U' L' d' R U2 R'",
  });
  await doUserFrameMoves(page, "L U' L' U d'");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(info.timerState).toBe('RUNNING');
});

// --- Bug 2: keepRotation + pattern matching with repairedMove ----------------
//
// After completing an algorithm with rotation (trailing y), masterRepairFaceMap
// accumulates the rotation. The NEXT algorithm's pattern matching must use
// repairedMove (canonical move) instead of event.move (physical move).

test("[alg-comp-31] keepRotation masterRepairFaceMap tracking", async ({ page }) => {
  // alg-comp-31: R U R' U' has no rotation -> identity masterRepairFaceMap
  await setup(page, "R U R' U'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R U R' U'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  // alg-comp-32: trailing y updates masterRepairFaceMap
  await setup(page, "R U R' y");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });

  // alg-comp-33: second alg accepts physical moves in rotated frame
  await setup(page, "R U R' y");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });
  await loadNextAlgForTest(page, "R U R' U'");
  await doGanMoves(page, "B U B' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- COLL/OLL override: detection + identity/equivalent prevention ----------

test("[alg-comp-34] COLL/OLL override detection and identity prevention", async ({ page }) => {
  // alg-comp-34: COLL inverse solution detected as override
  let alg = "R' U2 R2 U R2 U R2 U2 R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'COLL',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doGanMoves(page, "R U U R R U' R R U' R R U U R");
  let info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(true);
  expect(['STOPPED', 'READY']).toContain(info.timerState);

  // alg-comp-35: identical execution must NOT show override dialog
  alg = "U R U2 R D R' U2 R D' R2";
  await setup(page, alg);
  await setTestAlgConfig(page, {
    category: 'COLL',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "U R U U F F' R D R' U U R D' R R");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(['STOPPED', 'READY']).toContain(info.timerState);

  // alg-comp-36: wide-move equivalent execution must NOT show override dialog
  alg = "L U' L' d' R U2 R'";
  await setup(page, alg);
  await setTestAlgConfig(page, {
    category: 'OLL',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "L U' L' d' R U2 R'");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(['STOPPED', 'READY']).toContain(info.timerState);
});

// --- F2L override equivalence ------------------------------------------------
// "U R U' R'" and "R' F R F'" solve the same F2L case.
// d' F U' F' vs U R U' R' are NOT equivalent from the same starting state.

test("[alg-comp-37] F2L override equivalence detection", async ({ page }) => {
  // alg-comp-37: R' F R F' detected as override for U R U' R'
  let alg = "U R U' R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'F2L',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "R' F R F'");
  let info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(true);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-38: U R U' R' detected as override for R' F R F'
  alg = "R' F R F'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'F2L',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "U R U' R'");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(true);
  expect(info.timerState).toBe('STOPPED');

  // alg-comp-39: d' F U' F' vs U R U' R' are NOT equivalent from same start
  alg = "U R U' R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'F2L',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "U' R U' R'");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-40: U R U' R' vs d' F U' F' are NOT equivalent from same start
  alg = "d' F U' F'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'F2L',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "U R U' R'");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(info.timerState).toBe('RUNNING');
});



// --- COLL override: wide-move false positive + opposite direction -----------

test("[alg-comp-49] COLL wide move false positive + opposite direction override", async ({ page }) => {
  // alg-comp-49: F' r U R' U' r' F R must NOT false-positive override
  let alg = "F' r U R' U' r' F R";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'COLL',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "R' U U R U R' U' R U R' U' R U R' U R");
  let info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(false);
  expect(info.timerState).toBe('RUNNING');

  // alg-comp-50: COLL inverse with opposite-direction double turns detected as override
  alg = "R' U2 R2 U R2 U R2 U2 R'";
  await setup(page, alg);
  await setupCaseFromAlg(page, invertAlgString(alg));
  await setTestAlgConfig(page, {
    category: 'COLL',
    overrideEnabled: true,
    algorithm: alg,
  });
  await doUserFrameMoves(page, "R U U R' R' U' R R U' R' R' U' U' R");
  info = await getDebug(page);
  expect(info.overrideContainerVisible).toBe(true);
  expect(['STOPPED', 'READY']).toContain(info.timerState);
});
