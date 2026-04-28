export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
export type FacePerm = Record<Face, Face>;

export const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];
export const IDENTITY: FacePerm = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' };

export function composePerm(a: FacePerm, b: FacePerm): FacePerm {
  const result = {} as FacePerm;
  for (const face of FACES) {
    result[face] = b[a[face]];
  }
  return result;
}

export function invertPerm(perm: FacePerm): FacePerm {
  const result = {} as FacePerm;
  for (const face of FACES) {
    result[perm[face]] = face;
  }
  return result;
}

const ROT_X: FacePerm = { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' };
const ROT_X2: FacePerm = composePerm(ROT_X, ROT_X);
const ROT_XI: FacePerm = invertPerm(ROT_X);
const ROT_Y: FacePerm = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' };
const ROT_Y2: FacePerm = composePerm(ROT_Y, ROT_Y);
const ROT_YI: FacePerm = invertPerm(ROT_Y);
const ROT_Z: FacePerm = { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' };
const ROT_Z2: FacePerm = composePerm(ROT_Z, ROT_Z);
const ROT_ZI: FacePerm = invertPerm(ROT_Z);

export const SLICE_ROTATION: Record<string, FacePerm> = {
  "M'": ROT_X,
  M: ROT_XI,
  M2: ROT_X2,
  S: ROT_ZI,
  "S'": ROT_Z,
  S2: ROT_Z2,
  E: ROT_YI,
  "E'": ROT_Y,
  E2: ROT_Y2,
  r: ROT_X,
  "r'": ROT_XI,
  r2: ROT_X2,
  l: ROT_XI,
  "l'": ROT_X,
  l2: ROT_X2,
  u: ROT_Y,
  "u'": ROT_YI,
  u2: ROT_Y2,
  d: ROT_YI,
  "d'": ROT_Y,
  d2: ROT_Y2,
  f: ROT_ZI,
  "f'": ROT_Z,
  f2: ROT_Z2,
  b: ROT_Z,
  "b'": ROT_ZI,
  b2: ROT_Z2,
  x: ROT_X,
  "x'": ROT_XI,
  x2: ROT_X2,
  y: ROT_Y,
  "y'": ROT_YI,
  y2: ROT_Y2,
  z: ROT_ZI,
  "z'": ROT_Z,
  z2: ROT_Z2,
};

const SLICE_PAIR_MAP: Record<string, string> = {
  "R' L": "M'",
  "L R'": "M'",
  "R L'": 'M',
  "L' R": 'M',
  'R2 L2': 'M2',
  'L2 R2': 'M2',
  "F' B": 'S',
  "B F'": 'S',
  "F B'": "S'",
  "B' F": "S'",
  'F2 B2': 'S2',
  'B2 F2': 'S2',
  "D' U": 'E',
  "U D'": 'E',
  "D U'": "E'",
  "U' D": "E'",
  'D2 U2': 'E2',
  'U2 D2': 'E2',
};

export function isSliceCandidate(move: string): boolean {
  if (!move) return false;
  return 'RLFBUD'.includes(move.charAt(0));
}

export function getSliceForPair(move1: string, move2: string): string | null {
  return SLICE_PAIR_MAP[`${move1} ${move2}`] || null;
}

export function updateSliceOrientation(current: FacePerm, sliceMove: string): FacePerm {
  const rotation = SLICE_ROTATION[sliceMove];
  return rotation ? composePerm(current, rotation) : current;
}

export function remapMoveForPlayer(move: string, sliceOrientation: FacePerm): string {
  const face = move.charAt(0) as Face;
  if (!FACES.includes(face)) {
    return move;
  }

  const inverse = invertPerm(sliceOrientation);
  const mappedFace = inverse[face];
  return mappedFace === face ? move : `${mappedFace}${move.slice(1)}`;
}
