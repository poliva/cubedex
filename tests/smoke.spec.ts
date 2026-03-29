/**
 * Smoke tests - verifies the app loads without console errors and key UI elements
 * are present and functional. Should always be the first test run after changes.
 */
import { test, expect } from '@playwright/test';

test("[smoke-1] smoke: page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Wait a bit for any async errors
  await page.waitForTimeout(2000);

  // Filter out known non-critical errors (e.g., service worker registration in dev)
  const criticalErrors = errors.filter(
    (e) => !e.includes('service-worker') && !e.includes('ServiceWorker') && !e.includes('manifest') && !e.includes('compute-pressure')
  );

  expect(criticalErrors).toEqual([]);
});

test("[smoke-2] smoke: main UI elements are present", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Category select should exist
  await expect(page.locator('#category-select')).toBeVisible();

  // Train button should exist
  await expect(page.locator('#train-alg')).toBeVisible();

  // Algorithm cases container should exist
  await expect(page.locator('#alg-cases')).toBeAttached();
});
