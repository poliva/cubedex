import type { KPattern } from 'cubing/kpuzzle';
import { patternCubeSize } from './cube-utils';
import { categoryName } from './puzzles';
import { fixOrientation } from './scramble';
import { getStickeringForCategory } from './stickering';

type CaseGoal = 'F2L' | 'OLL' | 'EOLL' | 'COLL' | 'CMLL' | 'L6EO' | 'EOLR';

function caseGoal(category: string, subset: string, size: 2 | 3): CaseGoal | null {
  const name = categoryName(category);
  const stickering = getStickeringForCategory(name, false, size === 2 ? '2x2x2' : '3x3x3');
  if (size === 2) return stickering === 'OLL' ? 'OLL' : null;
  if (/\b(?:L6E|LSE)[\s-]*EOLR\b/i.test(name)) return 'EOLR';
  if (/\b(?:L6E|LSE)[\s-]*EO\b/i.test(name) || stickering === 'L6EO') return 'L6EO';
  if (stickering === 'CMLL') return 'CMLL';
  if (stickering === 'COLL' || /\bOLLCP\b/i.test(name)) return 'COLL';
  if (stickering === 'PLL' && /2[\s-]*look/i.test(name) && /^corners$/i.test(subset)) return 'COLL';
  if (stickering === 'WVLS') return 'OLL';
  if (stickering === 'ZBLS' || /\bVHLS\b/i.test(name)) return 'EOLL';
  if (stickering === 'F2L') return 'F2L';
  if (stickering === 'OLL') {
    // The first look only orients edges; corner orientation is a later case.
    if (/2[\s-]*look/i.test(name) && /^edges$/i.test(subset)) return 'EOLL';
    return 'OLL';
  }
  return null;
}

function piecesSolved(orbit: KPattern['patternData'][string], positions: readonly number[]) {
  return positions.every(i => orbit.pieces[i] === i && orbit.orientation[i] === 0);
}

const top = [0, 1, 2, 3];
const bottomCorners = [4, 5, 6, 7];
// Reid edge order: DR, DL, FR, FL, BR, BL form the two Roux blocks.
const blockEdges = [5, 7, 8, 9, 10, 11];
const lastSixEdges = [0, 1, 2, 3, 4, 6];
const aufs = ['', 'U', 'U2', "U'"];

function cornersSolvedWithAUF(pattern: KPattern) {
  return aufs.some(auf => piecesSolved(pattern.applyAlg(auf).patternData.CORNERS, top));
}

function rouxGoalReached(pattern: KPattern, goal: 'CMLL' | 'L6EO' | 'EOLR') {
  // Center normalization also rotates the blocks after M turns. Restore the
  // block frame independently of the M-slice centers before checking Roux EO.
  return ['', 'x', 'x2', "x'"].some(rotation => {
    const candidate = pattern.applyAlg(rotation);
    const { CORNERS: corners, EDGES: edges } = candidate.patternData;
    if (!piecesSolved(corners, bottomCorners) || !piecesSolved(edges, blockEdges)
      || !cornersSolvedWithAUF(candidate)) return false;
    if (goal === 'CMLL') return true;
    if (!lastSixEdges.every(i => edges.orientation[i] === 0)) return false;
    if (goal === 'L6EO') return true;
    // EOLR can finish with UL/UR at DF/DB, ready for their M2 insertion,
    // or with them already solved relative to the top corners after AUF.
    const readyToInsert = [4, 6].every(i => edges.pieces[i] === 1 || edges.pieces[i] === 3);
    return readyToInsert || aufs.some(auf => {
      const aligned = candidate.applyAlg(auf).patternData;
      return piecesSolved(aligned.CORNERS, top) && piecesSolved(aligned.EDGES, [1, 3]);
    });
  });
}

/** Extra endpoints accepted by a partial-stage case, independent of physical stickers. */
export function createCaseGoalMatcher(
  endpoint: KPattern, category: string, subset = '',
): ((current: KPattern) => boolean) | null {
  const size = patternCubeSize(endpoint);
  const goal = caseGoal(category, subset, size);
  if (!goal) return null;
  const inverseEndpoint = endpoint.experimentalToTransformation()?.invert();
  if (!inverseEndpoint) return null;
  const solved = endpoint.kpuzzle.defaultPattern();

  return current => {
    const transformation = current.experimentalToTransformation();
    if (!transformation) return false;
    // endpoint = physicalStart * displayedAlgorithm. Replacing its stickers
    // with solved stickers projects progress onto the virtual case, even when
    // the physical cube was never scrambled to that case. Normalize AFTER
    // projection so whole-cube rotations retain the case's U/D frame.
    const pattern = fixOrientation(solved.applyTransformation(inverseEndpoint.applyTransformation(transformation)));
    const { CORNERS: corners, EDGES: edges } = pattern.patternData;
    if (size === 2) {
      // Ortega OLL keeps the bottom face solved, but may permute its corners.
      return corners.pieces.every((piece, i) => (piece < 4) === (i < 4) && corners.orientation[i] === 0);
    }
    if (goal === 'CMLL' || goal === 'L6EO' || goal === 'EOLR') return rouxGoalReached(pattern, goal);
    // Reid order: U-layer corners/edges are 0..3. All remaining pieces
    // belong to the cross and F2L slots and must stay solved.
    const f2lSolved = [corners, edges].every(orbit => orbit.pieces.every((piece, i) =>
      i < 4 || (piece === i && orbit.orientation[i] === 0)));
    if (!f2lSolved) return false;
    if (goal === 'F2L') return true;
    const edgesOriented = edges.orientation.slice(0, 4).every(orientation => orientation === 0);
    if (!edgesOriented) return false;
    if (goal === 'COLL') return cornersSolvedWithAUF(pattern);
    return goal === 'EOLL' || corners.orientation.slice(0, 4).every(orientation => orientation === 0);
  };
}
