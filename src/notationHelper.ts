// ── Notation Helpers ───────────────────────────────────────────────────
// Functions for parsing, transforming, and comparing cube algorithm notation.


import { Alg } from "cubing/alg";
import { experimentalCountMovesETM } from "cubing/notation";
import {
  getOrientationChange, applyRotationToFaceMap, isIdentityFaceMap,
  invertFaceMap, transformMoveByFaceMap,
} from './faceMap';

/** Count of whole-cube rotations (x/y/z) at the end of the move list. Smart cubes never emit these as MOVE events. */
export function trailingWholeCubeRotationMoveCount(moves: string[]): number {
  let c = 0;
  for (let i = moves.length - 1; i >= 0; i--) {
    const raw = moves[i].replace(/[()]/g, '').trim();
    if (!raw) continue;
    if (/^[xyz](?:2'|2|')?$/i.test(raw)) c++;
    else break;
  }
  return c;
}

/** Normalizes cube notation: expands special chars, adds spaces, cleans formatting. */
export function expandNotation(input: string): string {
  let output = input.replace(/["\u00b4`\u2018\u2019]/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/XYZ/g, "xyz");
  output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');
  output = output.replace(/\(/g, ' (');
  output = output.replace(/\)(?!\s)/g, ') ');
  output = output.replace(/'(?![\s)])/g, "' ");
  output = output.replace(/2(?![\s')])/g, '2 ');
  output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');
  output = output.replace(/(\s)(?=2)/g, '');;
  output = output.replace(/'2/g, "2'");;
  output = output.replace(/\s+/g, ' ');
  return output.trim();
}

/** Returns the inverse of a single cube move (R->R', U'->U, R2->R2). */
export function getInverseMove(move: string): string {
  const inverseMoves: { [key: string]: string } = {
    "U": "U'", "U'": "U", "D": "D'", "D'": "D",
    "L": "L'", "L'": "L", "R": "R'", "R'": "R",
    "F": "F'", "F'": "F", "B": "B'", "B'": "B",
    "u": "u'", "u'": "u", "d": "d'", "d'": "d",
    "l": "l'", "l'": "l", "r": "r'", "r'": "r",
    "f": "f'", "f'": "f", "b": "b'", "b'": "b",
    "M": "M'", "M'": "M", "E": "E'", "E'": "E",
    "S": "S'", "S'": "S", "x": "x'", "x'": "x",
    "y": "y'", "y'": "y", "z": "z'", "z'": "z",
  };
  return inverseMoves[move] || move;
}

/** Checks if a move is a whole-cube rotation (x, y, or z). */
export function isCubeRotation(move: string): boolean {
  const base = move.replace(/[()]/g, '').replace(/['2]/g, '');
  return base === "x" || base === "y" || base === "z";
}

/** Returns the two face-move components of a slice move, or null if not a slice.
 *  E.g. "S" -> ["F'", "B"], "M'" -> ["R'", "L"], "M2" -> ["R2", "L2"]. */
export function getSliceFaceComponents(move: string): [string, string] | null {
  const clean = move.replace(/[()]/g, '');
  const base = clean.replace(/['2]/g, '');
  const prime = clean.includes("'");
  const double = clean.includes("2");
  switch (base) {
    case "S": return double ? ["F2", "B2"] : prime ? ["F", "B'"] : ["F'", "B"];
    case "M": return double ? ["R2", "L2"] : prime ? ["R'", "L"] : ["R", "L'"];
    case "E": return double ? ["U2", "D2"] : prime ? ["U'", "D"] : ["U", "D'"];
    default: return null;
  }
}

/** Given two face moves, returns the slice name or null. Order-independent.
 *  E.g. ("R'", "L") -> "M'", ("R2", "L2") -> "M2". */
export function getSliceForComponents(move1: string, move2: string): string | null {
  for (const slice of ["M", "M'", "M2", "E", "E'", "E2", "S", "S'", "S2"]) {
    const comps = getSliceFaceComponents(slice);
    if (comps && ((comps[0] === move1 && comps[1] === move2) || (comps[0] === move2 && comps[1] === move1))) {
      return slice;
    }
  }
  return null;
}

/** Returns the face-move component of a wide move, or null if not a wide move.
 *  E.g. "r" -> "L", "d'" -> "U'". */
export function getWideFaceComponent(move: string): string | null {
  const clean = move.replace(/[()]/g, '');
  const base = clean.replace(/['2]/g, '');
  const suffix = clean.slice(base.length);
  const wideToOppositeFace: Record<string, string> = {
    "r": "L", "l": "R", "u": "D", "d": "U", "f": "B", "b": "F",
  };
  const oppFace = wideToOppositeFace[base];
  if (!oppFace) return null;
  return oppFace + suffix;
}

/** Returns the opposite-face move (U<->D, L<->R, F<->B). */
export function getOppositeMove(move: string): string {
  const oppositeMoves: { [key: string]: string } = {
    "U": "D", "D": "U", "L": "R", "R": "L", "F": "B", "B": "F",
    "U'": "D'", "D'": "U'", "L'": "R'", "R'": "L'", "F'": "B'", "B'": "F'",
  };
  return oppositeMoves[move] || move;
}

/** Converts a wide/slice/rotation move to its pure rotation equivalent (x, y, z). */
export function moveToRotationEquivalent(move: string): string {
  const base = move.replace(/[2']/g, '');
  const isPrime = move.includes("'");
  const isDouble = move.includes("2");

  const rotMap: Record<string, [string, boolean]> = {
    "r": ["x", false], "l": ["x", true],  "M": ["x", true],
    "u": ["y", false], "d": ["y", true],  "E": ["y", true],
    "f": ["z", false], "b": ["z", true],  "S": ["z", false],
    "x": ["x", false], "y": ["y", false], "z": ["z", false],
  };

  const entry = rotMap[base];
  if (!entry) return '';
  const [axis, negated] = entry;

  if (isDouble) return axis + '2';
  if (isPrime !== negated) return axis + "'";
  return axis;
}

/** Flattens an algorithm string by expanding parenthesized groups.
 *  (X Y Z)' -> Z' Y' X', (X Y Z)2 -> X Y Z X Y Z, etc. */
export function flattenAlg(algStr: string): string {
  let result = algStr;
  while (result.includes('(')) {
    const prev = result;
    result = result.replace(/\(([^()]*)\)(2'|2|')?/g, (_, inner, suffix) => {
      const moves = inner.trim().split(/\s+/).filter((m: string) => m);
      if (suffix === "'") {
        return moves.reverse().map((m: string) => getInverseMove(m)).join(' ');
      } else if (suffix === "2") {
        const s = inner.trim();
        return s + ' ' + s;
      } else if (suffix === "2'") {
        const inv = moves.reverse().map((m: string) => getInverseMove(m)).join(' ');
        return inv + ' ' + inv;
      }
      return inner.trim();
    });
    if (result === prev) break;
  }
  return result.replace(/\s+/g, ' ').trim();
}

/** Returns a rotation sequence that cancels the net orientation change of an algorithm. */
export function getOrientationCompensation(algStr: string): string {
  if (!algStr || !algStr.trim()) return '';

  const flatStr = flattenAlg(algStr);
  const moves = flatStr.split(/\s+/).filter(m => m);
  const rotMoves: string[] = [];
  for (const move of moves) {
    const rot = moveToRotationEquivalent(move);
    if (rot) rotMoves.push(rot);
  }
  if (rotMoves.length === 0) return '';

  const faceMap: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  for (const rot of rotMoves) {
    const axis = rot[0];
    const isPrime = rot.includes("'");
    const isDouble = rot.includes("2");
    const turns = isDouble ? 2 : (isPrime ? 3 : 1);
    const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    applyRotationToFaceMap(faceMap, axisIndex, turns);
  }
  if (isIdentityFaceMap(faceMap)) return '';

  return rotMoves.reverse().map(m => getInverseMove(m)).join(' ');
}

/** Splits an algorithm string at a cursor position, keeping the move at cursor in the left part. */
export function splitAlgAtCursor(alg: string, cursorPos: number): [string, string] {
  const moveChars = new Set('RLFBUDMESrlfbudxyz'.split(''));
  const modifierChars = new Set("2'".split(''));
  const moveRanges: { start: number; end: number }[] = [];

  let i = 0;
  while (i < alg.length) {
    if (moveChars.has(alg[i])) {
      const start = i;
      i++;
      while (i < alg.length && modifierChars.has(alg[i])) i++;
      moveRanges.push({ start, end: i });
    } else {
      i++;
    }
  }

  if (moveRanges.length === 0) return [alg, ''];

  let splitAfterIdx = -1;
  for (let j = 0; j < moveRanges.length; j++) {
    if (moveRanges[j].start < cursorPos) {
      splitAfterIdx = j;
    }
  }

  if (splitAfterIdx === -1) return ['', alg.trim()];

  const splitPos = moveRanges[splitAfterIdx].end;
  return [alg.substring(0, splitPos).trimEnd(), alg.substring(splitPos).trim()];
}

/** Converts an algorithm string to a valid HTML element ID (alphanumeric + hyphens). */
export function algToId(alg: string): string {
  let id = alg?.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(]/g, 'o').replace(/[)]/g, 'c');
  if (id == null || id.length == 0) {
    id = "default-alg-id";
  }
  return id;
}

/** Counts total moves in an algorithm using Execution Turn Metric (ETM). */
export function countMovesETM(alg: string): number {
  return experimentalCountMovesETM(Alg.fromString(alg));
}

// ── Notational equivalence ─────────────────────────────────────────────

/** Applies the rotation component of a move to a face map in-place. */
function applyMoveRotationToFaceMap(move: string, faceMap: Record<string, string>): void {
  const change = getOrientationChange(move);
  if (change) applyRotationToFaceMap(faceMap, change[0], change[1]);
}

/** Normalizes a move for comparison: strips parens, treats U2' and U'2 the same. */
function normalizeMove(move: string): string {
  return move.replace(/[()]/g, '').replace(/'2/g, "2'");
}

/**
 * Checks if two algorithm strings are notationally equivalent.
 * Handles: double moves <-> two singles, slice <-> face pair, wide <-> opposite face,
 * with automatic face-map tracking when one side uses rotation-carrying moves.
 */
export function notationallyAlgEquivalent(algA: string, algB: string): boolean {
  const expandedA = expandNotation(algA);
  const expandedB = expandNotation(algB);
  const movesA = expandedA ? expandedA.split(/\s+/).filter(Boolean) : [];
  const movesB = expandedB ? expandedB.split(/\s+/).filter(Boolean) : [];

  const flatA = flattenToTaggedComponents(movesA);
  const flatB = flattenToTaggedComponents(movesB);

  return compareTaggedSequences(flatA, flatB);
}

type TaggedComp = { move: string; slicePairId: number };

function flattenToTaggedComponents(moves: string[]): TaggedComp[] {
  const faceMap: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  const result: TaggedComp[] = [];
  let pairCounter = 0;

  for (const move of moves) {
    const norm = normalizeMove(move);
    const base = norm.replace(/['2]/g, '');
    const isPrime = norm.includes("'");
    const isDouble = norm.includes("2");
    const invMap = invertFaceMap(faceMap);

    if ('xyz'.includes(base)) {
      applyMoveRotationToFaceMap(norm, faceMap);
      continue;
    }

    if ('RLFBUD'.includes(base)) {
      if (isDouble) {
        const mapped = transformMoveByFaceMap(base, invMap);
        result.push({ move: mapped, slicePairId: 0 }, { move: mapped, slicePairId: 0 });
      } else {
        result.push({ move: transformMoveByFaceMap(norm, invMap), slicePairId: 0 });
      }
    } else if ('MES'.includes(base)) {
      const canonical = isDouble ? base : (isPrime ? base + "'" : base);
      const comps = getSliceFaceComponents(canonical);
      if (comps) {
        const m1 = transformMoveByFaceMap(comps[0], invMap);
        const m2 = transformMoveByFaceMap(comps[1], invMap);
        if (isDouble) {
          pairCounter++;
          result.push({ move: m1, slicePairId: pairCounter }, { move: m2, slicePairId: pairCounter });
          pairCounter++;
          result.push({ move: m1, slicePairId: pairCounter }, { move: m2, slicePairId: pairCounter });
        } else {
          pairCounter++;
          result.push({ move: m1, slicePairId: pairCounter }, { move: m2, slicePairId: pairCounter });
        }
      }
    } else if ('rludfb'.includes(base)) {
      const canonical = isDouble ? base : (isPrime ? base + "'" : base);
      const comp = getWideFaceComponent(canonical);
      if (comp) {
        if (isDouble) {
          const mapped = transformMoveByFaceMap(comp, invMap);
          result.push({ move: mapped, slicePairId: 0 }, { move: mapped, slicePairId: 0 });
        } else {
          result.push({ move: transformMoveByFaceMap(comp, invMap), slicePairId: 0 });
        }
      }
    }

    applyMoveRotationToFaceMap(norm, faceMap);
  }

  return result;
}

function invertMove(m: string): string {
  return m.endsWith("'") ? m.slice(0, -1) : m + "'";
}

function compareTaggedSequences(seqA: TaggedComp[], seqB: TaggedComp[]): boolean {
  if (seqA.length !== seqB.length) return false;
  let i = 0;
  while (i < seqA.length) {
    const a = seqA[i], b = seqB[i];

    const aPair = a.slicePairId > 0 && i + 1 < seqA.length && seqA[i + 1].slicePairId === a.slicePairId;
    const bPair = b.slicePairId > 0 && i + 1 < seqB.length && seqB[i + 1].slicePairId === b.slicePairId;

    if (aPair || bPair) {
      const a1 = seqA[i].move, a2 = seqA[i + 1].move;
      const b1 = seqB[i].move, b2 = seqB[i + 1].move;
      const a1i = invertMove(a1), a2i = invertMove(a2);
      if (
        (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1) ||
        (a1i === b1 && a2i === b2) || (a1i === b2 && a2i === b1)
      ) {
        i += 2;
        continue;
      }
      return false;
    }

    if (
      a.slicePairId === 0 && b.slicePairId === 0 &&
      i + 1 < seqA.length && i + 1 < seqB.length &&
      seqA[i + 1].slicePairId === 0 && seqB[i + 1].slicePairId === 0
    ) {
      const a2 = seqA[i + 1].move, b2 = seqB[i + 1].move;
      const aBase = a.move.replace("'", ""), a2Base = a2.replace("'", "");
      const bBase = b.move.replace("'", ""), b2Base = b2.replace("'", "");
      if (aBase === a2Base && bBase === b2Base && aBase === bBase) {
        i += 2;
        continue;
      }
    }

    if (a.move !== b.move) return false;
    i++;
  }
  return true;
}
