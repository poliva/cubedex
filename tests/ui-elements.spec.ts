/**
 * UI elements tests - consolidated from individual files.
 * Checks existence, visibility, and default state of UI elements.
 */

import { test, expect } from '@playwright/test';
import { setup } from './testUtils';

// --- Page load ------------------------------------------------------

test("[ui-1] ui-elements: page loads without critical console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const criticalErrors = errors.filter(
    (e) => !e.includes('service-worker') && !e.includes('ServiceWorker') && !e.includes('manifest') && !e.includes('compute-pressure')
  );
  expect(criticalErrors).toEqual([]);
});

// --- Orientation ----------------------------------------------------

test("[ui-2] ui-elements: gyroscope toggle exists in options", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#show-options').click();
  await expect(page.locator('#gyroscope-toggle')).toBeAttached();
});

test("[ui-3] ui-elements: orientation hint exists and is hidden by default", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const hint = page.locator('#orientation-hint');
  await expect(hint).toBeAttached();
  await expect(hint).toBeHidden();
});

// --- Mirror / back view --------------------------------------------

test("[ui-4] ui-elements: backview select has mirror and side-by-side options", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const select = page.locator('#backview-select');
  await expect(select).toBeAttached();
  await expect(select.locator('option[value="mirror-view"]')).toBeAttached();
  await expect(select.locator('option[value="side-by-side"]')).toBeAttached();
});

// --- Override -------------------------------------------------------

test("[ui-5] ui-elements: override toggle exists and container is hidden", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#override-alg-toggle')).toBeAttached();
  await expect(page.locator('#alg-override-container')).toBeHidden();
});

// --- Reset practice -------------------------------------------------

test("[ui-6] ui-elements: reset practice toggle exists and button is hidden", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#reset-practice-toggle')).toBeAttached();
  await expect(page.locator('#reset-container')).toBeHidden();
});

// --- Selection ------------------------------------------------------

test("[ui-7] ui-elements: selection toggles and subset checkboxes exist", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#select-all-toggle')).not.toBeChecked();
  await expect(page.locator('#select-all-subsets-toggle')).not.toBeChecked();
  await expect(page.locator('#subset-checkboxes')).toBeVisible();
});

test("[ui-8] ui-elements: max learning input has correct defaults", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#show-options').click();
  const input = page.locator('#max-learning-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('type', 'number');
  await expect(input).toHaveAttribute('min', '1');
  await expect(input).toHaveAttribute('max', '10');
  await expect(input).toHaveValue('4');
});

test("[ui-9] ui-elements: case checkboxes have case-toggle class", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const categorySelect = page.locator('#category-select');
  const options = await categorySelect.locator('option').all();
  if (options.length > 1) {
    await categorySelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    const caseToggles = page.locator('#alg-cases input[type="checkbox"].case-toggle');
    const count = await caseToggles.count();
    if (count > 0) {
      await expect(caseToggles.first()).not.toBeChecked();
    }
  }
});

// --- Show previous stats option -------------------------------------

test("[ui-10] ui-elements: showPrevStats OFF - left name shows current case", async ({ page }) => {
  await setup(page, "R U R' U'");
  // Set current alg name and previous alg data
  await page.evaluate(() => {
    const t = (window as any).__test;
    t.setCurrentAlgName('Current Case');
    t.setShowPrevStats(false, 'prev-id', 'Previous Case', "R U R'");
    t.setShowAlgName(true);
    // Store a fake time so stats show
    localStorage.setItem('LastTimes-' + 'R-U-R%27-U%27', '1500');
    t.refreshStats();
  });
  // Left name should show current case
  await expect(page.locator('#alg-name-display')).toHaveText('Current Case');
  // Stats area name should also show current case when showPrevStats is OFF
  await expect(page.locator('#alg-name-display2')).toHaveText('Current Case');
});

test("[ui-11] ui-elements: showPrevStats ON - left name still shows current, stats shows previous", async ({ page }) => {
  await setup(page, "R U R' U'");
  await page.evaluate(() => {
    const t = (window as any).__test;
    t.setCurrentAlgName('Current Case');
    t.setShowPrevStats(true, 'prev-alg-id', 'Previous Case', "R U R'");
    t.setShowAlgName(true);
    // Store fake times for both current and previous
    localStorage.setItem('LastTimes-' + 'R-U-R%27-U%27', '1500');
    localStorage.setItem('LastTimes-prev-alg-id', '2000,1800');
    t.refreshStats();
  });
  // Left name should ALWAYS show current case
  await expect(page.locator('#alg-name-display')).toHaveText('Current Case');
  // Stats area name should show previous case
  await expect(page.locator('#alg-name-display2')).toHaveText('Previous Case');
});

test("[ui-12] ui-elements: showAlgName OFF - both names hidden regardless of showPrevStats", async ({ page }) => {
  await setup(page, "R U R' U'");
  await page.evaluate(() => {
    const t = (window as any).__test;
    t.setCurrentAlgName('Current Case');
    t.setShowPrevStats(true, 'prev-alg-id', 'Previous Case', "R U R'");
    t.setShowAlgName(false);
    localStorage.setItem('LastTimes-prev-alg-id', '2000,1800');
    t.refreshStats();
  });
  await expect(page.locator('#alg-name-display')).toHaveText('');
  await expect(page.locator('#alg-name-display2')).toHaveText('');
});

// --- Search bar -----------------------------------------------------

test("[ui-13] ui-elements: search bar filters cases by name", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Load OLL category with all subsets
  await page.selectOption('#category-select', { label: 'OLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(500);

  // All cases should be visible initially
  const totalCases = await page.locator('#alg-cases .case-wrapper').count();
  expect(totalCases).toBeGreaterThan(5);
  const visibleBefore = await page.locator('#alg-cases .case-wrapper:visible').count();
  expect(visibleBefore).toBe(totalCases);

  // Search bar should exist and be empty
  const searchInput = page.locator('#case-search');
  await expect(searchInput).toBeVisible();
  expect(await searchInput.inputValue()).toBe('');

  // Type a search term - should filter cases
  await searchInput.fill('sune');
  await page.waitForTimeout(100);
  const visibleAfter = await page.locator('#alg-cases .case-wrapper:visible').count();
  expect(visibleAfter).toBeGreaterThan(0);
  expect(visibleAfter).toBeLessThan(totalCases);

  // Clear button should be visible
  await expect(page.locator('#case-search-clear')).toBeVisible();

  // Click clear - should reset filter
  await page.click('#case-search-clear');
  await page.waitForTimeout(100);
  expect(await searchInput.inputValue()).toBe('');
  const visibleAfterClear = await page.locator('#alg-cases .case-wrapper:visible').count();
  expect(visibleAfterClear).toBe(totalCases);

  // Clear button should be hidden again
  await expect(page.locator('#case-search-clear')).toBeHidden();
});

test("[ui-14] ui-elements: search filter is case-insensitive", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'OLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(500);

  const searchInput = page.locator('#case-search');

  // Search with uppercase
  await searchInput.fill('SUNE');
  await page.waitForTimeout(100);
  const upperCount = await page.locator('#alg-cases .case-wrapper:visible').count();

  // Search with lowercase
  await searchInput.fill('sune');
  await page.waitForTimeout(100);
  const lowerCount = await page.locator('#alg-cases .case-wrapper:visible').count();

  expect(upperCount).toBe(lowerCount);
  expect(upperCount).toBeGreaterThan(0);
});

test("[ui-15] ui-elements: activate/deactivate only affect visible cases", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'OLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(500);

  // First deactivate all cases
  await page.click('#deactivate-all-btn');
  await page.waitForTimeout(100);

  // Now search to filter down to a subset
  const searchInput = page.locator('#case-search');
  await searchInput.fill('sune');
  await page.waitForTimeout(100);
  const visibleCount = await page.locator('#alg-cases .case-wrapper:visible').count();
  expect(visibleCount).toBeGreaterThan(0);

  // Activate all - should only activate visible (filtered) cases
  await page.click('#activate-all-btn');
  await page.waitForTimeout(100);

  // Clear the search to see all cases
  await page.click('#case-search-clear');
  await page.waitForTimeout(100);

  // Only the previously visible cases should be checked
  const checkedCount = await page.evaluate(() => {
    return document.querySelectorAll('#alg-cases input[type="checkbox"].case-toggle:checked').length;
  });
  expect(checkedCount).toBe(visibleCount);
});
