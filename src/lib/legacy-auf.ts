import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import { faceletsToPattern } from './cube-utils';

const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const AUF_MOVES = ['U', "U'", 'U2', ''] as const;

function arraysEqual(arr1: number[], arr2: number[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i += 1) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

export async function isSymmetricOLL(alg: string): Promise<boolean> {
  const pattern = await faceletsToPattern(SOLVED_STATE);

  const algWithStartU = Alg.fromString(`U ${alg}`);
  const algWithStartUp = Alg.fromString(`U' ${alg}`);
  const algWithStartU2 = Alg.fromString(`U2 ${alg}`);
  const algs = [algWithStartU, algWithStartUp, algWithStartU2];

  const scramble = pattern.applyAlg(Alg.fromString(alg).invert());
  for (const item of algs) {
    const candidate = scramble.applyAlg(item);
    const edgesOriented = arraysEqual(candidate.patternData.EDGES.orientation, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const cornersOriented = arraysEqual(candidate.patternData.CORNERS.orientation, [0, 0, 0, 0, 0, 0, 0, 0]);
    const centersOriented = arraysEqual(candidate.patternData.CENTERS.orientation, [0, 0, 0, 0, 0, 0]);
    if (edgesOriented && cornersOriented && centersOriented) {
      return true;
    }
  }

  return false;
}

async function solvedPattern(): Promise<KPattern> {
  return faceletsToPattern(SOLVED_STATE);
}

function randomAuf() {
  return AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)];
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
): Promise<PreparedTrainingAlgorithm> {
  let userAlg = [...inputMoves];
  const originalMoves = [...inputMoves];

  if (randomizeAUF && scrambleToMoves.length === 0) {
    const randomPreAUF = randomAuf();
    if (randomPreAUF.length > 0) {
      const kpattern = await solvedPattern();

      const algWithStartU = Alg.fromString(`U ${userAlg.join(' ')}`);
      const resultWithStartU = kpattern.applyAlg(algWithStartU);

      const algWithEndU = Alg.fromString(`${userAlg.join(' ')} U'`);
      const resultWithEndU = kpattern.applyAlg(algWithEndU);

      const algWithStartU2 = Alg.fromString(`U2 ${userAlg.join(' ')}`);
      const resultWithStartU2 = kpattern.applyAlg(algWithStartU2);

      const algWithEndU2 = Alg.fromString(`${userAlg.join(' ')} U2'`);
      const resultWithEndU2 = kpattern.applyAlg(algWithEndU2);

      const lowerCategory = category.toLowerCase();
      const isOLL = lowerCategory.includes('oll');
      const areNotIdentical =
        !resultWithStartU.isIdentical(resultWithEndU) &&
        !resultWithStartU2.isIdentical(resultWithEndU2);

      if (lowerCategory.includes('pll') || lowerCategory.includes('zbll')) {
        const randomPostAUF = randomAuf();
        if (randomPostAUF.length > 0) {
          userAlg.push(randomPostAUF);
        }
      }

      if ((areNotIdentical && !isOLL) || (isOLL && !(await isSymmetricOLL(userAlg.join(' '))))) {
        userAlg.unshift(randomPreAUF);
        userAlg = Alg.fromString(userAlg.join(' '))
          .experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 })
          .toString()
          .split(/\s+/);
      }
    }
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
