/**
 * Unit tests for faceMap.ts: applyRotationToFaceMap, buildAlgFaceMap,
 * transformMoveByFaceMap, invertFaceMap, composeFaceMaps, and isIdentityFaceMap.
 * All tests are pure (no browser needed): they import faceMap.ts directly.
 */
import { test, expect } from "@playwright/test";
import {
  applyRotationToFaceMap,
  getOrientationChange,
  buildAlgFaceMap,
  transformMoveByFaceMap,
  invertFaceMap,
  composeFaceMaps,
  isIdentityFaceMap,
} from "../src/faceMap";

const identity = () => ({ U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });

// -- applyRotationToFaceMap -----------------------------------------------

test("[fm-1] applyRotationToFaceMap: y rotation (axis 1, +1 quarter)", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 1);
  // y: F->L->B->R cycle. So U stays, D stays, F->L, L->B, B->R, R->F
  expect(fm.U).toBe("U");
  expect(fm.D).toBe("D");
  expect(fm.F).toBe("L");
  expect(fm.R).toBe("F");
  expect(fm.B).toBe("R");
  expect(fm.L).toBe("B");
});

test("[fm-2] applyRotationToFaceMap: y' rotation (axis 1, -1 quarter)", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, -1);
  expect(fm.F).toBe("R");
  expect(fm.R).toBe("B");
  expect(fm.B).toBe("L");
  expect(fm.L).toBe("F");
  expect(fm.U).toBe("U");
  expect(fm.D).toBe("D");
});

test("[fm-3] applyRotationToFaceMap: y2 (axis 1, +2 quarters)", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 2);
  expect(fm.F).toBe("B");
  expect(fm.B).toBe("F");
  expect(fm.R).toBe("L");
  expect(fm.L).toBe("R");
  expect(fm.U).toBe("U");
  expect(fm.D).toBe("D");
});

test("[fm-4] applyRotationToFaceMap: x rotation (axis 0, +1 quarter)", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 0, 1);
  // x: U->B->D->F cycle
  expect(fm.U).toBe("B");
  expect(fm.F).toBe("U");
  expect(fm.D).toBe("F");
  expect(fm.B).toBe("D");
  expect(fm.R).toBe("R");
  expect(fm.L).toBe("L");
});

test("[fm-5] applyRotationToFaceMap: z rotation (axis 2, +1 quarter)", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 2, 1);
  // z: U->R->D->L cycle
  expect(fm.U).toBe("R");
  expect(fm.R).toBe("D");
  expect(fm.D).toBe("L");
  expect(fm.L).toBe("U");
  expect(fm.F).toBe("F");
  expect(fm.B).toBe("B");
});

test("[fm-6] applyRotationToFaceMap: 0 turns is identity", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 0);
  expect(fm).toEqual(identity());
});

test("[fm-7] applyRotationToFaceMap: 4 turns = identity", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 0, 4);
  expect(fm).toEqual(identity());
});

// -- getOrientationChange ---------------------------------------------------

test("[fm-8] getOrientationChange: face moves return null", () => {
  expect(getOrientationChange("R")).toBeNull();
  expect(getOrientationChange("U'")).toBeNull();
  expect(getOrientationChange("F2")).toBeNull();
  expect(getOrientationChange("L")).toBeNull();
});

test("[fm-9] getOrientationChange: wide/slice/rotation moves", () => {
  expect(getOrientationChange("r")).toEqual([0, 1]);
  expect(getOrientationChange("r'")).toEqual([0, -1]);
  expect(getOrientationChange("r2")).toEqual([0, 2]);
  expect(getOrientationChange("l")).toEqual([0, -1]);
  expect(getOrientationChange("d'")).toEqual([1, 1]);
  expect(getOrientationChange("u")).toEqual([1, 1]);
  expect(getOrientationChange("M")).toEqual([0, -1]);
  expect(getOrientationChange("E")).toEqual([1, -1]);
  expect(getOrientationChange("S")).toEqual([2, 1]);
  expect(getOrientationChange("x")).toEqual([0, 1]);
  expect(getOrientationChange("y")).toEqual([1, 1]);
  expect(getOrientationChange("z")).toEqual([2, 1]);
  expect(getOrientationChange("y'")).toEqual([1, -1]);
  expect(getOrientationChange("y2")).toEqual([1, 2]);
});

// -- buildAlgFaceMap --------------------------------------------------------

test("[fm-10] buildAlgFaceMap: no rotation moves -> identity", () => {
  const fm = buildAlgFaceMap(["R", "U'", "R'"], 2);
  expect(fm).toEqual(identity());
});

test("[fm-11] buildAlgFaceMap: d' produces y rotation in face map", () => {
  const fm = buildAlgFaceMap(["L", "U'", "L'", "d'"], 3);
  // d' -> y' orientation, but d' has [1, -1] * (-1 from prime) = [1, 1] = y
  // Actually: d base=[1,-1], d' means isPrime=true so turns = -1 * -1 = 1. So [1, 1] = y
  const expected = identity();
  applyRotationToFaceMap(expected, 1, 1);
  expect(fm).toEqual(expected);
});

test("[fm-12] buildAlgFaceMap: respects upToIndex limit", () => {
  // Only process up to index 2 (first 3 moves), skip the d'
  const fm = buildAlgFaceMap(["L", "U'", "L'", "d'", "R"], 2);
  expect(fm).toEqual(identity());
});

// -- transformMoveByFaceMap -------------------------------------------------

test("[fm-13] transformMoveByFaceMap: identity map returns same move", () => {
  expect(transformMoveByFaceMap("R", identity())).toBe("R");
  expect(transformMoveByFaceMap("U'", identity())).toBe("U'");
  expect(transformMoveByFaceMap("F2", identity())).toBe("F2");
});

test("[fm-14] transformMoveByFaceMap: rotated map transforms correctly", () => {
  // After y rotation: R maps to F
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 1);
  expect(transformMoveByFaceMap("R", fm)).toBe("F");
  expect(transformMoveByFaceMap("R'", fm)).toBe("F'");
  expect(transformMoveByFaceMap("R2", fm)).toBe("F2");
  expect(transformMoveByFaceMap("F", fm)).toBe("L");
});

// -- invertFaceMap ----------------------------------------------------------

test("[fm-15] invertFaceMap: identity inverts to identity", () => {
  expect(invertFaceMap(identity())).toEqual(identity());
});

test("[fm-16] invertFaceMap: y rotation inverse is y'", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 1);
  const inv = invertFaceMap(fm);
  // Original: R->F, so inverse: F->R
  expect(inv.F).toBe("R");
  expect(inv.R).toBe("B");
  // Composing should give identity
  const composed = composeFaceMaps(fm, inv);
  expect(composed).toEqual(identity());
});

// -- composeFaceMaps --------------------------------------------------------

test("[fm-17] composeFaceMaps: identity composed with anything is that thing", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 1);
  expect(composeFaceMaps(identity(), fm)).toEqual(fm);
  expect(composeFaceMaps(fm, identity())).toEqual(fm);
});

test("[fm-18] composeFaceMaps: y composed with y gives y2", () => {
  const y1 = identity();
  applyRotationToFaceMap(y1, 1, 1);
  const y2Expected = identity();
  applyRotationToFaceMap(y2Expected, 1, 2);
  expect(composeFaceMaps(y1, y1)).toEqual(y2Expected);
});

// -- isIdentityFaceMap ------------------------------------------------------

test("[fm-19] isIdentityFaceMap: identity returns true", () => {
  expect(isIdentityFaceMap(identity())).toBe(true);
});

test("[fm-20] isIdentityFaceMap: non-identity returns false", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 1);
  expect(isIdentityFaceMap(fm)).toBe(false);
});

test("[fm-21] isIdentityFaceMap: full rotation (y4) returns true", () => {
  const fm = identity();
  applyRotationToFaceMap(fm, 1, 4);
  expect(isIdentityFaceMap(fm)).toBe(true);
});
