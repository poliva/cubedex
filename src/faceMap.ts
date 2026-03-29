// ── Face Map Operations ────────────────────────────────────────────────
// Functions for building and manipulating face-remap tables used to
// track how GAN-reported face names relate to algorithm-frame face names
// after rotation-carrying moves (wide, slice, whole-cube rotations).

// CW rotation cycles for each axis. One quarter-turn advances one step in the array.
// x: U->B->D->F (like R), y: F->L->B->R (like U), z: U->R->D->L (like F)
const ROTATION_CYCLES: string[][] = [
  ["U", "B", "D", "F"], // axis 0 (x)
  ["F", "L", "B", "R"], // axis 1 (y)
  ["U", "R", "D", "L"], // axis 2 (z)
];

/** Applies a single rotation (axis + quarter-turns) to a face map in-place. */
export function applyRotationToFaceMap(faceMap: Record<string, string>, axis: number, quarterTurns: number): void {
  const cycle = ROTATION_CYCLES[axis];
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return;
  const newMap = { ...faceMap };
  for (const face of ["U", "D", "F", "B", "R", "L"]) {
    const pos = faceMap[face];
    const idx = cycle.indexOf(pos);
    if (idx >= 0) newMap[face] = cycle[(idx + turns) % 4];
  }
  Object.assign(faceMap, newMap);
}

/**
 * Returns [axisIndex, quarterTurns] for wide/slice/rotation moves; null for face-only moves.
 * axisIndex: 0=x, 1=y, 2=z.
 * quarterTurns: positive = CW when looking from +axis, negative = CCW.
 */
export function getOrientationChange(move: string): [number, number] | null {
  const base = move.replace(/[2']/g, '');
  const isPrime = move.includes("'");
  const isDouble = move.includes("2");
  const turns = isDouble ? 2 : (isPrime ? -1 : 1);

  const rotationMap: { [key: string]: [number, number] } = {
    "r": [0, 1],   // x
    "l": [0, -1],  // x'
    "M": [0, -1],  // x' (follows L)
    "u": [1, 1],   // y
    "d": [1, -1],  // y'
    "E": [1, -1],  // y' (follows D)
    "f": [2, 1],   // z
    "b": [2, -1],  // z'
    "S": [2, 1],   // z (follows F)
    "x": [0, 1],
    "y": [1, 1],
    "z": [2, 1],
  };

  const entry = rotationMap[base];
  if (!entry) return null;
  return [entry[0], entry[1] * turns];
}

/** Builds a face-remap table from wide/slice/rotation moves up to a given index in the algorithm. */
export function buildAlgFaceMap(userAlg: string[], upToIndex: number): Record<string, string> {
  const faceMap: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  for (let i = 0; i <= upToIndex && i < userAlg.length; i++) {
    const move = userAlg[i]?.replace(/[()]/g, "");
    if (!move) continue;
    const change = getOrientationChange(move);
    if (!change) continue;
    applyRotationToFaceMap(faceMap, change[0], change[1]);
  }
  return faceMap;
}

/** Transforms a GAN-cube move into the algorithm's reference frame using a face map. */
export function transformMoveByFaceMap(ganMove: string, faceMap: Record<string, string>): string {
  const base = ganMove[0];
  const mapped = faceMap[base];
  return mapped ? mapped + ganMove.slice(1) : ganMove;
}

/** Inverts a face map (swaps keys and values). */
export function invertFaceMap(faceMap: Record<string, string>): Record<string, string> {
  const inv: Record<string, string> = {};
  for (const [key, value] of Object.entries(faceMap)) {
    inv[value] = key;
  }
  return inv;
}

/** Composes two face maps: result[face] = outer[inner[face]]. */
export function composeFaceMaps(outer: Record<string, string>, inner: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const face of ["U", "D", "F", "B", "R", "L"]) {
    result[face] = outer[inner[face]];
  }
  return result;
}

/** Returns true if the face map is the identity (no rotation). */
export function isIdentityFaceMap(faceMap: Record<string, string>): boolean {
  return faceMap.U === "U" && faceMap.D === "D" && faceMap.F === "F" && faceMap.B === "B" && faceMap.R === "R" && faceMap.L === "L";
}

// ── Slice rotation lookup ──────────────────────────────────────────────
// Pre-computed face maps for the rotation component of each slice, wide, and whole-cube move.
// Used for sliceOrientation tracking (visual remapping when gyro is disabled)
// and for double-turn detection (orientation-aware face matching in updateAlgDisplay).

const FACES = ["U", "D", "F", "B", "R", "L"] as const;
const IDENTITY_MAP: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };

function _rot(axis: number, quarterTurns: number): Record<string, string> {
  const m = { ...IDENTITY_MAP };
  applyRotationToFaceMap(m, axis, quarterTurns);
  return m;
}

const ROT_X  = _rot(0, 1);
const ROT_XI = _rot(0, -1);
const ROT_X2 = _rot(0, 2);
const ROT_Y  = _rot(1, 1);
const ROT_YI = _rot(1, -1);
const ROT_Y2 = _rot(1, 2);
const ROT_Z  = _rot(2, 1);
const ROT_ZI = _rot(2, -1);
const ROT_Z2 = _rot(2, 2);

/** Maps slice/wide/rotation move strings to their rotation-component face maps. */
export const SLICE_ROTATION: Record<string, Record<string, string>> = {
  "M'": ROT_X,  "M": ROT_XI,  "M2": ROT_X2,
  "S":  ROT_ZI, "S'": ROT_Z,  "S2": ROT_Z2,
  "E":  ROT_YI, "E'": ROT_Y,  "E2": ROT_Y2,
  "r":  ROT_X,  "r'": ROT_XI, "r2": ROT_X2,
  "l":  ROT_XI, "l'": ROT_X,  "l2": ROT_X2,
  "u":  ROT_Y,  "u'": ROT_YI, "u2": ROT_Y2,
  "d":  ROT_YI, "d'": ROT_Y,  "d2": ROT_Y2,
  "f":  ROT_ZI, "f'": ROT_Z,  "f2": ROT_Z2,
  "b":  ROT_Z,  "b'": ROT_ZI, "b2": ROT_Z2,
  "x":  ROT_X,  "x'": ROT_XI, "x2": ROT_X2,
  "y":  ROT_Y,  "y'": ROT_YI, "y2": ROT_Y2,
  "z":  ROT_ZI, "z'": ROT_Z,  "z2": ROT_Z2,
};

/** Updates a slice orientation face map by composing the rotation of the given slice/wide move. */
export function updateSliceOrientation(sliceOrientation: Record<string, string>, sliceMove: string): void {
  const rot = SLICE_ROTATION[sliceMove];
  if (rot) {
    const composed = composeFaceMaps(sliceOrientation, rot);
    Object.assign(sliceOrientation, composed);
  }
}

/** Remaps a face move through the inverse of the current slice orientation for correct visual display. */
export function remapMoveForPlayer(move: string, sliceOrientation: Record<string, string>): string {
  const face = move.charAt(0);
  if (!FACES.includes(face as any)) return move;
  const inv = invertFaceMap(sliceOrientation);
  const mapped = inv[face];
  return mapped === face ? move : mapped + move.slice(1);
}
