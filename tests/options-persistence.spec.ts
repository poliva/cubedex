/**
 * Options persistence tests - verify that settings are correctly
 * saved to localStorage and survive page reloads.
 */
import { test, expect } from '@playwright/test';

/** Helper: toggle a sr-only checkbox by clicking its label. */
async function toggleCheckbox(page: any, id: string) {
  await page.locator(`label[for="${id}"]`).click();
}

/** Helper: check if a sr-only checkbox is checked. */
async function isChecked(page: any, id: string): Promise<boolean> {
  return page.locator(`#${id}`).isChecked();
}

test("[opt-1] override setting persists after page reload", async ({ page }) => {
  // Navigate to app and wait for it to load
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // Default: overrideAlgEnabled should be true (localStorage default)
  const defaultState = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(defaultState.overrideAlgEnabled).toBe(true);

  // Open settings page
  await page.click('#show-options');
  await page.waitForSelector('#options-container', { state: 'visible' });

  // Override toggle should be checked (default true)
  expect(await isChecked(page, 'override-alg-toggle')).toBe(true);

  // Uncheck the override toggle
  await toggleCheckbox(page, 'override-alg-toggle');
  await page.waitForTimeout(100);

  // Verify state updated
  expect(await isChecked(page, 'override-alg-toggle')).toBe(false);
  const afterUncheck = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(afterUncheck.overrideAlgEnabled).toBe(false);

  // Verify localStorage has the correct value
  const storedValue = await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'));
  expect(storedValue).toBe('false');

  // Reload the page
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // State should still be false after reload
  const afterReload = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(afterReload.overrideAlgEnabled).toBe(false);

  // localStorage should still have false
  const storedAfterReload = await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'));
  expect(storedAfterReload).toBe('false');

  // Open settings again - checkbox should still be unchecked
  await page.click('#show-options');
  await page.waitForSelector('#options-container', { state: 'visible' });
  expect(await isChecked(page, 'override-alg-toggle')).toBe(false);

  // Re-enable and verify persistence
  await toggleCheckbox(page, 'override-alg-toggle');
  await page.waitForTimeout(100);

  const storedAfterRecheck = await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'));
  expect(storedAfterRecheck).toBe('true');

  // Reload again
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // Debug: check what localStorage has after reload
  const lsAfterFinalReload = await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'));

  const finalState = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(finalState.overrideAlgEnabled).toBe(true);
});

test("[opt-2] multiple settings persist independently after reload", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // Open settings
  await page.click('#show-options');
  await page.waitForSelector('#options-container', { state: 'visible' });

  // Set specific states: override=off, resetPractice=off, keepRotation=on
  if (await isChecked(page, 'override-alg-toggle')) await toggleCheckbox(page, 'override-alg-toggle');
  if (await isChecked(page, 'reset-practice-toggle')) await toggleCheckbox(page, 'reset-practice-toggle');
  if (!(await isChecked(page, 'keep-rotation-toggle'))) await toggleCheckbox(page, 'keep-rotation-toggle');
  await page.waitForTimeout(100);

  // Verify localStorage values
  expect(await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'))).toBe('false');
  expect(await page.evaluate(() => localStorage.getItem('resetPracticeEnabled'))).toBe('false');
  expect(await page.evaluate(() => localStorage.getItem('keepRotation'))).toBe('true');

  // Reload
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // Verify state after reload
  const debug = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(debug.overrideAlgEnabled).toBe(false);
  expect(debug.resetPracticeEnabled).toBe(false);
  expect(debug.keepRotationEnabled).toBe(true);
});

test("[opt-3] toggling another setting does not clobber override setting", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // Open settings and disable override
  await page.click('#show-options');
  await page.waitForSelector('#options-container', { state: 'visible' });
  if (await isChecked(page, 'override-alg-toggle')) await toggleCheckbox(page, 'override-alg-toggle');
  await page.waitForTimeout(50);

  // Now toggle a different setting (keepRotation)
  await toggleCheckbox(page, 'keep-rotation-toggle');
  await page.waitForTimeout(50);

  // Override should still be false in both state and localStorage
  const debug = await page.evaluate(() => (window as any).__test.getDebugInfo());
  expect(debug.overrideAlgEnabled).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('overrideAlgEnabled'))).toBe('false');
});
