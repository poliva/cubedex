import type { KPattern } from 'cubing/kpuzzle';
import { cube2x2x2 } from 'cubing/puzzles';

// U/R/F leave DBL fixed: 7! permutations and 3^6 corner orientations.
const POSITIONS = [0, 1, 2, 3, 4, 5, 7];
const PERMUTATIONS = 5040;
const ORIENTATIONS = 729;
const MOVES = ['U', "U'", 'R', "R'", 'F', "F'"];
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040];

function rankPermutation(pieces: number[]): number {
  let rank = 0;
  for (let i = 0; i < 6; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 7; j++) if (pieces[j] < pieces[i]) smaller++;
    rank += smaller * FACTORIAL[6 - i];
  }
  return rank;
}

function rankOrientation(orientation: number[]): number {
  let rank = 0;
  for (let i = 0; i < 6; i++) rank = rank * 3 + orientation[i];
  return rank;
}

async function buildTables() {
  const kpuzzle = await cube2x2x2.kpuzzle();
  const turns = MOVES.map(move => {
    const corners = kpuzzle.moveToTransformation(move).transformationData.CORNERS;
    return {
      permutation: POSITIONS.map(position => POSITIONS.indexOf(corners.permutation[position])),
      orientation: POSITIONS.map(position => corners.orientationDelta[position]),
    };
  });
  const permutations = new Uint16Array(PERMUTATIONS * MOVES.length);
  const orientations = new Uint16Array(ORIENTATIONS * MOVES.length);
  for (let rank = 0; rank < PERMUTATIONS; rank++) {
    const available = [0, 1, 2, 3, 4, 5, 6];
    let remaining = rank;
    const pieces = POSITIONS.map((_, i) => {
      const index = Math.floor(remaining / FACTORIAL[6 - i]);
      remaining %= FACTORIAL[6 - i];
      return available.splice(index, 1)[0];
    });
    turns.forEach((turn, move) => {
      permutations[rank * MOVES.length + move] = rankPermutation(turn.permutation.map(i => pieces[i]));
    });
  }
  for (let rank = 0; rank < ORIENTATIONS; rank++) {
    const orientation = Array<number>(7).fill(0);
    let remaining = rank;
    let sum = 0;
    for (let i = 5; i >= 0; i--) {
      orientation[i] = remaining % 3;
      sum += orientation[i];
      remaining = Math.floor(remaining / 3);
    }
    orientation[6] = (3 - sum % 3) % 3;
    turns.forEach((turn, move) => {
      orientations[rank * MOVES.length + move] = rankOrientation(
        turn.permutation.map((i, position) => (orientation[i] + turn.orientation[position]) % 3),
      );
    });
  }
  return (state: number, move: number) =>
    permutations[Math.floor(state / ORIENTATIONS) * MOVES.length + move] * ORIENTATIONS
    + orientations[(state % ORIENTATIONS) * MOVES.length + move];
}

let tables: ReturnType<typeof buildTables> | null = null;

/** Shortest U/R/F solution in quarter turns, for a pattern whose DBL is solved. */
export async function shortest2x2Solution(pattern: KPattern): Promise<string[]> {
  const corners = pattern.patternData.CORNERS;
  if (corners.pieces[6] !== 6 || corners.orientation[6] !== 0) {
    throw new Error('2×2 recovery must preserve the DBL corner');
  }
  const start = rankPermutation(POSITIONS.map(position => corners.pieces[position])) * ORIENTATIONS
    + rankOrientation(POSITIONS.map(position => corners.orientation[position]));
  if (start === 0) return [];
  const nextState = await (tables ??= buildTables());
  // Bidirectional breadth-first search visits only the neighborhoods needed for
  // this correction. Store the incoming move; its inverse recovers the parent.
  const fromStart = new Uint8Array(PERMUTATIONS * ORIENTATIONS);
  const fromSolved = new Uint8Array(PERMUTATIONS * ORIENTATIONS);
  fromStart[start] = 255;
  fromSolved[0] = 255;
  let startFrontier = [start];
  let solvedFrontier = [0];
  let lastYield = performance.now();

  function trace(state: number, visited: Uint8Array): number[] {
    const path: number[] = [];
    while (visited[state] !== 255) {
      const move = visited[state] - 1;
      path.push(move);
      state = nextState(state, move ^ 1);
    }
    return path;
  }

  while (startFrontier.length && solvedFrontier.length) {
    const forward = startFrontier.length <= solvedFrontier.length;
    const frontier = forward ? startFrontier : solvedFrontier;
    const visited = forward ? fromStart : fromSolved;
    const other = forward ? fromSolved : fromStart;
    const next: number[] = [];
    for (const state of frontier) {
      for (let move = 0; move < MOVES.length; move++) {
        const neighbor = nextState(state, move);
        if (visited[neighbor]) continue;
        visited[neighbor] = move + 1;
        if (other[neighbor]) {
          return [
            ...trace(neighbor, fromStart).reverse(),
            ...trace(neighbor, fromSolved).map(turn => turn ^ 1),
          ].map(turn => MOVES[turn]);
        }
        next.push(neighbor);
      }
      // Let the recovery panel render and remain responsive on slower devices.
      if (performance.now() - lastYield > 12) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
    }
    if (forward) startFrontier = next;
    else solvedFrontier = next;
  }
  throw new Error('Could not find a 2×2 recovery path');
}
