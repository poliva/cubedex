/**
 * Integration tests for stickering mask behavior in the UI.
 * Tests verify that the correct stickering mask (per cubing.js experimentalStickeringMaskOrbits)
 * is applied to the twisty-player after category/algorithm selection and after color rotation.
 * All tests run against the live Vite dev server via Playwright/Chromium.
 * Unit tests for buildStickeringMaskString and rotateFacelets live in faceMasking.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { setCurrentColorRotation } from './testUtils';
import { CENTER_FACELETS as CENTER_FACELETS, CORNER_FACELETS, EDGE_FACELETS } from '../src/faceMasking';

test("[stick-1] stickering: OLL category sets stickering mask on train", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'OLL' });
  await page.waitForTimeout(500);

  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(300);

  await page.click('#train-alg');
  await page.waitForTimeout(500);

  // Object API: check data-stickering-mask has correct structure (OLL: U corner tops regular, sides ignored)
  const maskCheck = await page.evaluate(() => {
    const player = document.querySelector('#cube > twisty-player') as HTMLElement;
    const raw = player?.dataset?.stickeringMask;
    if (!raw) return null;
    const mask = JSON.parse(raw);
    return {
      corner0: mask.orbits.CORNERS?.pieces?.[0]?.facelets?.slice(0, 3),
      corner4: mask.orbits.CORNERS?.pieces?.[4]?.facelets?.slice(0, 3),
      edge0: mask.orbits.EDGES?.pieces?.[0]?.facelets?.slice(0, 2),
      center0: mask.orbits.CENTERS?.pieces?.[0]?.facelets?.slice(0, 1),
    };
  });
  expect(maskCheck).not.toBeNull();
  expect(maskCheck!.corner0).toEqual(['regular', 'ignored', 'ignored']);
  expect(maskCheck!.corner4).toEqual(['dim', 'dim', 'dim']);
  expect(maskCheck!.edge0).toEqual(['regular', 'ignored']);
  expect(maskCheck!.center0).toEqual(['regular']);
});

test("[stick-2] stickering: F2L category sets stickering mask on train", async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'F2L' });
  await page.waitForTimeout(500);

  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(300);

  await page.click('#train-alg');
  await page.waitForTimeout(500);

  // Object API: F2L = U-layer ignored, D+equat regular
  const maskCheck = await page.evaluate(() => {
    const player = document.querySelector('#cube > twisty-player') as HTMLElement;
    const raw = player?.dataset?.stickeringMask;
    if (!raw) return null;
    const mask = JSON.parse(raw);
    return {
      corner0: mask.orbits.CORNERS?.pieces?.[0]?.facelets?.slice(0, 3),
      corner4: mask.orbits.CORNERS?.pieces?.[4]?.facelets?.slice(0, 3),
      edge0: mask.orbits.EDGES?.pieces?.[0]?.facelets?.slice(0, 2),
      edge4: mask.orbits.EDGES?.pieces?.[4]?.facelets?.slice(0, 2),
    };
  });
  expect(maskCheck).not.toBeNull();
  expect(maskCheck!.corner0).toEqual(['ignored', 'ignored', 'ignored']);
  expect(maskCheck!.corner4).toEqual(['regular', 'regular', 'regular']);
  expect(maskCheck!.edge0).toEqual(['ignored', 'ignored']);
  expect(maskCheck!.edge4).toEqual(['regular', 'regular']);
});

test("[stick-3] stickering: PLL mask rotated with z' y2 color rotation", async ({ page }) => {
  // z' y2 rotation: U->R, R->U, D->L, L->D, F->B, B->F (red-up blue-front).
  // PLL side stickers of R-layer pieces should be bright. All others dim.
  // R-layer pieces: corners FRU(0), BRU(1), DFR(4), BDR(7), edges RU(1), DR(5), FR(8), BR(10).
  // Bright facelets: 8(UFR.U),20(UFR.F), 2(BRU.U),45(BRU.B), 29(DFR.D),26(DFR.F),
  //                  35(BDR.D),51(BDR.B), 5(RU.U), 32(DR.D), 23(FR.F), 48(BR.B)
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'PLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(300);
  await page.evaluate(() => { (window as any).__test.setColorRotationMode('any'); });
  await page.waitForTimeout(100);

  await page.click('#train-alg');
  await page.waitForTimeout(300);
  await setCurrentColorRotation(page, "z' y2");
  await page.waitForTimeout(500);

  const mask = await page.evaluate(() => {
    const player = document.querySelector('#cube > twisty-player') as HTMLElement;
    const raw = player?.dataset?.stickeringMask;
    if (!raw) return null;
    return JSON.parse(raw);
  });

  const maskResult: string[] = new Array(54).fill("unknown");
  for (let s = 0; s < 8; s++) {
    const faceletMasks = mask.orbits.CORNERS.pieces[s].facelets;
    // console.log(`corner ${s} facelet masks: ${faceletMasks}`);
    for (let k = 0; k < 3; k++) maskResult[CORNER_FACELETS[s][k]] = faceletMasks[k];
  }
  for (let s = 0; s < 12; s++) {
    const faceletMasks = mask.orbits.EDGES.pieces[s].facelets;
    // console.log(`edge ${s} facelet masks: ${faceletMasks}`);
    for (let k = 0; k < 2; k++) maskResult[EDGE_FACELETS[s][k]] = faceletMasks[k];
  }
  for (let s = 0; s < 6; s++) {
    const faceletMasks = mask.orbits.CENTERS.pieces[s].facelets;
    // console.log(`center ${s} facelet masks: ${faceletMasks}`);
    maskResult[CENTER_FACELETS[s]] = faceletMasks[0];
  }

  expect(maskResult).not.toBeNull();
  const expectedBright = new Set([8, 5, 2, 45, 48, 51, 35, 32, 29, 26, 23, 20]);
  for (let i = 0; i < 54; i++) {
    const expected = expectedBright.has(i) ? "regular" : "dim";
    const face = i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
    expect(maskResult![i], `facelet ${i} (${face})`).toBe(expected);
  }
});

test("[stick-4] stickering: PLL mask rotated with x y color rotation", async ({ page }) => {
  // x y rotation: U->R (U-layer maps to R-layer). Same bright facelets as z' y2 since
  // both map U-layer to R-layer and the R-layer piece slots are the same.
  // Bright facelets: same set {8,20,2,45,29,26,35,51,5,32,23,48}.
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.selectOption('#category-select', { label: 'PLL' });
  await page.waitForTimeout(500);
  await page.locator('#select-all-subsets-toggle').check();
  await page.waitForTimeout(300);
  await page.evaluate(() => { (window as any).__test.setColorRotationMode('any'); });
  await page.waitForTimeout(100);

  await page.click('#train-alg');
  await page.waitForTimeout(300);
  await setCurrentColorRotation(page, "x y");
  await page.waitForTimeout(500);

  const mask = await page.evaluate(() => {
    const player = document.querySelector('#cube > twisty-player') as HTMLElement;
    const raw = player?.dataset?.stickeringMask;
    if (!raw) return null;
    return JSON.parse(raw);
  });

  const maskResult: string[] = new Array(54).fill("unknown");
  for (let s = 0; s < 8; s++) {
    const faceletMasks = mask.orbits.CORNERS.pieces[s].facelets;
    // console.log(`corner ${s} facelet masks: ${faceletMasks}`);
    for (let k = 0; k < 3; k++) maskResult[CORNER_FACELETS[s][k]] = faceletMasks[k];
  }
  for (let s = 0; s < 12; s++) {
    const faceletMasks = mask.orbits.EDGES.pieces[s].facelets;
    // console.log(`edge ${s} facelet masks: ${faceletMasks}`);
    for (let k = 0; k < 2; k++) maskResult[EDGE_FACELETS[s][k]] = faceletMasks[k];
  }
  for (let s = 0; s < 6; s++) {
    const faceletMasks = mask.orbits.CENTERS.pieces[s].facelets;
    // console.log(`center ${s} facelet masks: ${faceletMasks}`);
    maskResult[CENTER_FACELETS[s]] = faceletMasks[0];
  }

  expect(maskResult).not.toBeNull();
  const expectedBright = new Set([6, 7, 8, 9, 12, 15, 29, 28, 27, 44, 41, 38]);
  for (let i = 0; i < 54; i++) {
    const expected = expectedBright.has(i) ? "regular" : "dim";
    const face = i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
    expect(maskResult[i], `facelet ${i} (${face}), maskresult: ${maskResult}`).toBe(expected);
  }
});
