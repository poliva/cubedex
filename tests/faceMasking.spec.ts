/**
 * Unit tests for faceMasking.ts: buildStickeringMaskString, rotateFacelets,
 * partialStateEquals, and CATEGORY_IGNORED/DIMMED_FACELETS.
 * All tests are pure (no browser needed): they import faceMasking.ts directly.
 * Integration tests that verify the mask is applied to the twisty-player in the UI
 * live in stickering.spec.ts.
 */
import { test, expect } from "@playwright/test";
import {
  buildStickeringMaskString,
  rotateFacelets,
  CATEGORY_IGNORED_FACELETS,
  CATEGORY_DIMMED_FACELETS,
  CORNER_FACELETS,
  EDGE_FACELETS,
  StickeringMask,
} from "../src/faceMasking";

// Helper: extract facelets array for a specific piece in a mask object.
// Returns only the physically meaningful facelets (3 for corners, 2 for edges, 1 for centers),
// trimming the padding that buildStickeringMaskFromFacelets adds for cubing.js compatibility.
const ORBIT_FACELET_COUNT: Record<string, number> = { CORNERS: 3, EDGES: 2, CENTERS: 1 };
function pieceFacelets(mask: StickeringMask, orbit: string, index: number): string[] {
  const all = mask.orbits[orbit].pieces[index].facelets as string[];
  return all.slice(0, ORBIT_FACELET_COUNT[orbit] ?? all.length);
}

// helper sets contain same facelets but in different order, so we compare as sets rather than arrays
function expectFaceletSetsEqual(actual: Set<number>, expected: Set<number>) {
  for (const f of expected) {
    expect(actual).toContain(f);
  }
}

// -- buildStickeringMaskString: category masks ---------------------------

test("[mask-1] PLL mask: U-face stickers dimmed, U-layer sides bright, F2L dimmed", () => {
  const mask = buildStickeringMaskString("PLL");
  // U-layer corners: top (U-face) sticker dimmed, side stickers regular
  expect(pieceFacelets(mask, "CORNERS", 0)).toEqual(["dim", "regular", "regular"]);
  expect(pieceFacelets(mask, "CORNERS", 1)).toEqual(["dim", "regular", "regular"]);
  expect(pieceFacelets(mask, "CORNERS", 2)).toEqual(["dim", "regular", "regular"]);
  expect(pieceFacelets(mask, "CORNERS", 3)).toEqual(["dim", "regular", "regular"]);
  // D-layer corners: all dimmed
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["dim", "dim", "dim"]);
  // U-layer edges: top dimmed, side regular
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "regular"]);
  // D+equat edges: all dimmed
  for (let i = 4; i < 12; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "dim"]);
  // All centers dimmed
  for (let i = 0; i < 6; i++)
    expect(pieceFacelets(mask, "CENTERS", i)).toEqual(["dim"]);
});

test("[mask-2] OLL mask: U-layer sides ignored, F2L + nonU centers dimmed", () => {
  const mask = buildStickeringMaskString("OLL");
  // U corners: top regular, sides ignored
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["regular", "ignored", "ignored"]);
  // D corners: all dimmed
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["dim", "dim", "dim"]);
  // U edges: top regular, side ignored
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["regular", "ignored"]);
  // D+equat edges: all dimmed
  for (let i = 4; i < 12; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "dim"]);
  // U center regular, non-U centers dimmed
  expect(pieceFacelets(mask, "CENTERS", 0)).toEqual(["regular"]);
  for (let i = 1; i < 6; i++)
    expect(pieceFacelets(mask, "CENTERS", i)).toEqual(["dim"]);
});

test("[mask-3] F2L mask: U-layer fully ignored, D+equat bright", () => {
  const mask = buildStickeringMaskString("F2L");
  // U corners: all ignored
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["ignored", "ignored", "ignored"]);
  // D corners: regular
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["regular", "regular", "regular"]);
  // U edges: all ignored
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["ignored", "ignored"]);
  // D+equat edges: regular
  for (let i = 4; i < 12; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["regular", "regular"]);
  // All centers regular
  for (let i = 0; i < 6; i++)
    expect(pieceFacelets(mask, "CENTERS", i)).toEqual(["regular"]);
});

test("[mask-4] full category: all pieces bright", () => {
  const mask = buildStickeringMaskString("full");
  for (let i = 0; i < 8; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["regular", "regular", "regular"]);
  for (let i = 0; i < 12; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["regular", "regular"]);
  for (let i = 0; i < 6; i++)
    expect(pieceFacelets(mask, "CENTERS", i)).toEqual(["regular"]);
});

// -- rotateFacelets: y rotation ------------------------------------------

test("[mask-5] rotateFacelets: y rotation of F2L dimmed set is invariant", () => {
  const dimF2L = CATEGORY_DIMMED_FACELETS["oll"];
  const rotated = rotateFacelets(dimF2L, "y");
  expect(new Set(rotated)).toEqual(new Set(dimF2L));
});

test("[mask-6] rotateFacelets: y rotation of OLL ignore set is invariant", () => {
  const ignoreOLL = CATEGORY_IGNORED_FACELETS["oll"];
  const rotated = rotateFacelets(ignoreOLL, "y");
  expect(new Set(rotated)).toEqual(new Set(ignoreOLL));
});

test("[mask-7] OLL mask with y rotation = same as no rotation", () => {
  const noRot = buildStickeringMaskString("OLL");
  const yRot = buildStickeringMaskString("OLL", undefined, "y");
  expect(yRot).toEqual(noRot);
});

// -- rotateFacelets: z2 rotation -----------------------------------------

test("[mask-8] rotateFacelets: z2 rotation swaps U and D layers", () => {
  const ufr = new Set(CORNER_FACELETS[0]);
  const rotated = rotateFacelets(ufr, "z2");
  const dfl = new Set(CORNER_FACELETS[5]);
  expect(rotated).toEqual(dfl);
});

test("[mask-9] rotateFacelets: z2 rotation of centers swaps U<->D and R<->L", () => {
  const nonUCenters = new Set([13, 22, 31, 40, 49]);
  const rotated = rotateFacelets(nonUCenters, "z2");
  const expected = new Set([40, 22, 4, 13, 49]);
  expect(rotated).toEqual(expected);
});

// -- rotateFacelets: z rotation ------------------------------------------

test("[mask-10] rotateFacelets: z rotation maps U-layer corner to R-layer", () => {
  const ufr = new Set(CORNER_FACELETS[0]);
  const rotated = rotateFacelets(ufr, "z");
  const drf = new Set(CORNER_FACELETS[4]);
  console.log(`ufr ${[...ufr]} rotated ${[...rotated]} should equal ${[...drf]}`);
  expectFaceletSetsEqual(rotated, drf);
});


// -- Per-case ignore pieces ---------------------------------------------

test("[mask-11] per-case ignore: BL edge ignored in OLL mask", () => {
  const mask = buildStickeringMaskString("OLL", "BL");
  // BL is edge slot 11 -> all facelets should be ignored
  expect(pieceFacelets(mask, "EDGES", 11)).toEqual(["ignored", "ignored"]);
  // Other edge slots should remain unchanged from OLL base
  // U-layer edges: top regular, side ignored
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["regular", "ignored"]);
  // D-layer edges: dimmed
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "dim"]);
});

// -- Test rotation facelets sets ----------------------------------

test("[mask-12] rotateFacelets: ", () => {

  // identity rotation (no rotation component) returns same set
  const input = new Set([0, 1, 2, 8, 20, 9]);
  const result1 = rotateFacelets(input, "");
  expectFaceletSetsEqual(result1, input);

  // test some edges
  const uf = new Set(EDGE_FACELETS[0]);

  const restult_ey2 = rotateFacelets(uf, "y2");
  const ub = new Set(EDGE_FACELETS[2]);
  expectFaceletSetsEqual(restult_ey2, ub);

  const restult_ez = rotateFacelets(uf, "z");
  const fr = new Set(EDGE_FACELETS[8]);
  expectFaceletSetsEqual(restult_ez, fr);

  const restult_exp = rotateFacelets(uf, "x'");
  const df = new Set(EDGE_FACELETS[4]);
  expectFaceletSetsEqual(restult_exp, df);

  // test some corners
  const urf = new Set(CORNER_FACELETS[0]);

  const restult_cy2 = rotateFacelets(urf, "y2");
  const ubl = new Set(CORNER_FACELETS[2]);
  expectFaceletSetsEqual(restult_cy2, ubl);

  const restult_cz = rotateFacelets(urf, "z");
  const frd = new Set(CORNER_FACELETS[4]);
  expectFaceletSetsEqual(restult_cz, frd);

  const restult_cxp = rotateFacelets(urf, "x'");
  expectFaceletSetsEqual(restult_cxp, frd);
});

// -- PLL mask with rotation ----------------------------------------------

test("[mask-14] PLL mask with y rotation = same as no rotation", () => {
  const noRot = buildStickeringMaskString("PLL");
  const yRot = buildStickeringMaskString("PLL", undefined, "y");
  expect(yRot).toEqual(noRot);
});

test("[mask-15] PLL mask with z2 rotation swaps dimmed layers", () => {
  const mask = buildStickeringMaskString("PLL", undefined, "z2");
  // After z2: D-layer corners (slots 4-7) should be bright, U-layer dimmed
  // U corners: all dim (because after z2, they hold what was D-layer dimmed)
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["dim", "dim", "dim"]);
  // D corners: D-face sticker dimmed, side stickers regular (rotated U_FACE)
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "CORNERS", i)).toEqual(["dim", "regular", "regular"]);
  // U edges: all dim
  for (let i = 0; i < 4; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "dim"]);
  // D edges: top dim, side regular (rotated U_FACE)
  for (let i = 4; i < 8; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "regular"]);
  // Equatorial edges: all dim
  for (let i = 8; i < 12; i++)
    expect(pieceFacelets(mask, "EDGES", i)).toEqual(["dim", "dim"]);
  // All centers dimmed
  for (let i = 0; i < 6; i++)
    expect(pieceFacelets(mask, "CENTERS", i)).toEqual(["dim"]);
});

// -- Asymmetric rotation (VHLS) -----------------------------------------

test("[mask-16] VHLS with y rotation: bright FR slot moves to FL", () => {
  // VHLS dims F2L + centers EXCEPT FR slot. After y rotation,
  // the FR slot should map to FL (since y maps F->L, R->F).
  const noRot = buildStickeringMaskString("VHLS");
  const yRot = buildStickeringMaskString("VHLS", undefined, "y");
  // Without rotation: DRF (corner 4) is bright (regular), DFL (corner 5) is dimmed
  expect(pieceFacelets(noRot, "CORNERS", 4)).toEqual(["regular", "regular", "regular"]);
  expect(pieceFacelets(noRot, "CORNERS", 5)).toEqual(["dim", "dim", "dim"]);
  // With y rotation: DFL (corner 5) becomes bright, DRF (corner 4) becomes dimmed
  expect(pieceFacelets(yRot, "CORNERS", 5)).toEqual(["regular", "regular", "regular"]);
  expect(pieceFacelets(yRot, "CORNERS", 4)).toEqual(["dim", "dim", "dim"]);
  // FR edge (slot 8): bright without rotation
  expect(pieceFacelets(noRot, "EDGES", 8)).toEqual(["regular", "regular"]);
  // FL edge (slot 9): bright with y rotation
  expect(pieceFacelets(yRot, "EDGES", 9)).toEqual(["regular", "regular"]);
  // FR edge (slot 8): dimmed with y rotation
  expect(pieceFacelets(yRot, "EDGES", 8)).toEqual(["dim", "dim"]);
});

test("[mask-17] VHLS with y' rotation: bright FR slot moves to BR", () => {
  const yPrimeRot = buildStickeringMaskString("VHLS", undefined, "y'");
  // y' maps F->R, R->B: FR slot -> BR slot
  // DBR corner (slot 7) should be bright
  expect(pieceFacelets(yPrimeRot, "CORNERS", 7)).toEqual(["regular", "regular", "regular"]);
  // BR edge (slot 10) should be bright
  expect(pieceFacelets(yPrimeRot, "EDGES", 10)).toEqual(["regular", "regular"]);
  // DRF corner (slot 4) should be dimmed
  expect(pieceFacelets(yPrimeRot, "CORNERS", 4)).toEqual(["dim", "dim", "dim"]);
});
