import { Alg } from 'cubing/alg';
import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import min2phase from './min2phase/min2phase';
import { faceletsToPattern, patternToFacelets } from './cube-utils';
import { expandNotation } from './storage';

const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

min2phase.initFull();

export function fixOrientation(pattern: KPattern) {
  const solvedCenters = JSON.stringify([0, 1, 2, 3, 4, 5]);
  if (JSON.stringify(pattern.patternData.CENTERS.pieces) === solvedCenters) {
    return pattern;
  }

  for (let xi = 0; xi < 4; xi += 1) {
    for (let yi = 0; yi < 4; yi += 1) {
      if (xi === 0 && yi === 0) {
        continue;
      }
      const alg = 'x '.repeat(xi).trim() + (xi && yi ? ' ' : '') + 'y '.repeat(yi).trim();
      const result = pattern.applyAlg(alg);
      if (JSON.stringify(result.patternData.CENTERS.pieces) === solvedCenters) {
        return result;
      }
    }
  }

  for (const zAlg of ['z', 'z z', 'z z z']) {
    for (let yi = 0; yi < 4; yi += 1) {
      const alg = zAlg + (yi ? ` ${'y '.repeat(yi).trim()}` : '');
      const result = pattern.applyAlg(alg);
      if (JSON.stringify(result.patternData.CENTERS.pieces) === solvedCenters) {
        return result;
      }
    }
  }

  return pattern;
}

export function patternToPlayerAlg(pattern: KPattern): string {
  const oriented = fixOrientation(pattern);
  const solvedStr = min2phase.solve(patternToFacelets(oriented)).trim();
  if (!solvedStr || solvedStr.startsWith('Error')) {
    return '';
  }

  return Alg.fromString(expandNotation(solvedStr).replace(/[()]/g, '')).invert().toString();
}

export async function getScrambleToSolution(alg: string, state: KPattern) {
  const faceCube = patternToFacelets(fixOrientation(state));
  const solvedCube = min2phase.solve(faceCube);
  const inverseAlg = Alg.fromString(expandNotation(alg).replace(/[()]/g, '')).invert();
  const finalState = Alg.fromString(`${solvedCube} ${inverseAlg.toString()}`).experimentalSimplify({
    cancel: true,
    puzzleLoader: cube3x3x3,
  });

  const solvedPattern = await faceletsToPattern(SOLVED_STATE);
  const targetPattern = solvedPattern.applyAlg(finalState);
  const scramble = Alg.fromString(
    min2phase.solve(patternToFacelets(fixOrientation(targetPattern))).toString(),
  ).invert();

  return scramble
    .experimentalSimplify({
      cancel: true,
      puzzleLoader: cube3x3x3,
    })
    .toString()
    .trim();
}
