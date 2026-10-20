import { PUZZLES, type PuzzleId } from '../lib/puzzles';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import type { CaseCardData } from '../lib/case-cards';
import { solvedPattern } from '../lib/cube-utils';
import { align2x2RecoveryPattern, fixOrientation, get2x2RecoveryMoves, getScrambleToSolution } from '../lib/scramble';
import { prepareTrainingAlgorithm } from '../lib/auf';
import { countMovesETM } from '../lib/charts';
import { expandNotation } from '../lib/storage';

/** First half of a planned face double (e.g. B of B2); excludes wide/slice tokens like Rw2. */
function isFirstQuarterOfPlannedDouble(plannedFirst: string, move: string): boolean {
  if (plannedFirst.length < 2 || plannedFirst.charAt(1) !== '2') {
    return false;
  }
  if (move === plannedFirst) {
    return false;
  }
  if (move.charAt(0) !== plannedFirst.charAt(0)) {
    return false;
  }
  // Still executing the double as two quarter-turns (ETM); exclude another double token.
  return !move.includes('2');
}

const simplify3x3 = (s: string) =>
  Alg.fromString(s).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 });

/**
 * Planned first token is a quarter (no "2"); user played its inverse. Remaining
 * display is (first)² then the original tail — e.g. D then D' → show D2 + tail.
 */
function scrambleAfterInverseOfPlannedFirst(
  plannedFirst: string,
  move: string,
  restTokens: string[],
): string | null {
  if (!plannedFirst || move === plannedFirst || plannedFirst.includes('2')) {
    return null;
  }
  if (simplify3x3(`${plannedFirst} ${move}`).toString().trim() !== '') {
    return null;
  }
  const doubled = simplify3x3(`${plannedFirst} ${plannedFirst}`)
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (!doubled) {
    return null;
  }
  return [doubled, ...restTokens].join(' ').trim();
}

export interface ScrambleState {
  scrambleMode: boolean;
  scrambleText: string;
  isComputing: boolean;
  targetAlgorithm: string;
  setupTarget: KPattern | null;
  helpTone: 'hidden' | 'green';
  startScrambleTo: (
    algorithm: string,
    currentCase: CaseCardData | null,
    currentPattern?: KPattern | null,
    randomizeAUF?: boolean,
    casePreview?: KPattern | null,
  ) => Promise<boolean>;
  advanceScramble: (move: string, currentPattern: KPattern | null) => Promise<boolean>;
  clearScramble: () => void;
}

export function useScrambleState(puzzle: PuzzleId = '3x3x3'): ScrambleState {
  const generationRef = useRef(0);
  const [scrambleMode, setScrambleMode] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [isComputing, setIsComputing] = useState(false);
  const [targetAlgorithm, setTargetAlgorithm] = useState('');
  const [setupTarget, setSetupTarget] = useState<KPattern | null>(null);
  const [helpTone, setHelpTone] = useState<'hidden' | 'green'>('hidden');

  const startScrambleTo = useCallback(async (
    algorithm: string,
    currentCase: CaseCardData | null,
    currentPattern?: KPattern | null,
    randomizeAUF = false,
    casePreview?: KPattern | null,
  ) => {
    const generation = ++generationRef.current;
    if (!PUZZLES[puzzle].available || !algorithm.trim()) {
      setIsComputing(false);
      setScrambleMode(false);
      setScrambleText('');
      setTargetAlgorithm('');
      setSetupTarget(null);
      setHelpTone('hidden');
      return false;
    }

    setIsComputing(true);
    try {
      let aufModifiedAlgorithm = algorithm;
      if (randomizeAUF && currentCase?.category) {
        const prepared = await prepareTrainingAlgorithm(
          algorithm.split(/\s+/).filter(Boolean),
          currentCase.category,
          true,
          [],
          puzzle,
        );
        aufModifiedAlgorithm = prepared.displayAlgorithm;
      }

      let physicalTarget: KPattern | null = null;
      let scramble: string;
      if (puzzle === '2x2x2' && currentPattern) {
        const solved = await solvedPattern(2);
        const originalAlg = new Alg(expandNotation(algorithm, puzzle));
        const previewEnd = casePreview?.applyAlg(originalAlg);
        // Retain the preview's colors in the algorithm's grip. A progressed
        // preview is not a setup; use the initial case for that algorithm.
        const colorFrame = previewEnd && fixOrientation(previewEnd).isIdentical(solved) ? previewEnd : solved;
        physicalTarget = colorFrame.applyAlg(new Alg(expandNotation(aufModifiedAlgorithm, puzzle)).invert());
        const reference = align2x2RecoveryPattern(currentPattern, physicalTarget);
        scramble = (await get2x2RecoveryMoves(reference, physicalTarget)).join(' ');
      } else {
        // Puzzles without live state tracking use a setup from solved.
        scramble = PUZZLES[puzzle].smartcube
          ? await getScrambleToSolution(
            aufModifiedAlgorithm,
            currentPattern ?? await solvedPattern(puzzle === '2x2x2' ? 2 : 3),
          )
          // Show individual setup moves, including inverses of groups and repetitions.
          : Alg.fromString(expandNotation(aufModifiedAlgorithm, puzzle)).invert().expand().toString().trim();
      }

      if (generation !== generationRef.current) return false;
      // Connected 2×2 setups establish a visible grip even if no layer turns
      // are needed. The same exact target is kept through rotated snapshots.
      if (scramble.length > 0 || physicalTarget) {
        setScrambleMode(true);
        setScrambleText(scramble);
        setTargetAlgorithm(aufModifiedAlgorithm);
        setSetupTarget(physicalTarget);
        setHelpTone('hidden');
        return true;
      } else {
        setScrambleMode(false);
        setScrambleText('');
        setTargetAlgorithm('');
        setSetupTarget(null);
        setHelpTone('hidden');
        return false;
      }
    } finally {
      if (generation === generationRef.current) setIsComputing(false);
    }
  }, [puzzle]);

  const advanceScramble = useCallback(async (move: string, currentPattern: KPattern | null) => {
    if (!PUZZLES[puzzle].smartcube || !scrambleMode || (!scrambleText.trim() && !setupTarget) || !currentPattern || !targetAlgorithm.trim()) {
      return false;
    }

    const generation = generationRef.current;
    if (setupTarget) {
      const picture = align2x2RecoveryPattern(currentPattern, setupTarget);
      const remaining = await get2x2RecoveryMoves(picture, setupTarget);
      if (generation !== generationRef.current) return false;
      const nextScramble = remaining.join(' ');
      const completed = remaining.length === 0;
      setScrambleText(nextScramble);
      setHelpTone(countMovesETM(nextScramble) > countMovesETM(scrambleText) ? 'green' : 'hidden');
      if (completed) {
        setScrambleMode(false);
        setTargetAlgorithm('');
        setSetupTarget(null);
        setHelpTone('hidden');
      }
      return completed;
    }
    const rawNextScramble = await getScrambleToSolution(targetAlgorithm, currentPattern);
    if (generation !== generationRef.current) return false;
    let nextScramble = rawNextScramble;
    const currentScrambleMoves = scrambleText.split(' ').filter(Boolean);
    const recomputedMoves = nextScramble.split(' ').filter(Boolean);
    const firstCurrentScrambleMove = currentScrambleMoves[0] ?? '';
    const isDoubleTurn = firstCurrentScrambleMove.endsWith('2');

    if (recomputedMoves.length >= currentScrambleMoves.length && recomputedMoves.length > 2) {
      if (move === firstCurrentScrambleMove || (move.charAt(0) === firstCurrentScrambleMove.charAt(0) && isDoubleTurn)) {
        nextScramble = currentScrambleMoves.slice(1).join(' ');
        if (isDoubleTurn && !move.includes('2')) {
          nextScramble = `${move} ${nextScramble}`.trim();
        }
      }
    }

    if (recomputedMoves.length === currentScrambleMoves.length - 1 && recomputedMoves.length > 2 && move === firstCurrentScrambleMove) {
      nextScramble = currentScrambleMoves.slice(1).join(' ');
    }

    // When the first token is X2 and the user plays one quarter (e.g. B of B2), the solver
    // often returns a different *shorter* sequence than "same tail after X2". Trust the
    // displayed scramble's tail in that case (but not for a lone X2 token — see tests).
    if (
      isFirstQuarterOfPlannedDouble(firstCurrentScrambleMove, move) &&
      (currentScrambleMoves.length > 1 || recomputedMoves.length < currentScrambleMoves.length)
    ) {
      nextScramble = `${move} ${currentScrambleMoves.slice(1).join(' ')}`.trim();
    }

    const inverseFirst = scrambleAfterInverseOfPlannedFirst(
      firstCurrentScrambleMove,
      move,
      currentScrambleMoves.slice(1),
    );
    if (inverseFirst) {
      nextScramble = inverseFirst;
    }

    // Use ETM counts to compare actual face-turn metrics, not token counts.
    const currentETM = countMovesETM(scrambleText);
    let recomputedETM = countMovesETM(nextScramble);

    setHelpTone(recomputedETM > currentETM ? 'green' : 'hidden');

    const completed = nextScramble.trim().length === 0;
    setScrambleText(nextScramble.trim());
    if (completed) {
      setScrambleMode(false);
      setTargetAlgorithm('');
      setHelpTone('hidden');
    }
    return completed;
  }, [puzzle, scrambleMode, scrambleText, targetAlgorithm, setupTarget]);

  const clearScramble = useCallback(() => {
    generationRef.current += 1;
    setIsComputing(false);
    setScrambleMode(false);
    setScrambleText('');
    setTargetAlgorithm('');
    setSetupTarget(null);
    setHelpTone('hidden');
  }, []);

  return useMemo(() => ({
    scrambleMode,
    scrambleText,
    isComputing,
    targetAlgorithm,
    setupTarget,
    helpTone,
    startScrambleTo,
    advanceScramble,
    clearScramble,
  }), [
    advanceScramble,
    clearScramble,
    helpTone,
    isComputing,
    scrambleMode,
    scrambleText,
    startScrambleTo,
    targetAlgorithm,
    setupTarget,
  ]);
}
