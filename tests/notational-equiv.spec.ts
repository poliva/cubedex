/**
 * Notational equivalence tests - verifies that notationallyAlgEquivalent() correctly
 * identifies algorithms that are the same after double-move normalization and
 * distinguishes algorithms that genuinely differ.
 */
import { test, expect } from '@playwright/test';
import { setup, doUserFrameMoves, setTestAlgConfig } from './testUtils';
import { notationallyAlgEquivalent } from '../src/notationHelper';

// --- Positive cases (should return true) ---

test("[neq-1] identical algs are equivalent", async () => {
  expect(notationallyAlgEquivalent("R U R' U'", "R U R' U'")).toBe(true);
});

test("[neq-2] double move equals two singles: U2 <-> U U", async () => {
  expect(notationallyAlgEquivalent("U2", "U U")).toBe(true);
});

test("[neq-2b] double move equals two inverse singles: U2 <-> U' U'", async () => {
  expect(notationallyAlgEquivalent("U2", "U' U'")).toBe(true);
});

test("[neq-2c] double move equals inverse double: U2 <-> U'2", async () => {
  expect(notationallyAlgEquivalent("U2", "U'2")).toBe(true);
});

test("[neq-3] double prime: U'2 <-> U' U'", async () => {
  expect(notationallyAlgEquivalent("U'2", "U' U'")).toBe(true);
});

test("[neq-3b] double prime: U'2 <-> U U", async () => {
  expect(notationallyAlgEquivalent("U'2", "U U")).toBe(true);
});

test("[neq-3c] double prime: U'2 <-> U2", async () => {
  expect(notationallyAlgEquivalent("U'2", "U2")).toBe(true);
});

test("[neq-4] slice <-> face pair: M' <-> R' L", async () => {
  expect(notationallyAlgEquivalent("M'", "R' L")).toBe(true);
});

test("[neq-5] slice <-> face pair reversed order: M' <-> L R'", async () => {
  expect(notationallyAlgEquivalent("M'", "L R'")).toBe(true);
});

test("[neq-6] slice M <-> R L'", async () => {
  expect(notationallyAlgEquivalent("M", "R L'")).toBe(true);
});

test("[neq-7] slice S <-> F' B", async () => {
  expect(notationallyAlgEquivalent("S", "F' B")).toBe(true);
});

test("[neq-8] slice E <-> U D'", async () => {
  expect(notationallyAlgEquivalent("E", "U D'")).toBe(true);
});

test("[neq-9] wide move: d' <-> U'", async () => {
  expect(notationallyAlgEquivalent("d'", "U'")).toBe(true);
});

test("[neq-10] wide move: r <-> L", async () => {
  expect(notationallyAlgEquivalent("r", "L")).toBe(true);
});

test("[neq-11] rotation + face: y R <-> B", async () => {
  expect(notationallyAlgEquivalent("y R", "B")).toBe(true);
});

test("[neq-12] rotation y' is ignored (no face component)", async () => {
  expect(notationallyAlgEquivalent("y'", "")).toBe(true);
});

test("[neq-13] slice + face with rotation: M' U <-> R' L F", async () => {
  expect(notationallyAlgEquivalent("M' U", "R' L F")).toBe(true);
});

test("[neq-14] wide + face: d' R <-> U' B", async () => {
  expect(notationallyAlgEquivalent("d' R", "U' B")).toBe(true);
});

test("[neq-15] double slice: M2 <-> R L' R L'", async () => {
  expect(notationallyAlgEquivalent("M2", "R L' R L'")).toBe(true);
});

test("[neq-15b] double slice: M2 <-> R' L L R'", async () => {
  expect(notationallyAlgEquivalent("M2", "R' L L R'")).toBe(true);
});

test("[neq-15v] double slice: M2 <-> M' M'", async () => {
  expect(notationallyAlgEquivalent("M2", "M' M'")).toBe(true);
});

test("[neq-16] double slice reversed order: M2 <-> L' R L' R", async () => {
  expect(notationallyAlgEquivalent("M2", "L' R L' R")).toBe(true);
});

test("[neq-17] complex PLL: M2 U' M2 U2' M2 U' M2 <-> face-move equivalent", async () => {
  expect(notationallyAlgEquivalent("M2 U' M2 U2' M2 U' M2", "R L' R L' D' R L' R L' U' U' R L' R L' D' R L' R L'")).toBe(true);
});

test("[neq-18] complex: M' U <-> L R' F (reversed slice order)", async () => {
  expect(notationallyAlgEquivalent("M' U", "L R' F")).toBe(true);
});

test("[neq-19] S2 <-> face moves", async () => {
  expect(notationallyAlgEquivalent("S2", "F' B F' B")).toBe(true);
});

test("[neq-20] E' <-> U' D", async () => {
  expect(notationallyAlgEquivalent("E'", "U' D")).toBe(true);
});

// --- Negative cases (should return false) ---

test("[neq-21] different algs: R U != R F", async () => {
  expect(notationallyAlgEquivalent("R U", "R F")).toBe(false);
});

test("[neq-22] different length: R U R' != R U", async () => {
  expect(notationallyAlgEquivalent("R U R'", "R U")).toBe(false);
});

test("[neq-23] slice without face-map: M' U != R' L U", async () => {
  expect(notationallyAlgEquivalent("M' U", "R' L U")).toBe(false);
});

test("[neq-24] wrong order outside slice pair: R U != U R", async () => {
  expect(notationallyAlgEquivalent("R U", "U R")).toBe(false);
});

test("[neq-25] empty vs non-empty", async () => {
  expect(notationallyAlgEquivalent("", "R")).toBe(false);
});

test("[neq-26] both empty", async () => {
  expect(notationallyAlgEquivalent("", "")).toBe(true);
});

// --- Integration: override detection should use notational equivalence ---

test("[neq-27] override hidden when user executes notationally equivalent face moves for M2-based alg", async ({ page }) => {
  await setup(page, "M2 U' M2 U2' M2 U' M2");
  await setTestAlgConfig(page, { overrideEnabled: true, category: 'PLL' });
  // Execute the face-move equivalent of M2 U' M2 U2' M2 U' M2
  // M2 reports as L' R L' R on GAN, rotations from M change subsequent faces
  await doUserFrameMoves(page, "M2 U' M2 U2' M2 U' M2");
  const hidden = await page.$eval('#alg-override-container', (el: HTMLElement) =>
    el.style.display === 'none' || el.classList.contains('hidden') || getComputedStyle(el).display === 'none'
  );
  expect(hidden).toBe(true);
});

test("[neq-28] M2 U M' U2 M U M2 == L R' L R' D L R' B2 R L' D L R' L R'", async () => {
  expect(notationallyAlgEquivalent("M2 U M' U2 M U M2", "L R' L R' D L R' B2 R L' D L R' L R'")).toBe(true);
});
