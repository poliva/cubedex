import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
import { KPattern, KPatternData, KPuzzle } from 'cubing/kpuzzle';

export type CubeSize = 2 | 3;
export type CubePuzzle = '2x2x2' | '3x3x3';

export function patternCubeSize(pattern: KPattern): CubeSize {
  return pattern.patternData.EDGES ? 3 : 2;
}

export function solvedFacelets(size: CubeSize = 3): string {
  return [...'URFDLB'].map((face) => face.repeat(size * size)).join('');
}

let kpuzzle222Promise: Promise<KPuzzle> | null = null;
let kpuzzle333Promise: Promise<KPuzzle> | null = null;

function getKPuzzle333(): Promise<KPuzzle> {
  if (!kpuzzle333Promise) {
    kpuzzle333Promise = cube3x3x3.kpuzzle();
  }
  return kpuzzle333Promise;
}

const REID_EDGE_ORDER = 'UF UR UB UL DF DR DB DL FR FL BR BL'.split(' ');
const REID_CORNER_ORDER = 'UFR URB UBL ULF DRF DFL DLB DBR'.split(' ');
const REID_CENTER_ORDER = 'U L F R B D'.split(' ');

const REID_TO_FACELETS_MAP: [number, number, number][] = [
  [1, 2, 0],
  [0, 2, 0],
  [1, 1, 0],
  [0, 3, 0],
  [2, 0, 0],
  [0, 1, 0],
  [1, 3, 0],
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 2],
  [0, 1, 1],
  [1, 1, 1],
  [0, 8, 1],
  [2, 3, 0],
  [0, 10, 1],
  [1, 4, 1],
  [0, 5, 1],
  [1, 7, 2],
  [1, 3, 2],
  [0, 0, 1],
  [1, 0, 1],
  [0, 9, 0],
  [2, 2, 0],
  [0, 8, 0],
  [1, 5, 1],
  [0, 4, 1],
  [1, 4, 2],
  [1, 5, 0],
  [0, 4, 0],
  [1, 4, 0],
  [0, 7, 0],
  [2, 5, 0],
  [0, 5, 0],
  [1, 6, 0],
  [0, 6, 0],
  [1, 7, 0],
  [1, 2, 2],
  [0, 3, 1],
  [1, 3, 1],
  [0, 11, 1],
  [2, 1, 0],
  [0, 9, 1],
  [1, 6, 1],
  [0, 7, 1],
  [1, 5, 2],
  [1, 1, 2],
  [0, 2, 1],
  [1, 2, 1],
  [0, 10, 0],
  [2, 4, 0],
  [0, 11, 0],
  [1, 7, 1],
  [0, 6, 1],
  [1, 6, 2],
];

const CORNER_FACELETS_MAP = REID_TO_FACELETS_MAP.filter(([orbit]) => orbit === 1);

const CORNER_MAPPING = [
  [0, 21, 15],
  [5, 13, 47],
  [7, 45, 39],
  [2, 37, 23],
  [29, 10, 16],
  [31, 18, 32],
  [26, 34, 40],
  [24, 42, 8],
];

const EDGE_MAPPING = [
  [1, 22],
  [3, 14],
  [6, 46],
  [4, 38],
  [30, 17],
  [27, 9],
  [25, 41],
  [28, 33],
  [19, 12],
  [20, 35],
  [44, 11],
  [43, 36],
];

const FACE_ORDER = 'URFDLB';

interface PieceInfo {
  piece: number;
  orientation: number;
}

const PIECE_MAP: Record<string, PieceInfo> = {};

REID_EDGE_ORDER.forEach((edge, idx) => {
  for (let i = 0; i < 2; i += 1) {
    PIECE_MAP[rotateLeft(edge, i)] = { piece: idx, orientation: i };
  }
});

REID_CORNER_ORDER.forEach((corner, idx) => {
  for (let i = 0; i < 3; i += 1) {
    PIECE_MAP[rotateLeft(corner, i)] = { piece: idx, orientation: i };
  }
});

function rotateLeft(s: string, i: number): string {
  return s.slice(i) + s.slice(0, i);
}

function toReid333Struct(pattern: KPattern): string[][] {
  const output: string[][] = [[], []];
  for (let i = 0; i < 6; i += 1) {
    if (pattern.patternData.CENTERS.pieces[i] !== i) {
      throw new Error('non-oriented puzzles are not supported');
    }
  }
  for (let i = 0; i < 12; i += 1) {
    output[0].push(
      rotateLeft(
        REID_EDGE_ORDER[pattern.patternData.EDGES.pieces[i]],
        pattern.patternData.EDGES.orientation[i],
      ),
    );
  }
  for (let i = 0; i < 8; i += 1) {
    output[1].push(
      rotateLeft(
        REID_CORNER_ORDER[pattern.patternData.CORNERS.pieces[i]],
        pattern.patternData.CORNERS.orientation[i],
      ),
    );
  }
  output.push(REID_CENTER_ORDER);
  return output;
}

export function patternToFacelets(pattern: KPattern): string {
  if (patternCubeSize(pattern) === 2) {
    const corners = pattern.patternData.CORNERS;
    const reid = corners.pieces.map((piece, i) =>
      rotateLeft(REID_CORNER_ORDER[piece], corners.orientation[i]));
    return CORNER_FACELETS_MAP
      .map(([, perm, ori]) => reid[perm][ori]).join('');
  }
  const reid = toReid333Struct(pattern);
  return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => reid[orbit][perm][ori]).join('');
}

export async function faceletsToPattern(facelets: string): Promise<KPattern> {
  const size = facelets.length === 24 ? 2 : 3;
  if (![24, 54].includes(facelets.length) || /[^URFDLB]/.test(facelets)
    || [...FACE_ORDER].some((face) => [...facelets].filter((s) => s === face).length !== size * size)) {
    throw new Error('Invalid cube facelets');
  }
  if (size === 2) {
    const colors = Array.from({ length: 8 }, () => Array<string>(3));
    CORNER_FACELETS_MAP.forEach(([, position, orientation], i) => {
      colors[position][orientation] = facelets[i];
    });
    const corners = colors.map((corner) => PIECE_MAP[corner.join('')]);
    if (corners.some((corner) => !corner) || new Set(corners.map((c) => c.piece)).size !== 8
      || corners.reduce((sum, c) => sum + c.orientation, 0) % 3 !== 0) {
      throw new Error('Invalid 2×2 corner state');
    }
    kpuzzle222Promise ??= cube2x2x2.kpuzzle();
    return new KPattern(await kpuzzle222Promise, {
      CORNERS: {
        pieces: corners.map((c) => c.piece),
        orientation: corners.map((c) => c.orientation),
      },
    });
  }
  const stickers: number[] = [];
  facelets.match(/.{9}/g)?.forEach((face) => {
    face.split('').reverse().forEach((s, i) => {
      if (i !== 4) {
        stickers.push(FACE_ORDER.indexOf(s));
      }
    });
  });

  const patternData: KPatternData = {
    CORNERS: {
      pieces: [],
      orientation: [],
    },
    EDGES: {
      pieces: [],
      orientation: [],
    },
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  };

  for (const cm of CORNER_MAPPING) {
    const pi = PIECE_MAP[cm.map((i) => FACE_ORDER[stickers[i]]).join('')];
    patternData.CORNERS.pieces.push(pi.piece);
    patternData.CORNERS.orientation.push(pi.orientation);
  }

  for (const em of EDGE_MAPPING) {
    const pi = PIECE_MAP[em.map((i) => FACE_ORDER[stickers[i]]).join('')];
    patternData.EDGES.pieces.push(pi.piece);
    patternData.EDGES.orientation.push(pi.orientation);
  }

  return new KPattern(await getKPuzzle333(), patternData);
}

export async function solvedPattern(size: CubeSize = 3): Promise<KPattern> {
  return faceletsToPattern(solvedFacelets(size));
}

/** Give the 3×3 solver legal placeholder edges for a corners-only 2×2 state. */
export function solverFacelets(pattern: KPattern): string {
  if (patternCubeSize(pattern) === 3) return patternToFacelets(pattern);
  const corners = pattern.patternData.CORNERS;
  let parity = 0;
  for (let i = 0; i < 8; i += 1) {
    for (let j = i + 1; j < 8; j += 1) {
      if (corners.pieces[i] > corners.pieces[j]) parity ^= 1;
    }
  }
  const edges = [...REID_EDGE_ORDER];
  // A 2×2 permits odd corner permutations. Match that parity with an edge swap.
  if (parity) [edges[0], edges[1]] = [edges[1], edges[0]];
  const reid = [edges, corners.pieces.map((piece, i) =>
    rotateLeft(REID_CORNER_ORDER[piece], corners.orientation[i])), REID_CENTER_ORDER];
  return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => reid[orbit][perm][ori]).join('');
}
