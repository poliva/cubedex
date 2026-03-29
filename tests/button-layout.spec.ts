/**
 * Button layout tests - verifies that UI buttons (#toggle-move-mask, #reset-practice-btn)
 * are correctly placed inside #alg-display-container and overlap the algorithm display area.
 */
import { test, expect } from '@playwright/test';

async function startTraining(page: any) {
  // Type an algorithm directly into the input and start training
  await page.fill('#alg-input', "R U R' U'");
  await page.click('#train-alg');
  await page.locator('#alg-display-container').waitFor({ state: 'visible', timeout: 5000 });
}

test("[btn-lay-1] button-layout: mask-alg and reset buttons are inside alg-display-container", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Both buttons should be children of #alg-display-container
  const maskBtn = page.locator('#alg-display-container > #toggle-move-mask');
  const resetBtn = page.locator('#alg-display-container > #reset-practice-btn');
  await expect(maskBtn).toBeAttached();
  await expect(resetBtn).toBeAttached();

  // Buttons should NOT be children of #alg-display (they are siblings)
  const maskInAlgDisplay = page.locator('#alg-display > #toggle-move-mask');
  const resetInAlgDisplay = page.locator('#alg-display > #reset-practice-btn');
  await expect(maskInAlgDisplay).toHaveCount(0);
  await expect(resetInAlgDisplay).toHaveCount(0);
});

test("[btn-lay-2] button-layout: mask-alg and reset buttons overlap the alg-display area", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await startTraining(page);

  const container = page.locator('#alg-display-container');
  await expect(container).toBeVisible();

  const algDisplay = page.locator('#alg-display');
  const maskBtn = page.locator('#toggle-move-mask');

  const displayBox = await algDisplay.boundingBox();
  const maskBox = await maskBtn.boundingBox();

  expect(displayBox).toBeTruthy();
  expect(maskBox).toBeTruthy();

  // Mask button should be within the horizontal bounds of alg-display (small tolerance for border/padding)
  expect(maskBox!.x).toBeGreaterThanOrEqual(displayBox!.x - 5);
  expect(maskBox!.x + maskBox!.width).toBeLessThanOrEqual(displayBox!.x + displayBox!.width + 5);

  // Mask button should be within the vertical bounds of alg-display
  expect(maskBox!.y).toBeGreaterThanOrEqual(displayBox!.y - 2);
  expect(maskBox!.y + maskBox!.height).toBeLessThanOrEqual(displayBox!.y + displayBox!.height + 2);
});

test("[btn-lay-3] button-layout: mask-alg and reset buttons have similar size and small height", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await startTraining(page);

  // Unhide reset button for measurement
  await page.locator('#reset-practice-btn').evaluate((el: HTMLElement) => el.classList.remove('hidden'));

  const maskBox = await page.locator('#toggle-move-mask').boundingBox();
  const resetBox = await page.locator('#reset-practice-btn').boundingBox();

  expect(maskBox).toBeTruthy();
  expect(resetBox).toBeTruthy();

  // Both should have small height (under 30px)
  expect(maskBox!.height).toBeLessThan(30);
  expect(resetBox!.height).toBeLessThan(30);

  // Similar width (within 10px of each other)
  expect(Math.abs(maskBox!.width - resetBox!.width)).toBeLessThan(10);

  // Similar height (within 5px of each other)
  expect(Math.abs(maskBox!.height - resetBox!.height)).toBeLessThan(5);
});

test("[btn-lay-4] button-layout: orientation-reset button exists in orientation-hint", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const resetBtn = page.locator('#orientation-hint > #orientation-reset-btn');
  await expect(resetBtn).toBeAttached();

  // Should be hidden by default
  await expect(page.locator('#orientation-reset-btn')).toHaveClass(/hidden/);
});

test("[btn-lay-5] button-layout: train-alg and scramble-to buttons are horizontally aligned", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await startTraining(page);

  const trainBox = await page.locator('#train-alg').boundingBox();
  const scrambleBox = await page.locator('#scramble-to').boundingBox();
  const displayBox = await page.locator('#alg-display').boundingBox();

  expect(trainBox).toBeTruthy();
  expect(scrambleBox).toBeTruthy();
  expect(displayBox).toBeTruthy();

  // All three should be in the same horizontal band (vertical centers within 20px)
  const trainCenter = trainBox!.y + trainBox!.height / 2;
  const scrambleCenter = scrambleBox!.y + scrambleBox!.height / 2;
  const displayCenter = displayBox!.y + displayBox!.height / 2;

  expect(Math.abs(trainCenter - scrambleCenter)).toBeLessThan(20);
  expect(Math.abs(trainCenter - displayCenter)).toBeLessThan(30);
});
