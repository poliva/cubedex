import { Alg } from 'cubing/alg';
import { KPattern } from 'cubing/kpuzzle';
import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
import min2phase from './min2phase/min2phase';
import { patternCubeSize, solverFacelets, solvedPattern } from './cube-utils';
import { expandNotation } from './storage';
import { shortest2x2Solution } from './solve2x2';

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
  return { identity, rotations, turns, key };
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
  if (patternCubeSize(state) === 2) {
    const solved = await solvedPattern(2);
    const inverse = Alg.fromString(expandNotation(alg)).invert();
    const anchor = state.patternData.CORNERS;
    // U/R/F turns leave DBL untouched. Choose the solved color orientation
    // BEFORE applying the inverse algorithm so that its DBL matches the device.
    // Rotating the case AFTER the inverse changes which faces the algorithm
    // must turn, even though the case still looks equivalent modulo rotations.
    for (const x of ['', 'x', 'x2', "x'", 'z', "z'"]) {
      for (const y of ['', 'y', 'y2', "y'"]) {
        const target = solved.applyAlg(`${x} ${y}`).applyAlg(inverse);
        const corners = target.patternData.CORNERS;
        if (corners.pieces[6] !== anchor.pieces[6] || corners.orientation[6] !== anchor.orientation[6]) continue;
        if (state.isIdentical(target)) return '';
        const from = state.experimentalToTransformation();
        const to = target.experimentalToTransformation();
        if (!from || !to) throw new Error('Invalid 2×2 setup pattern');
        const relative = solved.applyTransformation(from.invert().applyTransformation(to));
        const setup = await to2x2SensorMoves(new Alg(min2phase.solve(solverFacelets(relative))).invert());
        if (!state.applyAlg(setup).isIdentical(target)) {
          throw new Error('Could not calculate a 2×2 setup in the current turn frame');
        }
        return setup;
      }
    }
    throw new Error('Could not find a 2×2 setup orientation');
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

  return scramble
    .experimentalSimplify({
      cancel: true,
      puzzleLoader: cube3x3x3,
    })
    .toString()
    .trim();
}

/** Orient the picture so U/R/F corrections finish in the target's exact grip. */
export function align2x2RecoveryPattern(current: KPattern, target: KPattern): KPattern {
  const anchor = target.patternData.CORNERS;
  // U/R/F leave DBL untouched. Match that corner before the user grips the
  // pictured cube, so the correction never needs a final whole-cube rotation.
  for (const x of ['', 'x', 'x2', "x'", 'z', "z'"]) {
    for (const y of ['', 'y', 'y2', "y'"]) {
      const candidate = current.applyAlg(`${x} ${y}`);
      const corners = candidate.patternData.CORNERS;
      if (corners.pieces[6] === anchor.pieces[6] && corners.orientation[6] === anchor.orientation[6]) return candidate;
    }
  }
  throw new Error('Could not find a 2×2 recovery orientation');
}

/** U/R/F corrections applied directly to the exact state used by the picture. */
export async function get2x2RecoveryMoves(current: KPattern, target: KPattern): Promise<string[]> {
  if (fixOrientation(current).isIdentical(fixOrientation(target))) return [];
  // Callers can first align the picture to target for an exact finish. Keep
  // accepting other frames for state-based recovery and shortest-path queries.
  const alignedTarget = align2x2RecoveryPattern(target, current);
  const from = current.experimentalToTransformation();
  const to = alignedTarget.experimentalToTransformation();
  if (!from || !to) throw new Error('Invalid 2×2 recovery pattern');
  // Solving target^-1 * current produces current^-1 * target directly, without
  // taking the physical cube through solved or remapping a 3×3 solution.
  const relative = current.kpuzzle.defaultPattern().applyTransformation(to.invert().applyTransformation(from));
  const moves = await shortest2x2Solution(relative);
  const correction = moves.join(' ');
  if (!current.applyAlg(correction).isIdentical(alignedTarget)) {
    throw new Error('Could not calculate recovery. Refresh the picture and retry.');
  }
  return moves;
}
