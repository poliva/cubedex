import { categoryPuzzle, PUZZLES, type PuzzleId } from './puzzles';
import { Alg } from 'cubing/alg';

const AUF_MOVES = ['U', "U'", 'U2', ''] as const;

function randomAuf() {
  return AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)];
}

function aufAmount(move: string): number | null {
  const match = /^U(\d+)?(')?$/.exec(move);
  return match ? Number(match[1] ?? 1) * (match[2] ? -1 : 1) : null;
}

function combineBoundaryAUFs(moves: string[]) {
  const combine = (fromStart: boolean) => {
    let amount = 0;
    let count = 0;
    while (count < moves.length) {
      const value = aufAmount(moves[fromStart ? count : moves.length - 1 - count]);
      if (value === null) break;
      amount += value;
      count += 1;
    }
    if (count === 0) return;
    const auf = ['', 'U', 'U2', "U'"][((amount % 4) + 4) % 4];
    moves.splice(fromStart ? 0 : moves.length - count, count, ...(auf ? [auf] : []));
  };
  combine(true);
  combine(false);
}

export interface PreparedTrainingAlgorithm {
  displayAlgorithm: string;
  moves: string[];
  originalMoves: string[];
}

export async function prepareTrainingAlgorithm(
  inputMoves: string[],
  category: string,
  randomizeAUF: boolean,
  scrambleToMoves: string[] = [],
  puzzle: PuzzleId = categoryPuzzle(category),
): Promise<PreparedTrainingAlgorithm> {
  randomizeAUF = randomizeAUF && PUZZLES[puzzle].randomAUF;
  let userAlg = [...inputMoves];
  const originalMoves = [...inputMoves];

  if (randomizeAUF && scrambleToMoves.length === 0) {
    // Expand notation without rewriting authored turns into slice/wide moves.
    userAlg = Alg.fromString(userAlg.join(' ')).expand().toString().split(/\s+/).filter(Boolean);
    const randomPreAUF = randomAuf();
    const lowerCategory = category.toLowerCase();
    const randomPostAUF = lowerCategory.includes('pll') || lowerCategory.includes('zbll') ? randomAuf() : '';

    // Symmetry can make some angles look identical, but must not disable AUF.
    if (randomPreAUF.length > 0) {
      userAlg.unshift(randomPreAUF);
    }
    if (randomPostAUF.length > 0) {
      userAlg.push(randomPostAUF);
    }
    combineBoundaryAUFs(userAlg);
  }

  if (randomizeAUF && scrambleToMoves.length > 0) {
    userAlg = [...scrambleToMoves];
  }

  return {
    displayAlgorithm: userAlg.join(' '),
    moves: userAlg,
    originalMoves,
  };
}
