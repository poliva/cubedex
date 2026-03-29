// ── Face Masking & Stickering ──────────────────────────────────────────
// Facelet data definitions, pattern comparison, ignore/dimming logic,
// and stickering mask generation. No state (S) or DOM ($) dependencies.

import { KPattern } from 'cubing/kpuzzle';
import { patternToFacelets } from "./utils";
import {
  getOrientationChange, applyRotationToFaceMap, isIdentityFaceMap,
} from './faceMap';
import { expandNotation } from './notationHelper';

// ── Types ──────────────────────────────────────────────────────────────

/** Per-facelet mask value accepted by cubing.js experimentalStickeringMaskOrbits. */
type FaceletMask = "regular" | "dim" | "oriented" | "ignored" | "invisible";

/** Per-piece mask: one FaceletMask per sticker (3 for corners, 2 for edges, 1 for centers). */
interface PieceStickeringMask { facelets: FaceletMask[]; }

/** Per-orbit mask: one entry per slot in the orbit. */
interface OrbitStickeringMask { pieces: PieceStickeringMask[]; }

/** Full stickering mask object for experimentalStickeringMaskOrbits. */
export interface StickeringMask { orbits: Record<string, OrbitStickeringMask>; }

// ── Facelet orbit tables ───────────────────────────────────────────────
// Explicit facelet index arrays (0-53) for dimming/ignoring masks.
// Refer to the ASCII art above and CORNER_FACELETS / EDGE_FACELETS for derivation.
//
//             +-----------+
//             | U (White) |
//             |  0  1  2  |
//             |  3  4  5  |
//             |  6  7  8  |
// +-----------+-----------+----------+----------+
// | L (Orange)| F (Green) | R (Red)  | B (Blue) |
// | 36 37 38  | 18 19 20  |  9 10 11 | 45 46 47 |
// | 39 40 41  | 21 22 23  | 12 13 14 | 48 49 50 |
// | 42 43 44  | 24 25 26  | 15 16 17 | 51 52 53 |
// +-----------+-----------+----------+----------+
//             | D (Yellow)|
//             | 27 28 29  |
//             | 30 31 32  |
//             | 33 34 35  |
//             +-----------+

/**
 * Facelet indices for each corner orbit slot.
 * Each entry is [ori-0, ori-1, ori-2] where:
 *   ori-0 = the sticker on the U or D face (primary/orientation sticker)
 *   ori-1, ori-2 = the two side stickers (counter-clockwise order when looking at the corner)
 * The facelet index maps to a position on the 54-sticker unfolded cube:
 *   U face = 0-8, R face = 9-17, F face = 18-26, D face = 27-35, L face = 36-44, B face = 45-53
 * See cube-facelets.txt for a visual map.
 */
export const CORNER_FACELETS: number[][] = [
  [8, 9, 20],   // Corner 0 (UFR): U8=U-bottom-right, F20=F-top-right, R9=R-top-left
  [2, 45, 11],  // Corner 1 (URB): U2=U-top-right,    R11=R-top-right, B45=B-top-left
  [0, 36, 47],  // Corner 2 (UBL): U0=U-top-left,     B47=B-top-right, L36=L-top-left
  [6, 18, 38],  // Corner 3 (ULF): U6=U-bottom-left,  L38=L-top-right, F18=F-top-left
  [29, 26, 15], // Corner 4 (DRF): D29=D-top-right,   R15=R-bottom-left, F26=F-bottom-right
  [27, 44, 24], // Corner 5 (DFL): D27=D-top-left,    F24=F-bottom-left,  L44=L-bottom-right
  [33, 53, 42], // Corner 6 (DLB): D33=D-bottom-left,  L42=L-bottom-left, B53=B-bottom-right
  [35, 17, 51], // Corner 7 (DBR): D35=D-bottom-right, B51=B-bottom-left, R17=R-bottom-right
];
/**
 * Facelet indices for each edge orbit slot.
 * Each entry is [ori-0, ori-1] where:
 *   ori-0 = the primary sticker (U/D face for U/D-layer edges, F/B face for equatorial edges)
 *   ori-1 = the secondary sticker
 */
export const EDGE_FACELETS: number[][] = [
  [7, 19],  // Edge 0 (UF):  U7=U-bottom-center,  F19=F-top-center
  [5, 10],  // Edge 1 (UR):  U5=U-right-center,   R10=R-top-center
  [1, 46],  // Edge 2 (UB):  U1=U-top-center,     B46=B-top-center
  [3, 37],  // Edge 3 (UL):  U3=U-left-center,    L37=L-top-center
  [28, 25], // Edge 4 (DF):  D28=D-top-center,    F25=F-bottom-center
  [32, 16], // Edge 5 (DR):  D32=D-right-center,  R16=R-bottom-center
  [34, 52], // Edge 6 (DB):  D34=D-bottom-center, B52=B-bottom-center
  [30, 43], // Edge 7 (DL):  D30=D-left-center,   L43=L-bottom-center
  [23, 12], // Edge 8 (FR):  F23=F-right-center,  R12=R-left-center
  [21, 41], // Edge 9 (FL):  F21=F-left-center,   L41=L-right-center
  [48, 14], // Edge 10 (BR): B48=B-left-center,   R14=R-right-center
  [50, 39], // Edge 11 (BL): B50=B-right-center,  L39=L-left-center
];

/** Center sticker facelets in cubing.js orbit slot order: U=4, L=40, F=22, R=13, B=49, D=31. */
export const CENTER_FACELETS: number[] = [4, 40, 22, 13, 49, 31];

// cycles through facelets if rotated by x
const FACELET_ROTATION_CYCLES_Y: number[][] =
  [
    [0, 2, 8, 6], [1, 5, 7, 3], [4, 4, 4, 4], // U
    [27, 33, 35, 29], [28, 30, 34, 32], [31, 31, 31, 31], // D

    [18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11],
    [21, 39, 48, 12], [22, 40, 49, 13], [23, 41, 50, 14],
    [24, 42, 51, 15], [25, 43, 52, 16], [26, 44, 53, 17],
  ];

const FACELET_ROTATION_CYCLES_Z: number[][] =
  [
    [18, 20, 26, 24], [19, 23, 25, 21], [22, 22, 22, 22], // F
    [45, 51, 53, 47], [46, 48, 52, 50], [49, 49, 49, 49], // B

    // U → R → D → L (corrected mapping)
    [0, 11, 35, 42], [1, 14, 34, 39], [2, 17, 33, 36],
    [3, 10, 32, 43], [4, 13, 31, 40], [5, 16, 30, 37],
    [6, 9, 29, 44], [7, 12, 28, 41], [8, 15, 27, 38],
  ];

const FACELET_ROTATION_CYCLES_X: number[][] =
  [
    [9, 11, 17, 15], [10, 14, 16, 12], [13, 13, 13, 13], // R
    [36, 42, 44, 38], [37, 39, 43, 41], [40, 40, 40, 40], // L

    [0, 53, 27, 18], [3, 50, 30, 21], [6, 47, 33, 24],
    [1, 52, 28, 19], [4, 49, 31, 22], [7, 46, 34, 25],
    [2, 51, 29, 20], [5, 48, 32, 23], [8, 45, 35, 26],
  ];

// Canonical slot face-letter strings (sorted alphabetically), matching CORNER_FACELETS and EDGE_FACELETS indices.
export const CORNER_SLOT_NAMES: string[] = ['FRU', 'BRU', 'BLU', 'FLU', 'DFR', 'DFL', 'BDL', 'BDR'];
export const EDGE_SLOT_NAMES: string[] = ['FU', 'RU', 'BU', 'LU', 'DF', 'DR', 'BD', 'DL', 'FR', 'FL', 'BR', 'BL'];

// ── Facelet groups ─────────────────────────────────────────────────────
// U face: all 9 stickers
const U_FACE_FACELETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// -- Basic LL groups (corners) --
const LL_CORNER_TOP_FACELETS = [8, 2, 0, 6];    // UFR=8, URB=2, UBL=0, ULF=6
const LL_CORNER_SIDE_FACELETS = [20, 9, 11, 45, 47, 36, 38, 18];

// -- Basic LL groups (edges) --
const LL_EDGE_TOP_FACELETS = [7, 5, 1, 3];      // UF=7, UR=5, UB=1, UL=3
const LL_EDGE_SIDE_FACELETS = [19, 10, 46, 37]; // UF=19, UR=10, UB=46, UL=37

// -- Composed LL groups --
const LL_SIDE_FACELETS = [...LL_CORNER_SIDE_FACELETS, ...LL_EDGE_SIDE_FACELETS]; // 12 facelets: all LL sides
const LL_ALL_FACELETS = [...LL_CORNER_TOP_FACELETS, ...LL_CORNER_SIDE_FACELETS, ...LL_EDGE_TOP_FACELETS, ...LL_EDGE_SIDE_FACELETS]; // 20 facelets
const U_EDGES_ALL_FACELETS = [...LL_EDGE_TOP_FACELETS, ...LL_EDGE_SIDE_FACELETS]; // 8 facelets

// -- Centers --
const CENTER_R = 13;
const CENTER_F = 22;
const CENTER_D = 31;
const CENTER_L = 40;
const CENTER_B = 49;
const NON_U_CENTERS = [CENTER_R, CENTER_F, CENTER_D, CENTER_L, CENTER_B];

// -- D-layer edges --
const EDGE_DF_FACELETS = [28, 25];
const EDGE_DR_FACELETS = [32, 16];
const EDGE_DB_FACELETS = [34, 52];
const EDGE_DL_FACELETS = [30, 43];

// -- Equatorial edges: FR, FL, BR, BL (8 facelets) --
const EQUATORIAL_EDGE_FACELETS = [23, 12, 21, 41, 48, 14, 50, 39];

// -- F2L: D-layer corners + D-layer edges + equatorial edges (28 facelets) --
const D_CORNER_FACELETS = [29, 15, 26, 27, 24, 44, 33, 42, 53, 35, 51, 17];
const D_EDGE_FACELETS = [...EDGE_DF_FACELETS, ...EDGE_DR_FACELETS, ...EDGE_DB_FACELETS, ...EDGE_DL_FACELETS];
const F2L_FACELETS = [...D_CORNER_FACELETS, ...D_EDGE_FACELETS, ...EQUATORIAL_EDGE_FACELETS];

// -- All corner facelets (U + D, 24 total) --
const ALL_CORNER_FACELETS = [
  ...LL_CORNER_TOP_FACELETS, ...LL_CORNER_SIDE_FACELETS, // U corners
  ...D_CORNER_FACELETS,                                    // D corners
];

// -- Front-right F2L slot: DFR corner + FR edge (5 facelets) --
const FR_SLOT_FACELETS = [29, 15, 26, 23, 12];

// -- All 54 facelets (for "ignore everything" masks) --
export const ALL_FACELETS: number[] = Array.from({ length: 54 }, (_, i) => i);

/** Subtracts the items in `remove` from `arr`. Utility for building sets. */
function subtract(arr: number[], remove: number[]): number[] {
  const s = new Set(remove);
  return arr.filter(f => !s.has(f));
}



// ── Category ignored facelets ──────────────────────────────────────────
// Determines which facelets to IGNORE during pattern comparison and display.
// Ignored = gray in the 3D view, skipped in partialStateEquals.
// Composed from the reusable groups above.

export const CATEGORY_IGNORED_FACELETS: Record<string, Set<number>> = (() => {
  // F2L: ignore entire LL (focus is D-layer + equatorial slots)
  const ignoreLL = new Set(LL_ALL_FACELETS);

  // OLL: ignore side stickers only (U-face tops visible for orientation check)
  const ignoreLLSides = new Set(LL_SIDE_FACELETS);

  // EOLL/ZBLS: ignore corners entirely + edge sides (only edge U-face tops visible)
  const ignoreEdgeOriOnly = new Set([...LL_CORNER_TOP_FACELETS, ...LL_CORNER_SIDE_FACELETS, ...LL_EDGE_SIDE_FACELETS]);

  // LSOCLL: ignore edge tops + all sides (only corner tops visible for corner-orientation check)
  const ignoreCornerOriOnly = new Set([...LL_EDGE_TOP_FACELETS, ...LL_CORNER_SIDE_FACELETS, ...LL_EDGE_SIDE_FACELETS]);

  // COLL: ignore edge sides only (full corner comparison, edge orientation via tops)
  const ignoreEdgeSides = new Set([...LL_EDGE_SIDE_FACELETS]);

  // CMLL (Roux): ignore all U-layer edges + DF + DB edges + F/B centers
  const ignoreCMLL = new Set([...U_EDGES_ALL_FACELETS, ...EDGE_DF_FACELETS, ...EDGE_DB_FACELETS, CENTER_F, CENTER_B]);

  // L6E (Roux): ignore all corners + equatorial edges + DR + DL
  const ignoreL6E = new Set([...ALL_CORNER_FACELETS, ...EQUATORIAL_EDGE_FACELETS, ...EDGE_DR_FACELETS, ...EDGE_DL_FACELETS]);

  const empty = new Set<number>();

  return {
    'f2l': ignoreLL,
    'cls': ignoreLL,
    'els': ignoreLL,
    'ls': ignoreLL,
    'oll': ignoreLLSides,
    'ocll': ignoreLLSides,
    'vls': ignoreLLSides,
    'wvls': ignoreLLSides,
    'lsoll': ignoreLLSides,
    'eoll': ignoreEdgeOriOnly,
    'zbls': ignoreEdgeOriOnly,
    'vhls': ignoreEdgeOriOnly,
    'lsocll': ignoreCornerOriOnly,
    'coll': ignoreEdgeSides,
    'ollcp': ignoreEdgeSides,
    'pll': empty,
    'epll': empty,
    'zbll': empty,
    'cmll': ignoreCMLL,
    'l6eeo': ignoreL6E,
    'l6eeolr': ignoreL6E,
    '2lookoll': ignoreEdgeOriOnly,
    '2lookpll': ignoreEdgeSides,
  };
})();

// ── Category dimmed facelets ───────────────────────────────────────────
// Determines which facelets to DIM in the visual display (muted colors).
// Dimmed pieces are context that is already solved; the focus is elsewhere.
// Not used for pattern comparison, only for the 3D stickering mask.

export const CATEGORY_DIMMED_FACELETS: Record<string, Set<number>> = (() => {
  // LL categories: dim the entire F2L region + all non-U centers
  const dimF2LAndCenters = new Set([...F2L_FACELETS, ...NON_U_CENTERS]);

  // PLL: dim F2L + centers + entire U face (only LL side stickers matter)
  const dimPLL = new Set([...dimF2LAndCenters, ...U_FACE_FACELETS]);

  // VHLS/WVLS/ZBLS: dim F2L + centers EXCEPT the front-right slot (DFR + FR)
  const dimExceptFR = new Set(subtract([...F2L_FACELETS, ...NON_U_CENTERS], FR_SLOT_FACELETS));

  // CMLL: dim F2L + R/D/L centers (F and B centers are in the ignored set)
  const dimCMLL = new Set([...F2L_FACELETS, CENTER_R, CENTER_D, CENTER_L]);

  // L6E: dim all corners + equatorial edges + DR + DL + R/D/L/B centers
  const dimL6E = new Set([...ALL_CORNER_FACELETS, ...EQUATORIAL_EDGE_FACELETS, ...EDGE_DR_FACELETS, ...EDGE_DL_FACELETS, CENTER_R, CENTER_D, CENTER_L, CENTER_B]);

  const empty = new Set<number>();

  return {
    'f2l': empty,
    'cls': empty,
    'els': empty,
    'ls': empty,
    'oll': dimF2LAndCenters,
    'ocll': dimF2LAndCenters,
    'lsoll': dimF2LAndCenters,
    'eoll': dimF2LAndCenters,
    'lsocll': dimF2LAndCenters,
    'coll': dimF2LAndCenters,
    'ollcp': dimF2LAndCenters,
    'vls': empty,
    'vhls': dimExceptFR,
    'wvls': dimExceptFR,
    'zbls': dimExceptFR,
    'pll': dimPLL,
    'epll': dimPLL,
    'zbll': dimF2LAndCenters,
    'cmll': dimCMLL,
    'l6eeo': dimL6E,
    'l6eeolr': dimL6E,
    '2lookoll': dimF2LAndCenters,
    '2lookpll': dimPLL,
  };
})();

// ── Orientation fix ────────────────────────────────────────────────────

/** Normalizes a KPattern's orientation by trying all 24 rotations until centers are identity. */
export function fixOrientation(pattern: KPattern) {
  const identity = JSON.stringify([0, 1, 2, 3, 4, 5]);
  if (JSON.stringify(pattern.patternData["CENTERS"].pieces) === identity) {
    return pattern;
  }
  // Try all 24 cube orientations: 6 face-up positions x 4 y-rotations.
  // Face-up: identity, x, x2, x3(=x'), z, z3(=z')
  const faceUpSeqs: string[][] = [[], ["x"], ["x", "x"], ["x", "x", "x"], ["z"], ["z", "z", "z"]];
  for (const seq of faceUpSeqs) {
    let base = pattern;
    for (const r of seq) base = base.applyAlg(r);
    if (JSON.stringify(base.patternData["CENTERS"].pieces) === identity) return base;
    for (let i = 0; i < 3; i++) {
      base = base.applyAlg("y");
      if (JSON.stringify(base.patternData["CENTERS"].pieces) === identity) return base;
    }
  }
  return pattern;
}

// ── IGNORE_PIECE_MAP ───────────────────────────────────────────────────

// Maps user-facing piece names to cubing.js CORNERS/EDGES orbit indices (Reid order)
// Corners: UFR(0), URB(1), UBL(2), ULF(3), DRF(4), DFL(5), DLB(6), DBR(7)
// Edges:   UF(0), UR(1), UB(2), UL(3), DF(4), DR(5), DB(6), DL(7), FR(8), FL(9), BR(10), BL(11)
export const IGNORE_PIECE_MAP: Record<string, { orbit: string; index: number }> = {
  'FU': { orbit: 'EDGES', index: 0 }, 'RU': { orbit: 'EDGES', index: 1 },
  'BU': { orbit: 'EDGES', index: 2 }, 'LU': { orbit: 'EDGES', index: 3 },
  'DF': { orbit: 'EDGES', index: 4 }, 'DR': { orbit: 'EDGES', index: 5 },
  'BD': { orbit: 'EDGES', index: 6 }, 'DL': { orbit: 'EDGES', index: 7 },
  'FR': { orbit: 'EDGES', index: 8 }, 'FL': { orbit: 'EDGES', index: 9 },
  'BR': { orbit: 'EDGES', index: 10 }, 'BL': { orbit: 'EDGES', index: 11 },
  'FRU': { orbit: 'CORNERS', index: 0 }, 'BRU': { orbit: 'CORNERS', index: 1 },
  'BLU': { orbit: 'CORNERS', index: 2 }, 'FLU': { orbit: 'CORNERS', index: 3 },
  'DFR': { orbit: 'CORNERS', index: 4 }, 'DFL': { orbit: 'CORNERS', index: 5 },
  'BDL': { orbit: 'CORNERS', index: 6 }, 'BDR': { orbit: 'CORNERS', index: 7 },
};

// ── Pattern comparison ─────────────────────────────────────────────────

/** Compares two KPattern states, ignoring pieces masked by stickering category and ignore string. */
export function partialStateEquals(state1: KPattern, state2: KPattern, stickering: string, ignorePiecesStr?: string): boolean {
  const normalizedKey = stickering.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const categoryIgnored = CATEGORY_IGNORED_FACELETS[normalizedKey];
  if (!categoryIgnored && !ignorePiecesStr) return state1.isIdentical(state2);

  const facelets1 = patternToFacelets(state1);
  const facelets2 = patternToFacelets(state2);

  // Build combined ignore set: category base + per-case ignore pieces
  let ignored: Set<number> = categoryIgnored || new Set();
  if (ignorePiecesStr) {
    ignored = new Set(ignored);
    for (const raw of ignorePiecesStr.split(/[;,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)) {
      const normalized = raw.split('').sort().join('');
      const m = IGNORE_PIECE_MAP[normalized];
      if (m) {
        const facelets = m.orbit === 'CORNERS' ? CORNER_FACELETS[m.index] : EDGE_FACELETS[m.index];
        for (const f of facelets) ignored.add(f);
      }
    }
  }

  for (let i = 0; i < 54; i++) {
    if (ignored.has(i)) continue;
    if (facelets1[i] !== facelets2[i]) return false;
  }
  return true;
}

// ── Rotation helpers ───────────────────────────────────────────────────

/**
 * Rotates a set of facelet indices through a face map derived from the given rotation algorithm.
 * Used for both ignored and dimmed facelet sets to keep visual masking correct when the
 * display is color-rotated.
 */
export function rotateFacelets(facelets: Set<number>, algorithm: string): Set<number> {
  // aply each rotation separately
  var result = new Set(facelets);
  if (!algorithm || algorithm.length === 0) return result;
  for (const rotation of expandNotation(algorithm).trim().split(/\s+/)) {
    const old = result;
    result = new Set();

    var direction = rotation.endsWith("'") ? -1 : rotation.endsWith("2") ? 2 : 1;
    var cycles = rotation[0] == "x" ? FACELET_ROTATION_CYCLES_X
      : rotation[0] == "y" ? FACELET_ROTATION_CYCLES_Y
        : rotation[0] == "z" ? FACELET_ROTATION_CYCLES_Z
          : null;
    if (!cycles) throw new Error(`Invalid rotation move: ${rotation} in algorithm: ${algorithm}`);

    // go throug all facelets and apply rotation
    for (const f of old) {
      // find correct cycle
      var found = false;
      for (const cycle of cycles) {
        const index = cycle.indexOf(f);
        if (index >= 0) {
          // found, apply rotation and add to result
          const newIndex = (index + direction + 4) % 4;
          result.add(cycle[newIndex]);
          found = true;
          break;
        }
        if (found) break;
      }
      if (!found) {
        throw new Error(`Facelet ${f} not found in any cycle for rotation ${rotation} in algorithm: ${algorithm}`);
      }
    }
  }
  return result;
}

// ── Stickering mask generation ─────────────────────────────────────────

/**
 * Builds a per-facelet stickering mask object for experimentalStickeringMaskOrbits.
 * Uses the object API so each individual sticker can be "regular", "dim", or "ignored"
 * independently (not limited to per-piece granularity like the string format).
 */
export function buildStickeringMaskFromFacelets(ignored: Set<number>, dimmed?: Set<number>): StickeringMask {
  const d = dimmed || new Set<number>();
  function faceletMask(fi: number): FaceletMask {
    if (ignored.has(fi)) return "ignored";
    if (d.has(fi)) return "dim";
    return "regular";
  }

  // cubing.js expects 5 facelets per piece (max orientations across all orbits).
  // Pad shorter arrays with "regular" to avoid out-of-bounds access in the renderer.
  function pad5(arr: FaceletMask[]): FaceletMask[] {
    while (arr.length < 5) arr.push("regular");
    return arr;
  }

  return {
    orbits: {
      CORNERS: {
        pieces: CORNER_FACELETS.map(facelets => ({
          facelets: pad5(facelets.map(fi => faceletMask(fi))),
        })),
      },
      EDGES: {
        pieces: EDGE_FACELETS.map(facelets => ({
          facelets: pad5(facelets.map(fi => faceletMask(fi))),
        })),
      },
      CENTERS: {
        pieces: CENTER_FACELETS.map(fi => ({
          facelets: pad5([faceletMask(fi)]),
        })),
      },
    },
  };
}

/**
 * Builds the experimentalStickeringMaskOrbits string for a category + optional per-case ignore pieces.
 * Single source of truth: derives from CATEGORY_IGNORED_FACELETS + CATEGORY_DIMMED_FACELETS.
 * rotationAlg: the color-rotation algorithm (e.g. "y", "z2") -- used to rotate the dimmed/ignored sets
 * so visual masking stays correct when the display is color-rotated.
 * The twisty player masks by piece identity, so when the cube is rotated the mask must rotate too.
 */
export function buildStickeringMaskString(category: string, ignorePiecesStr?: string, rotationAlg?: string): StickeringMask {
  const normalizedKey = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  // Start from category base facelets or empty set
  const baseFacelets = CATEGORY_IGNORED_FACELETS[normalizedKey];
  let ignored: Set<number> = baseFacelets ? new Set(baseFacelets) : new Set<number>();
  let dimmed: Set<number> = CATEGORY_DIMMED_FACELETS[normalizedKey] || new Set<number>();

  // Merge per-case ignore pieces in canonical frame first.
  if (ignorePiecesStr) {
    const pieces = ignorePiecesStr.split(/[;,\s]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (pieces.length > 0) {
      for (const piece of pieces) {
        const normalizedPiece = piece.split('').sort().join('');
        const mapping = IGNORE_PIECE_MAP[normalizedPiece];
        if (mapping) {
          const facelets = mapping.orbit === 'CORNERS' ? CORNER_FACELETS[mapping.index] : EDGE_FACELETS[mapping.index];
          for (const f of facelets) ignored.add(f);
        }
      }
    }
  }

  // Rotate both masks to match the display rotation (for y/z2/any-orientation modes).
  if (rotationAlg) {
    dimmed = rotateFacelets(dimmed, rotationAlg);
    ignored = rotateFacelets(ignored, rotationAlg);
  }

  return buildStickeringMaskFromFacelets(ignored, dimmed);
}
