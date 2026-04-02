export function trailingWholeCubeRotationMoveCount(moves: string[]): number {
  let count = 0;
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const raw = moves[index].replace(/[()]/g, '').trim();
    if (!raw) {
      continue;
    }
    if (/^[xyz](?:2'|2|')?$/i.test(raw)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

export function getInverseMove(move: string): string {
  const inverseMoves: Record<string, string> = {
    U: "U'",
    "U'": 'U',
    D: "D'",
    "D'": 'D',
    L: "L'",
    "L'": 'L',
    R: "R'",
    "R'": 'R',
    F: "F'",
    "F'": 'F',
    B: "B'",
    "B'": 'B',
    u: "u'",
    "u'": 'u',
    d: "d'",
    "d'": 'd',
    l: "l'",
    "l'": 'l',
    r: "r'",
    "r'": 'r',
    f: "f'",
    "f'": 'f',
    b: "b'",
    "b'": 'b',
    M: "M'",
    "M'": 'M',
    E: "E'",
    "E'": 'E',
    S: "S'",
    "S'": 'S',
    x: "x'",
    "x'": 'x',
    y: "y'",
    "y'": 'y',
    z: "z'",
    "z'": 'z',
  };

  return inverseMoves[move] || move;
}

export function getOppositeMove(move: string): string {
  const oppositeMoves: Record<string, string> = {
    U: 'D',
    D: 'U',
    "U'": "D'",
    "D'": "U'",
    L: 'R',
    R: 'L',
    "L'": "R'",
    "R'": "L'",
    F: 'B',
    B: 'F',
    "F'": "B'",
    "B'": "F'",
  };

  return oppositeMoves[move] || move;
}

export function sanitizeMove(move: string): string {
  return move.replace(/[()]/g, '').trim();
}
