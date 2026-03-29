/**
 * Stats persistence tests - verifies that localStorage correctly stores
 * success counts, fail counts, times, LastResults, and that stats reset
 * and deleteAlgorithm properly clear all stored keys.
 *
 * NOTE: In keyboard mode (no GAN connection), after algorithm completion the
 * timer transitions STOPPED -> READY immediately via transitionToNextCase().
 * By the time we check debug info, timerState is already READY. We verify
 * outcomes through the persisted localStorage values instead.
 */

import { test, expect } from '@playwright/test';
import { setup, doGanMoves, getDebug, setTestAlgConfig } from './testUtils';

const ALG = "R U R' U'";

/** Helper: get all stats for ALG via test harness. */
async function getStats(page: any) {
  return page.evaluate((a: string) => (window as any).__test.getStatsForAlg(a), ALG);
}

/** Helper: clear all stats for ALG so each test starts clean. */
async function clearStats(page: any) {
  await page.evaluate((a: string) => (window as any).__test.resetStatsForAlg(a), ALG);
}

/** Setup with checkedAlgorithms populated (needed for fail tracking in 300ms timeout). */
async function setupWithConfig(page: any) {
  await setup(page, ALG);
  await setTestAlgConfig(page, { algorithm: ALG });
  await clearStats(page);
}

/** Execute the alg with a timer tick delay after the first move. */
async function solveAlg(page: any) {
  await doGanMoves(page, "R");
  await page.waitForTimeout(50);
  await doGanMoves(page, "U R' U'");
}

// --- Success stats -------------------------------------------------------

test("[stats-1] successful solve stores correct stats", async ({ page }) => {
  await setupWithConfig(page);
  await solveAlg(page);

  const stats = await getStats(page);
  expect(stats.successCount).toBe('1');
  expect(stats.failedCount).toBeNull();
  expect(stats.lastResults).toBe('S');
  expect(stats.lastTimes).toBeTruthy();
  const times = stats.lastTimes.split(',').map(Number);
  expect(times).toHaveLength(1);
  expect(times[0]).toBeGreaterThan(0);
  expect(Number(stats.best)).toBe(times[0]);
  expect(stats.consecutiveCorrect).toBe('1');
});

// --- Fail stats (wrong move) ---------------------------------------------

test("[stats-2] wrong-move fail stores correct stats", async ({ page }) => {
  await setupWithConfig(page);

  // Start alg, wait for timer tick, then make a wrong move
  await doGanMoves(page, "R");
  await page.waitForTimeout(50);
  await doGanMoves(page, "U R'");
  await doGanMoves(page, "F"); // wrong move
  // Wait for the 300ms bad-move timeout (sets hadBadMoveDuringExec, hasFailedAlg)
  await page.waitForTimeout(400);

  // Verify intermediate state while still RUNNING
  let info = await getDebug(page);
  expect(info.hadBadMoveDuringExec).toBe(true);

  // Undo the wrong move and complete
  await doGanMoves(page, "F'");
  await doGanMoves(page, "U'");

  const stats = await getStats(page);
  // FailedCount = 1 from STOPPED handler (stage 4c: !solveSuccess)
  expect(stats.failedCount).toBe('1');
  expect(stats.successCount).toBeNull();
  expect(stats.lastResults).toBe('F');
  expect(stats.lastTimes).toBeTruthy();
  expect(stats.consecutiveCorrect).toBe('0');
});

// --- TPS fail stats ------------------------------------------------------

test("[stats-3] TPS fail stores correct stats", async ({ page }) => {
  await setupWithConfig(page);

  // Set extremely high TPS threshold so any normal solve is "too slow"
  await page.evaluate(() => (window as any).__test.setTPSFail(true, 999));

  await solveAlg(page);

  const stats = await getStats(page);
  expect(stats.failedCount).toBe('1');
  expect(stats.successCount).toBeNull();
  expect(stats.lastResults).toBe('F');
  expect(stats.lastTimes).toBeTruthy();
  expect(stats.consecutiveCorrect).toBe('0');
});

// --- Multiple solves accumulate ------------------------------------------

test("[stats-4] multiple successful solves accumulate stats", async ({ page }) => {
  await setupWithConfig(page);

  // Solve #1
  await solveAlg(page);
  let stats = await getStats(page);
  expect(stats.successCount).toBe('1');

  // Solve #2 - setup again (preserving stats via page-level localStorage)
  await setup(page, ALG);
  await solveAlg(page);

  stats = await getStats(page);
  expect(stats.successCount).toBe('2');
  expect(stats.lastResults).toBe('S,S');
  const times = stats.lastTimes.split(',').map(Number);
  expect(times).toHaveLength(2);
  expect(stats.consecutiveCorrect).toBe('2');
});

// --- deleteAlgorithm clears all stats ------------------------------------

test("[stats-5] deleteAlgorithm clears all stored stats", async ({ page }) => {
  await setupWithConfig(page);
  await solveAlg(page);
  let stats = await getStats(page);
  expect(stats.successCount).toBe('1');

  // Delete the algorithm
  await page.evaluate((a: string) => {
    (window as any).__test.deleteAlgorithm('OLL', a);
  }, ALG);

  stats = await getStats(page);
  expect(stats.lastTimes).toBeNull();
  expect(stats.lastTimesCD).toBeNull();
  expect(stats.best).toBeNull();
  expect(stats.bestCD).toBeNull();
  expect(stats.failedCount).toBeNull();
  expect(stats.successCount).toBeNull();
  expect(stats.lastResults).toBeNull();
  expect(stats.consecutiveCorrect).toBeNull();
  expect(stats.learned).toBeNull();
});

// --- Stats modal reset clears all stats ----------------------------------

test("[stats-6] stats modal reset clears all stored stats", async ({ page }) => {
  await setupWithConfig(page);
  await solveAlg(page);
  let stats = await getStats(page);
  expect(stats.successCount).toBe('1');

  // Reset via the test harness (mirrors the modal reset handler)
  await page.evaluate((a: string) => {
    (window as any).__test.resetStatsForAlg(a);
  }, ALG);

  // All stat keys cleared (except Learned - modal reset does not clear it)
  stats = await getStats(page);
  expect(stats.lastTimes).toBeNull();
  expect(stats.lastTimesCD).toBeNull();
  expect(stats.best).toBeNull();
  expect(stats.bestCD).toBeNull();
  expect(stats.failedCount).toBeNull();
  expect(stats.successCount).toBeNull();
  expect(stats.lastResults).toBeNull();
  expect(stats.consecutiveCorrect).toBeNull();
});
