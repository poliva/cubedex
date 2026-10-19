import { Alg } from 'cubing/alg';
import { KPattern } from 'cubing/kpuzzle';
import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
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

let sensorFramePromise: ReturnType<typeof build2x2SensorFrame> | null = null;

async function build2x2SensorFrame() {
  const kpuzzle = await cube2x2x2.kpuzzle();
  const key = (transformation: ReturnType<typeof kpuzzle.algToTransformation>) =>
    JSON.stringify(transformation.transformationData);
  const identity = kpuzzle.identityTransformation();
  const rotations = [identity];
  const seen = new Set([key(identity)]);
  for (const rotation of rotations) {
    for (const axis of ['x', 'y', 'z']) {
      const next = rotation.applyMove(axis);
      if (!seen.has(key(next))) {
        seen.add(key(next));
        rotations.push(next);
      }
    }
  }
  // A turn on any face equals a U/R/F turn followed by a cube rotation on 2×2.
  const turns = new Map<string, { move: string; rotation: typeof identity }>();
  for (const face of ['U', 'R', 'F']) {
    for (const suffix of ['', "'", '2']) {
      const move = `${face}${suffix}`;
      for (const rotation of rotations) {
        turns.set(key(kpuzzle.moveToTransformation(move).applyTransformation(rotation)), { move, rotation });
      }
    }
  }
  return { identity, turns, key };
}

/** Rewrite six-face turns in the sensor's U/R/F frame, carrying rotations forward. */
async function to2x2SensorMoves(alg: Alg): Promise<string> {
  const { identity, turns, key } = await (sensorFramePromise ??= build2x2SensorFrame());
  let frame = identity;
  const moves: string[] = [];
  for (const move of alg.experimentalExpand()) {
    // The cube solver emits only face moves.
    const turn = turns.get(key(frame.applyMove(move.toString())));
    if (!turn) throw new Error(`Cannot express 2×2 setup move ${move} in the sensor frame`);
    moves.push(turn.move);
    frame = turn.rotation;
  }
  return Alg.fromString(moves.join(' '))
    .experimentalSimplify({
      cancel: true,
      puzzleSpecificSimplifyOptions: { quantumMoveOrder: () => 4 },
    })
    .toString().trim();
}

export async function getScrambleToSolution(alg: string, state: KPattern) {
  const is2x2 = patternCubeSize(state) === 2;
  // Sensor setups may finish in a different whole-cube orientation.
  if (is2x2) {
    const target = (await solvedPattern(2)).applyAlg(Alg.fromString(expandNotation(alg)).invert());
    if (fixOrientation(state).isIdentical(fixOrientation(target))) return '';
  }
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

  if (is2x2) return to2x2SensorMoves(scramble);

  return scramble
    .experimentalSimplify({
      cancel: true,
      puzzleLoader: cube3x3x3,
    })
    .toString()
    .trim();
}
