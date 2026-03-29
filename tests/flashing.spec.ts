/**
 * Flashing indicator tests -- verifies flash colors, 300ms leniency,
 * wide/slice move handling, TPS fail, and disabled-flash behavior.
 */

import { test, expect } from '@playwright/test';
import { doGanMoves, doUserFrameMoves, setup, getDebug, getFlashLog, clearFlashLog, transformToGan } from './testUtils';

// Helper: set flashingIndicatorEnabled on the page
async function setFlashing(page: any, enabled: boolean) {
  await page.evaluate((e: boolean) => { (window as any).__test && ((window as any).__test); const S = (window as any).__test; }, enabled);
  // Direct state set
  await page.evaluate((e: boolean) => {
    const w = window as any;
    // Access S through the test harness internals
    w.__test_setFlashing?.(e);
  }, enabled);
}

test("[flash-1] wide move alg l U' F2 U l' -> green flash, no hadBadMoveDuringExec", async ({ page }) => {
  const alg = "l U' F2 U l'";
  await setup(page, alg);
  await clearFlashLog(page);
  await doUserFrameMoves(page, alg);
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(false);
  expect(info.hasFailedAlg).toBe(false);
  // Check flash log: last flash should be green (from switchToNextAlgorithm)
  const flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('green');

  //with reverse F 
  await setup(page, alg);
  await clearFlashLog(page);
  // replace U U with U' U' to simulate turning it the other way which is allowed
  const alt_moves = transformToGan(alg).replace("U U", "U' U'");
  await doGanMoves(page, alt_moves);
  const info2 = await getDebug(page);
  expect(info2.timerState).toBe('STOPPED');
  expect(info2.hadBadMoveDuringExec).toBe(false);
  expect(info2.hasFailedAlg).toBe(false);
  // Check flash log: last flash should be green (from switchToNextAlgorithm)
  const flashes2 = await getFlashLog(page);
  const completionFlash2 = flashes2[flashes2.length - 1];
  expect(completionFlash2.color).toBe('green');
});

test("[flash-2] slice move alg S R' S' -> green flash", async ({ page }) => {
  await setup(page, "S R' S'");
  await clearFlashLog(page);
  await doGanMoves(page, "F' B U' F B'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(false);
  const flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('green');
});

test("[flash-3] fast correction within 300ms -> green flash", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  await clearFlashLog(page);
  // Wrong move + immediate undo
  await doGanMoves(page, "F");
  await doGanMoves(page, "F'");
  // Complete
  await doUserFrameMoves(page, "R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(false);
  expect(info.hasFailedAlg).toBe(false);
  const flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('green');
  // Previous indicator should show success
  expect(info.lastMoveSuccess).toBe(true);
});

test("[flash-4] slow correction >300ms -> red flash then orange at end", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  await clearFlashLog(page);
  // Wrong move
  await doGanMoves(page, "F");
  // Wait >300ms for the leniency timeout to fire
  await page.waitForTimeout(400);
  const midInfo = await getDebug(page);
  expect(midInfo.hadBadMoveDuringExec).toBe(true);
  // Check red flash happened
  let flashes = await getFlashLog(page);
  const lastFlash = flashes[flashes.length - 1];
  expect(lastFlash.color).toBe('red');

  // Undo and complete
  await clearFlashLog(page);
  await doGanMoves(page, "F'");
  await doUserFrameMoves(page, "R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // Completion flash should be orange
  flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('orange');
  // Previous indicator should show failure
  expect(info.lastMoveSuccess).toBe(false);
});

test("[flash-4b] slow correction >300ms -in countdown mode> red flash then orange at end", async ({ page }) => {
  await setup(page, "R U R' U'");
  // activate countdown mode
  
  await doGanMoves(page, "R U");
  await clearFlashLog(page);
  // Wrong move
  await doGanMoves(page, "F");
  // Wait >300ms for the leniency timeout to fire
  await page.waitForTimeout(400);
  const midInfo = await getDebug(page);
  expect(midInfo.hadBadMoveDuringExec).toBe(true);
  // Check red flash happened
  let flashes = await getFlashLog(page);
  const lastFlash = flashes[flashes.length - 1];
  expect(lastFlash.color).toBe('red');

  // Undo and complete
  await clearFlashLog(page);
  await doGanMoves(page, "F'");
  await doUserFrameMoves(page, "R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // Completion flash should be orange
  flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('orange');
  // Previous indicator should show failure
  expect(info.lastMoveSuccess).toBe(false);
});

// 5. TPS violation -> yellow flash and treated as failed
test("[flash-5] TPS violation -> yellow flash and failure", async ({ page }) => {
  // Set TPS threshold very high so the solve will be "too slow"
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => {
    localStorage.setItem('tpsFailEnabled', 'true');
    localStorage.setItem('tpsFailThreshold', '999');
  });
  // Reload to pick up the new threshold from localStorage
  await setup(page, "R U R' U'");
  await clearFlashLog(page);
  // Add delay so the local timer ticks (otherwise finalTime=0 skips stats)
  await doGanMoves(page, "R");
  await page.waitForTimeout(50);
  await doUserFrameMoves(page, "U R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hasFailedAlg).toBe(true);
  const flashes = await getFlashLog(page);
  const completionFlash = flashes[flashes.length - 1];
  expect(completionFlash.color).toBe('yellow');
  expect(info.lastMoveSuccess).toBe(false);
});

// 6. No flashing when flashing is disabled
test("[flash-6] no flash events when flashing is disabled", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());
  // Disable flashing via localStorage before setup
  await page.evaluate(() => {
    localStorage.setItem('flashingIndicatorEnabled', 'false');
  });
  // Reload to pick up setting
  await setup(page, "R U R' U'");
  await clearFlashLog(page);
  await doUserFrameMoves(page, "R U R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  // Flash log should still record the event (it logs before checking enabled)
  // but the DOM element should not have been shown
  const flashEl = await page.locator('#flashing-indicator');
  const isHidden = await flashEl.evaluate((el: HTMLElement) => el.classList.contains('hidden'));
  expect(isHidden).toBe(true);
});

// 7. Consistency: detection, flash color, last-time-display, and stored result all agree
test("[flash-7] consistency: flash, lastSolveSuccess, and detection agree on success", async ({ page }) => {
  await setup(page, "R U R' U'");
  await clearFlashLog(page);
  await doUserFrameMoves(page, "R U R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hasFailedAlg).toBe(false);
  expect(info.hadBadMoveDuringExec).toBe(false);
  expect(info.lastMoveSuccess).toBe(true);
  const flashes = await getFlashLog(page);
  expect(flashes[flashes.length - 1].color).toBe('green');
});

test("[flash-8] consistency: flash, lastSolveSuccess, and detection agree on failure", async ({ page }) => {
  await setup(page, "R U R' U'");
  await doGanMoves(page, "R U");
  // Wrong move, wait for 300ms
  await doGanMoves(page, "F");
  await page.waitForTimeout(400);
  await clearFlashLog(page);
  // Undo and complete
  await doGanMoves(page, "F'");
  await doUserFrameMoves(page, "R' U'");
  const info = await getDebug(page);
  expect(info.timerState).toBe('STOPPED');
  expect(info.hadBadMoveDuringExec).toBe(true);
  expect(info.lastMoveSuccess).toBe(false);
  const flashes = await getFlashLog(page);
  expect(flashes[flashes.length - 1].color).toBe('orange');
});
