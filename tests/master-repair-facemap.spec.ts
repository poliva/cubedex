/**
 * masterRepairFaceMap tests - verifies cross-algorithm rotation accumulation,
 * reset behavior, and correct input acceptance in rotated frames.
 *
 * Covers: d', d, f, S moves and their rotation contributions,
 * accumulation across multiple algorithms, and the rotation-reset button.
 */

import { test, expect } from '@playwright/test';
import { doGanMoves, doUserFrameMoves, setup, getDebug, setKeepRotation, loadNextAlgForTest, resetRotation } from './testUtils';

// --- Single algorithm rotation: d' (y component) ----------------------

test("[mrf-1] master-repair-facemap: d' alg sets masterRepairFaceMap to y", async ({ page }) => {
  // d' has rotation component y. After completing "R d' R'", map should reflect y.
  // y rotation cycle: F->L, L->B, B->R, R->F (and U/D unchanged)
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  // d' = U' on GAN. After y rotation: alg R' -> GAN B'.
  await doUserFrameMoves(page, "R d' R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });
});

test("[mrf-2] master-repair-facemap: u alg sets masterRepairFaceMap to y", async ({ page }) => {
  // u has rotation component y. After completing "R u R'", map should reflect y.
  await setup(page, "R u R'");
  await setKeepRotation(page, true);
  // u = D on GAN. After y rotation: alg R' -> GAN B'.
  await doUserFrameMoves(page, "R u R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });
});

test("[mrf-3] master-repair-facemap: d alg sets masterRepairFaceMap to y'", async ({ page }) => {
  // d has rotation component y'. y' cycle: F->R, R->B, B->L, L->F
  await setup(page, "R d R'");
  await setKeepRotation(page, true);
  // d = U on GAN. After y' rotation: alg R' -> GAN F'.
  await doUserFrameMoves(page, "R d R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "R", B: "L", R: "B", L: "F" });
});

// --- Single algorithm rotation: f (z component) ----------------------

test("[mrf-4] master-repair-facemap: f alg sets masterRepairFaceMap to z", async ({ page }) => {
  // f has rotation component z. z cycle: U->R, R->D, D->L, L->U
  await setup(page, "U f U'");
  await setKeepRotation(page, true);
  // f = B on GAN. After z rotation: alg U' -> GAN L'.
  await doGanMoves(page, "U B L'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "R", D: "L", F: "F", B: "B", R: "D", L: "U" });
});

test("[mrf-5] master-repair-facemap: f' alg sets masterRepairFaceMap to z'", async ({ page }) => {
  // f' has rotation component z'. z' cycle: U->L, L->D, D->R, R->U
  await setup(page, "U f' U'");
  await setKeepRotation(page, true);
  // f' = B' on GAN. After z' rotation: alg U' -> GAN R'.
  await doGanMoves(page, "U B' R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "L", D: "R", F: "F", B: "B", R: "U", L: "D" });
});

// --- Single algorithm rotation: S (z component) ----------------------

test("[mrf-6] master-repair-facemap: S alg sets masterRepairFaceMap to z", async ({ page }) => {
  // S has rotation component z. GAN reports F' B for S.
  await setup(page, "U S U'");
  await setKeepRotation(page, true);
  // S = F' B on GAN. After z rotation: alg U' -> GAN L'.
  await doGanMoves(page, "U F' B L'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "R", D: "L", F: "F", B: "B", R: "D", L: "U" });
});

test("[mrf-7] master-repair-facemap: S' alg sets masterRepairFaceMap to z'", async ({ page }) => {
  // S' has rotation component z'. GAN reports F B' for S'.
  await setup(page, "U S' U'");
  await setKeepRotation(page, true);
  // S' = F B' on GAN. After z' rotation: alg U' -> GAN R'.
  await doGanMoves(page, "U F B' R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "L", D: "R", F: "F", B: "B", R: "U", L: "D" });
});

// --- Single algorithm rotation: E (y' component) ---------------------

test("[mrf-8] master-repair-facemap: E alg sets masterRepairFaceMap to y'", async ({ page }) => {
  // E has rotation component y'. GAN reports U D' for E (or equiv).
  // Actually E is the equatorial layer - follows D direction - y' component.
  // E = U D' according to face-move decomposition? Let's verify:
  // E moves the middle layer between U and D in the same direction as D.
  // Resulting: E equals the two face moves that leave U/D stationary but shift middles.
  // GAN reports: U D' (the two face moves that make up E).
  await setup(page, "R E R'");
  await setKeepRotation(page, true);
  // E has y' rotation. After E, user's frame is y'-rotated.
  // R' after E in user's frame -> GAN B' (y' maps: R->B).
  await doUserFrameMoves(page, "R E R'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "R", B: "L", R: "B", L: "F" });
});

// --- Accumulation across two algorithms ------------------------------

test("[mrf-9] master-repair-facemap: two d' algs accumulate y + y = y2", async ({ page }) => {
  // First alg: R d' R' -> after y rotation
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // After first alg: map is y (F->L, L->B, B->R, R->F)
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "L", B: "R", R: "F", L: "B" });

  // Load second alg: also has d'
  await loadNextAlgForTest(page, "R d' R'");

  // Now masterRepairFaceMap maps: physical B -> canonical R (from y).
  // So physical R -> canonical F -> but we need alg R.
  // With y rotation active: physical B = canonical R, physical R = canonical F.
  // For d' (= alg U'): GAN reports U', but master map U->U so still U'.
  // After d' y rotation inside alg: alg R' = GAN L' (from y within alg).
  // But masterRepairFaceMap transforms first: physical move -> repaired move.
  // So user does physical B (which is canonical R after masterRepairFaceMap y).
  // Then physical U' for d' -> canonical U' (U is unchanged in y map).
  // Then after d' within-alg rotation, alg R' maps to GAN that is shifted by both the
  // within-alg rotation AND the master map...
  // 
  // Actually, let me think more carefully. The master repair maps physical->canonical.
  // After first alg with y: masterRepairFaceMap = {U:U, D:D, F:L, B:R, R:F, L:B}
  // So physical R -> F, physical B -> R, physical L -> B, physical F -> L.
  //
  // Second alg is "R d' R'". User needs to execute:
  // - Alg R: physical move that maps to canonical R. masterRepairFaceMap[B]=R, so physical B.
  // - Alg d': physical U' (since U->U in the map).
  // - Alg R' after d' (with y within the alg): 
  //   Within the alg, after d', alg's R' maps to GAN B' (within-alg y shift).
  //   But the master map also applies: we need physical move X such that masterRepairFaceMap[X] = B'.
  //   masterRepairFaceMap[L] = B, so physical L' maps to canonical B'.
  await doGanMoves(page, "B U' L'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // After two y rotations: y2 (F->B, B->F, R->L, L->R, U->U, D->D)
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "B", B: "F", R: "L", L: "R" });
});

test("[mrf-10] master-repair-facemap: d' then d accumulates y + y' = identity", async ({ page }) => {
  // First alg: R d' R' -> y rotation
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // Load second alg with d (y' rotation - cancels the y)
  await loadNextAlgForTest(page, "R d R'");

  // masterRepairFaceMap is y: {F:L, B:R, R:F, L:B}
  // For canonical R: need physical X where map[X]=R -> X=B. So physical B.
  // For canonical d (= U on GAN): physical U (U->U in map).
  // After y' within alg: alg R' -> GAN F' within alg.
  // But master map also applies: need physical X where map[X]=F' -> map[R]=F so physical R'.
  await doGanMoves(page, "B U R'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // y + y' = identity
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
});

test("[mrf-11] master-repair-facemap: d' then f accumulates y + z", async ({ page }) => {
  // First alg: R d' R' -> y rotation
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // Load second alg with f (z rotation)
  await loadNextAlgForTest(page, "U f U'");

  // masterRepairFaceMap is y: {U:U, D:D, F:L, B:R, R:F, L:B}
  // For canonical U: physical U (U->U).
  // For canonical f (= B on GAN): need physical X where map[X]=B -> map[L]=B so physical L.
  // After z rotation within alg: alg U' -> GAN L'.
  // Need physical X where map[X]=L -> map[F]=L so physical F'.
  await doGanMoves(page, "U L F'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // After y then z: compose y then z.
  // y: {U:U, D:D, F:L, B:R, R:F, L:B}
  // z: {U:R, D:L, F:F, B:B, R:D, L:U}
  // compose(y, z)[face] = y[z[face]]
  // compose[U] = y[z[U]] = y[R] = F
  // compose[D] = y[z[D]] = y[L] = B
  // compose[F] = y[z[F]] = y[F] = L
  // compose[B] = y[z[B]] = y[B] = R
  // compose[R] = y[z[R]] = y[D] = D
  // compose[L] = y[z[L]] = y[U] = U
  expect(info.masterRepairFaceMap).toEqual({ U: "F", D: "B", F: "L", B: "R", R: "D", L: "U" });
});

// --- Third algorithm after accumulated rotation ----------------------

test("[mrf-12] master-repair-facemap: third alg works correctly after y2 accumulation", async ({ page }) => {
  // Build up y2 rotation through two d' algs
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  await loadNextAlgForTest(page, "R d' R'");
  await doGanMoves(page, "B U' L'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // Now at y2: {F:B, B:F, R:L, L:R}

  // Load a simple alg: R U R' U'
  await loadNextAlgForTest(page, "R U R' U'");

  // y2: physical R->L, physical L->R, physical F->B, physical B->F
  // For canonical R: need physical X where map[X]=R -> map[L]=R so physical L.
  // For canonical U: physical U (unchanged).
  // For canonical R': physical L'.
  // For canonical U': physical U'.
  await doGanMoves(page, "L U L' U'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // y2 + identity = y2 (simple alg has no rotation)
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "B", B: "F", R: "L", L: "R" });
});

// --- rotation-reset-btn ----------------------------------------------

test("[mrf-13] master-repair-facemap: clears masterRepairFaceMap after d' alg", async ({ page }) => {
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doUserFrameMoves(page, "R d' R'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).not.toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  // Click reset button (simulated via test helper)
  await resetRotation(page);
  info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
});

test("[mrf-14] master-repair-facemap: after reset, normal inputs work for next alg", async ({ page }) => {
  // Do an alg with d' to accumulate rotation
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");
  let info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');

  // Reset rotation
  await resetRotation(page);

  // Load next alg - should accept normal (unrotated) inputs
  await loadNextAlgForTest(page, "R U R' U'");
  await doGanMoves(page, "R U R' U'"); // Normal inputs, no rotation compensation
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

test("[mrf-15] master-repair-facemap: after two accumulated rotations, reset restores normal input", async ({ page }) => {
  // Accumulate y2 through two d' algs
  await setup(page, "R d' R'");
  await setKeepRotation(page, true);
  await doGanMoves(page, "R U' B'");

  await loadNextAlgForTest(page, "R d' R'");
  await doGanMoves(page, "B U' L'");

  let info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "B", B: "F", R: "L", L: "R" });

  // Reset
  await resetRotation(page);
  info = await getDebug(page);
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

  // Normal alg should work with normal inputs
  await loadNextAlgForTest(page, "F R U R' U' F'");
  await doGanMoves(page, "F R U R' U' F'");
  info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
});

// --- keepRotation disabled: map stays identity -----------------------

test("[mrf-16] master-repair-facemap: d' alg does NOT update masterRepairFaceMap", async ({ page }) => {
  await setup(page, "L U' L' d' R U2 R'");
  await setKeepRotation(page, false);
  await doGanMoves(page, "L U' L' U' B U U B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.masterRepairFaceMap).toEqual({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
});
