import { Alg } from 'cubing/alg';
import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import min2phase from './min2phase/min2phase';
import { patternCubeSize, solverFacelets, solvedPattern } from './cube-utils';
import { expandNotation } from './storage';

min2phase.initFull();

export function fixOrientation(pattern: KPattern) {
  // A 2×2 has no centers. Anchor the DBL corner to compare training states
  // modulo whole-cube rotations, including rotations written into algorithms.
  const isOriented = patternCubeSize(pattern) === 2
    ? (candidate: KPattern) => candidate.patternData.CORNERS.pieces[6] === 6
      && candidate.patternData.CORNERS.orientation[6] === 0
    : (candidate: KPattern) => candidate.patternData.CENTERS.pieces.every((piece, i) => piece === i);
  if (isOriented(pattern)) {
    return pattern;
  }

  for (let xi = 0; xi < 4; xi += 1) {
    for (let yi = 0; yi < 4; yi += 1) {
      if (xi === 0 && yi === 0) {
        continue;
      }
      const alg = 'x '.repeat(xi).trim() + (xi && yi ? ' ' : '') + 'y '.repeat(yi).trim();
      const result = pattern.applyAlg(alg);
      if (isOriented(result)) {
        return result;
      }
    }
  }

  for (const zAlg of ['z', 'z z', 'z z z']) {
    for (let yi = 0; yi < 4; yi += 1) {
      const alg = zAlg + (yi ? ` ${'y '.repeat(yi).trim()}` : '');
      const result = pattern.applyAlg(alg);
      if (isOriented(result)) {
        return result;
      }
    }
  }

  console.warn('fixOrientation: no matching cube orientation; returning unrotated pattern');
  return pattern;
}

// Keep the sensor's exact color frame for rendering and Scramble To on a 2×2.
// Training comparisons use fixOrientation to ignore physical cube rotations.
function orientForSolver(pattern: KPattern): KPattern {
  return patternCubeSize(pattern) === 2 ? pattern : fixOrientation(pattern);
}

export function patternToPlayerAlg(pattern: KPattern): string {
  const oriented = orientForSolver(pattern);
  const solvedStr = min2phase.solve(solverFacelets(oriented)).trim();
  if (!solvedStr || solvedStr.startsWith('Error')) {
    return '';
  }

  return Alg.fromString(expandNotation(solvedStr).replace(/[()]/g, '')).invert().toString();
}

export async function getScrambleToSolution(alg: string, state: KPattern) {
  const faceCube = solverFacelets(orientForSolver(state));
  const solvedCube = min2phase.solve(faceCube);
  const inverseAlg = Alg.fromString(expandNotation(alg).replace(/[()]/g, '')).invert();
  const finalState = Alg.fromString(`${solvedCube} ${inverseAlg.toString()}`).experimentalSimplify({
    cancel: true,
    puzzleLoader: cube3x3x3,
  });

  const solved = await solvedPattern(patternCubeSize(state));
  const targetPattern = solved.applyAlg(finalState);
  const scramble = Alg.fromString(
    min2phase.solve(solverFacelets(orientForSolver(targetPattern))).toString(),
  ).invert();

  return scramble
    .experimentalSimplify({
      cancel: true,
      puzzleLoader: cube3x3x3,
    })
    .toString()
    .trim();
}
