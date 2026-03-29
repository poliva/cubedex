/**
 * Options/settings tests - verify that every setting is stored to localStorage
 * when toggled and that the corresponding state variable is set correctly.
 *
 * Prefix: opt-settings-N
 *
 * Tests are grouped:
 *  1-19: Boolean toggle settings (each: toggle, check state, check localStorage)
 * 20-25: Numeric input settings
 * 26-29: Select element settings
 * 30-33: Persistence across reload
 * 34-36: Edge cases
 */

import { test, expect } from '@playwright/test';

/** Helper: toggle a sr-only checkbox by clicking its label. */
async function toggleCheckbox(page: any, id: string) {
  const label = page.locator(`label[for="${id}"]`);
  await label.scrollIntoViewIfNeeded();
  await label.click();
}

/** Helper: check if a sr-only checkbox is checked. */
async function isChecked(page: any, id: string): Promise<boolean> {
  return page.locator(`#${id}`).isChecked();
}

/** Helper: open the settings page and scroll to top. */
async function openSettings(page: any) {
  await page.click('#show-options');
  await page.waitForSelector('#options-container', { state: 'visible' });
  // Scroll settings container to top for consistent starting position
  await page.evaluate(() => document.getElementById('options-container')?.scrollTo(0, 0));
}

/** Helper: ensure the practice-page options panel is visible (scroll into view). */
async function ensurePracticeOptions(page: any) {
  await page.locator('#options-selector').scrollIntoViewIfNeeded();
}

/** Helper: navigate and wait for app ready. */
async function setup(page: any) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());
}

/** Helper: get debug info. */
async function getDebug(page: any) {
  return page.evaluate(() => (window as any).__test.getDebugInfo());
}

/** Helper: get localStorage value. */
async function getLS(page: any, key: string) {
  return page.evaluate((k: string) => localStorage.getItem(k), key);
}

// -- Boolean toggle tests ------------------------------------------------

/**
 * For each boolean toggle, we test:
 * 1. Toggle it to non-default state
 * 2. State variable updated
 * 3. localStorage updated
 */

const booleanToggles: Array<{
  name: string;
  toggleId: string;
  lsKey: string;
  stateKey: string;
  defaultVal: boolean;
}> = [
  { name: 'showAlgName', toggleId: 'show-alg-name-toggle', lsKey: 'showAlgName', stateKey: 'showAlgNameEnabled', defaultVal: true },
  { name: 'fullStickering', toggleId: 'full-stickering-toggle', lsKey: 'fullStickering', stateKey: 'fullStickeringEnabled', defaultVal: false },
  { name: 'flashingIndicator', toggleId: 'flashing-indicator-toggle', lsKey: 'flashingIndicatorEnabled', stateKey: 'flashingIndicatorEnabled', defaultVal: true },
  { name: 'stareDelay', toggleId: 'stare-delay-toggle', lsKey: 'stareDelay', stateKey: 'stareDelayEnabled', defaultVal: false },
  { name: 'phantomMode', toggleId: 'phantom-mode-toggle', lsKey: 'phantomMode', stateKey: 'phantomModeEnabled', defaultVal: false },
  { name: 'keepRotation', toggleId: 'keep-rotation-toggle', lsKey: 'keepRotation', stateKey: 'keepRotationEnabled', defaultVal: false },
  { name: 'alwaysScrambleTo', toggleId: 'always-scramble-to-toggle', lsKey: 'alwaysScrambleTo', stateKey: 'alwaysScrambleTo', defaultVal: false },
  { name: 'overrideAlg', toggleId: 'override-alg-toggle', lsKey: 'overrideAlgEnabled', stateKey: 'overrideAlgEnabled', defaultVal: true },
  { name: 'resetPractice', toggleId: 'reset-practice-toggle', lsKey: 'resetPracticeEnabled', stateKey: 'resetPracticeEnabled', defaultVal: true },
  { name: 'autoPromoteLearning', toggleId: 'auto-promote-learning-toggle', lsKey: 'autoPromoteLearning', stateKey: 'autoPromoteLearning', defaultVal: true },
  { name: 'limitLearning', toggleId: 'limit-learning-toggle', lsKey: 'limitLearningEnabled', stateKey: 'limitLearningEnabled', defaultVal: true },
  { name: 'autoPromoteLearned', toggleId: 'auto-promote-learned-toggle', lsKey: 'autoPromoteLearned', stateKey: 'autoPromoteLearned', defaultVal: true },
  { name: 'retryFailed', toggleId: 'retry-failed-toggle', lsKey: 'retryFailed', stateKey: 'retryFailedEnabled', defaultVal: false },
  { name: 'countdownMode', toggleId: 'countdown-mode-toggle', lsKey: 'countdownMode', stateKey: 'countdownModeEnabled', defaultVal: false },
  { name: 'tpsFail', toggleId: 'tps-fail-toggle', lsKey: 'tpsFailEnabled', stateKey: 'tpsFailEnabled', defaultVal: true },
  { name: 'randomOrder', toggleId: 'random-order-toggle', lsKey: 'sortRandom', stateKey: 'randomAlgorithms', defaultVal: false },
  { name: 'prioritizeSlow', toggleId: 'prioritize-slow-toggle', lsKey: 'sortSlow', stateKey: 'prioritizeSlowAlgs', defaultVal: false },
  { name: 'prioritizeDifficult', toggleId: 'prioritize-difficult-toggle', lsKey: 'sortDifficult', stateKey: 'prioritizeDifficultAlgs', defaultVal: false },
  { name: 'smartCase', toggleId: 'smart-case-toggle', lsKey: 'sortSmart', stateKey: 'smartCaseSelection', defaultVal: false },
  { name: 'randomAUF', toggleId: 'random-auf-toggle', lsKey: 'randomAUF', stateKey: 'randomizeAUF', defaultVal: false },
  { name: 'prioritizeFailed', toggleId: 'prioritize-failed-toggle', lsKey: 'prioritizeFailed', stateKey: 'prioritizeFailedAlgs', defaultVal: false },
  { name: 'showCompactGraph', toggleId: 'show-compact-graph-toggle', lsKey: 'showCompactGraph', stateKey: 'showCompactGraphEnabled', defaultVal: true },
  { name: 'showLastCase', toggleId: 'show-last-case-toggle', lsKey: 'showLastCaseTile', stateKey: 'showLastCaseTileEnabled', defaultVal: false },
  { name: 'showPrevStats', toggleId: 'show-prev-stats-toggle', lsKey: 'showPrevStats', stateKey: 'showPrevStatsEnabled', defaultVal: false },
];

test("[opt-settings-1] boolean toggles: default values are correct", async ({ page }) => {
  await setup(page);
  const debug = await getDebug(page);
  for (const t of booleanToggles) {
    expect(debug[t.stateKey], `${t.name} default`).toBe(t.defaultVal);
  }
});

test("[opt-settings-2] showAlgName toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  // Default true -> toggle to false
  await toggleCheckbox(page, 'show-alg-name-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.showAlgNameEnabled).toBe(false);
  expect(await getLS(page, 'showAlgName')).toBe('false');
});

test("[opt-settings-3] fullStickering toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'full-stickering-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.fullStickeringEnabled).toBe(true);
  expect(await getLS(page, 'fullStickering')).toBe('true');
});

test("[opt-settings-4] flashingIndicator toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'flashing-indicator-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.flashingIndicatorEnabled).toBe(false);
  expect(await getLS(page, 'flashingIndicatorEnabled')).toBe('false');
});

test("[opt-settings-5] stareDelay toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'stare-delay-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.stareDelayEnabled).toBe(true);
  expect(await getLS(page, 'stareDelay')).toBe('true');
});

test("[opt-settings-6] rotateColors checkboxes store and update state", async ({ page }) => {
  await setup(page);
  await ensurePracticeOptions(page);
  await toggleCheckbox(page, 'rotate-colors-vertical');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.rotateColorsEnabled).toBe(true);
  expect(await getLS(page, 'rotateColorsMode')).toBe('vertical');
});

test("[opt-settings-7] phantomMode toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await ensurePracticeOptions(page);
  await toggleCheckbox(page, 'phantom-mode-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.phantomModeEnabled).toBe(true);
  expect(await getLS(page, 'phantomMode')).toBe('true');
});

test("[opt-settings-8] keepRotation toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'keep-rotation-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.keepRotationEnabled).toBe(true);
  expect(await getLS(page, 'keepRotation')).toBe('true');
});

test("[opt-settings-9] alwaysScrambleTo toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'always-scramble-to-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.alwaysScrambleTo).toBe(true);
  expect(await getLS(page, 'alwaysScrambleTo')).toBe('true');
});

test("[opt-settings-10] overrideAlg toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'override-alg-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.overrideAlgEnabled).toBe(false);
  expect(await getLS(page, 'overrideAlgEnabled')).toBe('false');
});

test("[opt-settings-11] resetPractice toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'reset-practice-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.resetPracticeEnabled).toBe(false);
  expect(await getLS(page, 'resetPracticeEnabled')).toBe('false');
});

test("[opt-settings-12] autoPromoteLearning toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'auto-promote-learning-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.autoPromoteLearning).toBe(false);
  expect(await getLS(page, 'autoPromoteLearning')).toBe('false');
});

test("[opt-settings-13] limitLearning toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'limit-learning-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.limitLearningEnabled).toBe(false);
  expect(await getLS(page, 'limitLearningEnabled')).toBe('false');
});

test("[opt-settings-14] autoPromoteLearned toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'auto-promote-learned-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.autoPromoteLearned).toBe(false);
  expect(await getLS(page, 'autoPromoteLearned')).toBe('false');
});

test("[opt-settings-15] retryFailed toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'retry-failed-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.retryFailedEnabled).toBe(true);
  expect(await getLS(page, 'retryFailed')).toBe('true');
});

test("[opt-settings-16] countdownMode toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await ensurePracticeOptions(page);
  await toggleCheckbox(page, 'countdown-mode-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.countdownModeEnabled).toBe(true);
  expect(await getLS(page, 'countdownMode')).toBe('true');
});

test("[opt-settings-17] tpsFail toggle stores and updates state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await toggleCheckbox(page, 'tps-fail-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.tpsFailEnabled).toBe(false);
  expect(await getLS(page, 'tpsFailEnabled')).toBe('false');
});

test("[opt-settings-18] practice order toggles store and update state", async ({ page }) => {
  await setup(page);
  await ensurePracticeOptions(page);
  // Toggle all practice order toggles to non-default
  await toggleCheckbox(page, 'random-order-toggle');
  await toggleCheckbox(page, 'random-auf-toggle');
  await toggleCheckbox(page, 'prioritize-failed-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.randomAlgorithms).toBe(true);
  expect(debug.randomizeAUF).toBe(true);
  expect(debug.prioritizeFailedAlgs).toBe(true);
  expect(await getLS(page, 'sortRandom')).toBe('true');
  expect(await getLS(page, 'randomAUF')).toBe('true');
  expect(await getLS(page, 'prioritizeFailed')).toBe('true');
});

test("[opt-settings-19] statistics toggles store and update state", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  // showCompactGraph default=true -> toggle off
  await toggleCheckbox(page, 'show-compact-graph-toggle');
  // showLastCase default=false -> toggle on
  await toggleCheckbox(page, 'show-last-case-toggle');
  // showPrevStats default=false -> toggle on
  await toggleCheckbox(page, 'show-prev-stats-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.showCompactGraphEnabled).toBe(false);
  expect(debug.showLastCaseTileEnabled).toBe(true);
  expect(debug.showPrevStatsEnabled).toBe(true);
  expect(await getLS(page, 'showCompactGraph')).toBe('false');
  expect(await getLS(page, 'showLastCaseTile')).toBe('true');
  expect(await getLS(page, 'showPrevStats')).toBe('true');
});

// -- Numeric input tests -------------------------------------------------

test("[opt-settings-20] maxConcurrentLearning input stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await page.fill('#max-learning-input', '7');
  await page.locator('#max-learning-input').dispatchEvent('change');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.maxConcurrentLearning).toBe(7);
  expect(await getLS(page, 'maxConcurrentLearning')).toBe('7');
});

test("[opt-settings-21] promotionThreshold input stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await page.fill('#promotion-threshold-input', '20');
  await page.locator('#promotion-threshold-input').dispatchEvent('change');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.promotionThreshold).toBe(20);
  expect(await getLS(page, 'promotionThreshold')).toBe('20');
});

test("[opt-settings-22] stareDelaySeconds select stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  // First enable stare delay so the seconds field is relevant
  if (!(await isChecked(page, 'stare-delay-toggle'))) {
    await toggleCheckbox(page, 'stare-delay-toggle');
  }
  await page.locator('#stare-delay-seconds').scrollIntoViewIfNeeded();
  await page.selectOption('#stare-delay-seconds', '2');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.stareDelaySeconds).toBe(2);
  expect(await getLS(page, 'stareDelaySeconds')).toBe('2');
});

// -- Select element tests ------------------------------------------------

test("[opt-settings-23] visualization select stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await page.selectOption('#visualization-select', '2D');
  await page.waitForTimeout(50);
  expect(await getLS(page, 'visualization')).toBe('2D');
});

test("[opt-settings-24] backview select stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await page.selectOption('#backview-select', 'side-by-side');
  await page.waitForTimeout(50);
  expect(await getLS(page, 'backview')).toBe('side-by-side');
});

test("[opt-settings-25] countdown seconds select stores value", async ({ page }) => {
  await setup(page);
  // countdown-seconds-select is in the settings page
  await openSettings(page);
  await page.locator('#countdown-seconds-select').scrollIntoViewIfNeeded();
  await page.selectOption('#countdown-seconds-select', '5');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.countdownSeconds).toBe(5);
  expect(await getLS(page, 'countdownSeconds')).toBe('5');
});

test("[opt-settings-26] queue size select stores value", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  await page.selectOption('#queue-size-select', '10');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.queueSize).toBe(10);
  expect(await getLS(page, 'queueSize')).toBe('10');
});

// -- Persistence across reload -------------------------------------------

test("[opt-settings-27] boolean toggles persist after reload", async ({ page }) => {
  await setup(page);
  // Toggle practice-page settings
  await ensurePracticeOptions(page);
  await toggleCheckbox(page, 'rotate-colors-vertical'); // none -> vertical
  await toggleCheckbox(page, 'phantom-mode-toggle');       // false -> true
  await toggleCheckbox(page, 'random-order-toggle');       // false -> true
  // Toggle settings-page settings
  await openSettings(page);
  await toggleCheckbox(page, 'show-alg-name-toggle');     // true -> false
  await toggleCheckbox(page, 'full-stickering-toggle');    // false -> true
  await toggleCheckbox(page, 'show-compact-graph-toggle'); // true -> false
  await page.waitForTimeout(50);

  // Reload
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  const debug = await getDebug(page);
  expect(debug.showAlgNameEnabled).toBe(false);
  expect(debug.fullStickeringEnabled).toBe(true);
  expect(debug.rotateColorsEnabled).toBe(true);
  expect(debug.phantomModeEnabled).toBe(true);
  expect(debug.randomAlgorithms).toBe(true);
  expect(debug.showCompactGraphEnabled).toBe(false);
});

test("[opt-settings-28] numeric inputs persist after reload", async ({ page }) => {
  await setup(page);
  await openSettings(page);

  await page.fill('#max-learning-input', '8');
  await page.locator('#max-learning-input').dispatchEvent('change');
  await page.fill('#promotion-threshold-input', '15');
  await page.locator('#promotion-threshold-input').dispatchEvent('change');
  await page.waitForTimeout(50);

  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  const debug = await getDebug(page);
  expect(debug.maxConcurrentLearning).toBe(8);
  expect(debug.promotionThreshold).toBe(15);
});

test("[opt-settings-29] select elements persist after reload", async ({ page }) => {
  await setup(page);
  await openSettings(page);

  await page.selectOption('#backview-select', 'side-by-side');
  await page.selectOption('#queue-size-select', '15');
  await page.waitForTimeout(50);

  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  expect(await getLS(page, 'backview')).toBe('side-by-side');
  expect(await getLS(page, 'queueSize')).toBe('15');
});

// -- Gyroscope (special: enabled/disabled strings) -----------------------

test("[opt-settings-30] gyroscope toggle stores enabled/disabled string", async ({ page }) => {
  await setup(page);
  await openSettings(page);
  // Default enabled -> toggle to disabled
  await toggleCheckbox(page, 'gyroscope-toggle');
  await page.waitForTimeout(50);
  const debug = await getDebug(page);
  expect(debug.gyroscopeEnabled).toBe(false);
  expect(await getLS(page, 'gyroscope')).toBe('disabled');
  // Toggle back
  await toggleCheckbox(page, 'gyroscope-toggle');
  await page.waitForTimeout(50);
  expect(await getLS(page, 'gyroscope')).toBe('enabled');
});

// -- Edge cases ----------------------------------------------------------

test("[opt-settings-31] toggling one setting does not clobber unrelated settings", async ({ page }) => {
  await setup(page);
  // Set up practice-page toggle first (before opening settings)
  await ensurePracticeOptions(page);
  await toggleCheckbox(page, 'rotate-colors-vertical'); // none -> vertical
  await page.waitForTimeout(50);

  // Set up settings-page toggles
  await openSettings(page);
  await toggleCheckbox(page, 'override-alg-toggle');       // true -> false
  await page.fill('#max-learning-input', '6');
  await page.locator('#max-learning-input').dispatchEvent('change');
  await page.waitForTimeout(50);

  // Now toggle another settings-page toggle
  await toggleCheckbox(page, 'keep-rotation-toggle');      // false -> true
  await page.waitForTimeout(50);

  // Verify the previous settings were not clobbered
  const debug = await getDebug(page);
  expect(debug.overrideAlgEnabled).toBe(false);
  expect(debug.rotateColorsEnabled).toBe(true);
  expect(debug.maxConcurrentLearning).toBe(6);
  expect(debug.keepRotationEnabled).toBe(true);
});

test("[opt-settings-32] settings load correctly even with no localStorage (fresh user)", async ({ page }) => {
  await page.goto('/');
  // Clear ALL localStorage before the app loads
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__test);
  await page.evaluate(() => (window as any).__test.waitForReady());

  // All defaults should be set
  const debug = await getDebug(page);
  expect(debug.overrideAlgEnabled).toBe(true);
  expect(debug.resetPracticeEnabled).toBe(true);
  expect(debug.keepRotationEnabled).toBe(false);
  expect(debug.showAlgNameEnabled).toBe(true);
  expect(debug.fullStickeringEnabled).toBe(false);
  expect(debug.rotateColorsEnabled).toBe(false);
  expect(debug.tpsFailEnabled).toBe(true);
  expect(debug.autoPromoteLearning).toBe(true);
  expect(debug.maxConcurrentLearning).toBe(4);
  expect(debug.promotionThreshold).toBe(10);
});

test("[opt-settings-33] rapid toggling does not corrupt state", async ({ page }) => {
  await setup(page);
  await openSettings(page);

  // Rapidly toggle the same setting 6 times (should end at default)
  for (let i = 0; i < 6; i++) {
    await toggleCheckbox(page, 'keep-rotation-toggle');
  }
  await page.waitForTimeout(100);

  // keepRotation default=false, toggled 6 times (even) -> back to false
  const debug = await getDebug(page);
  expect(debug.keepRotationEnabled).toBe(false);
  expect(await getLS(page, 'keepRotation')).toBe('false');
});
