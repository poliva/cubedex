/**
 * Countdown overlay tests - verifies that the countdown overlay and last-time-display
 * elements are correctly placed in the DOM and that the countdown shows/hides correctly.
 */
import { test, expect } from '@playwright/test';

test("[cd-1] countdown: countdown overlay is inside #cube element", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const isInsideCube = await page.evaluate(() => {
    const overlay = document.getElementById('countdown-overlay');
    return overlay?.parentElement?.id === 'cube';
  });
  expect(isInsideCube).toBe(true);
});

test("[cd-2] countdown: last-time-display is in right-side, not in stats grid", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const isInsideRightSide = await page.evaluate(() => {
    const el = document.getElementById('last-time-display');
    return !!el?.closest('#right-side');
  });
  expect(isInsideRightSide).toBe(true);

  const lastTimeBoxInGrid = await page.evaluate(() => {
    return document.querySelector('#stats-grid #last-time-box');
  });
  expect(lastTimeBoxInGrid).toBeNull();
});

test("[cd-3] countdown: countdown hides alg text and shows overlay in cube area only", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Select OLL and load all subsets
  await page.selectOption('#category-select', { label: 'OLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(500);

  // Enable "Ignore Selection" so all cases are included without individual toggles
  await page.evaluate(() => {
    const el = document.getElementById('select-all-toggle') as HTMLInputElement;
    if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
  });
  await page.waitForTimeout(200);

  // Click train once to populate algInput (may trigger auto-select)
  await page.click('#train-alg');
  await page.waitForTimeout(500);

  // Enable countdown mode
  await page.evaluate(() => {
    const el = document.getElementById('countdown-mode-toggle') as HTMLInputElement;
    if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
  });

  // Click train again to trigger a countdown
  await page.click('#train-alg');
  await page.waitForTimeout(500);

  // During 3-second countdown: alg-display should be empty
  const algText = await page.locator('#alg-display').textContent();
  expect((algText || '').trim()).toBe('');

  // Twisty-player elements should be hidden (visibility: hidden) during countdown
  const playerHidden = await page.evaluate(() => {
    const player = document.querySelector('#cube > twisty-player') as HTMLElement;
    return player ? getComputedStyle(player).visibility === 'hidden' : false;
  });
  expect(playerHidden).toBe(true);

  // Countdown overlay should be visible (inside #cube, no longer covering entire container)
  const overlayHidden = await page.evaluate(() => {
    return document.getElementById('countdown-overlay')?.classList.contains('hidden');
  });
  expect(overlayHidden).toBe(false);

  // Left-side should remain visible (overlay is scoped to #cube only)
  const leftVisible = await page.evaluate(() => {
    const el = document.getElementById('left-side');
    return el && getComputedStyle(el).visibility !== 'hidden';
  });
  expect(leftVisible).toBe(true);
});
