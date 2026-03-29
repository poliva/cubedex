/**
 * Diagnostic test for issue ui-17c: verifies that an extra off-path M' after M2 is
 * treated as a wrong move and not as an undo of one of the M steps.
 */
import { test, expect } from '@playwright/test';
import { doUserFrameMoves, doGanMoves, setup, getDebug, getVisualMoves, clearVisualLog } from './testUtils';

test("[diag-17c] debug ui-17c", async ({ page }) => {
  await setup(page, "M2 U2");
  
  // Step 1: execute M2 correctly (reverse direction M'M')
  await doUserFrameMoves(page, "M' M'");
  let info = await getDebug(page);
  console.log('Step 1 - after M2:', { idx: info.currentMoveIndex, badAlg: info.badAlg, timerState: info.timerState });
  console.log('Step 1 log:', info.moveDebugLog);

  // Step 2: extra M' (wrong move)
  await clearVisualLog(page);
  await doUserFrameMoves(page, "M'");
  info = await getDebug(page);
  console.log('Step 2 - after extra M\':', { idx: info.currentMoveIndex, badAlg: info.badAlg });
  console.log('Step 2 log:', info.moveDebugLog.slice(-6));

  // The test expects idx=1 (still at M2 completion), but we get idx=0
  // This tells us M' is being interpreted as an undo of one of the M steps
  expect(info.currentMoveIndex).toBe(1);
});
