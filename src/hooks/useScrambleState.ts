import { useCallback, useMemo, useState } from 'react';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import type { CaseCardData } from '../lib/case-cards';
import { solvedPattern } from '../lib/cube-utils';
import { getScrambleToSolution } from '../lib/scramble';
import { prepareTrainingAlgorithm } from '../lib/auf';
import { countMovesETM } from '../lib/charts';

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
  helpTone: 'hidden' | 'green';
  startScrambleTo: (
    algorithm: string,
    currentCase: CaseCardData | null,
    currentPattern?: KPattern | null,
    randomizeAUF?: boolean,
  ) => Promise<boolean>;
  advanceScramble: (move: string, currentPattern: KPattern | null) => Promise<boolean>;
  clearScramble: () => void;
}

export function useScrambleState(): ScrambleState {
  const [scrambleMode, setScrambleMode] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [isComputing, setIsComputing] = useState(false);
  const [targetAlgorithm, setTargetAlgorithm] = useState('');
  const [helpTone, setHelpTone] = useState<'hidden' | 'green'>('hidden');

  const startScrambleTo = useCallback(async (
    algorithm: string,
    currentCase: CaseCardData | null,
    currentPattern?: KPattern | null,
    randomizeAUF = false,
  ) => {
    if (!algorithm.trim()) {
      setScrambleMode(false);
      setScrambleText('');
      setTargetAlgorithm('');
      setHelpTone('hidden');
      return false;
    }

    setIsComputing(true);
    try {
      const pattern = currentPattern ?? await solvedPattern();

      let aufModifiedAlgorithm = algorithm;
      if (randomizeAUF && currentCase?.category) {
        const prepared = await prepareTrainingAlgorithm(
          algorithm.split(/\s+/).filter(Boolean),
          currentCase.category,
          true,
        );
        aufModifiedAlgorithm = prepared.displayAlgorithm;
      }

      const scramble = await getScrambleToSolution(aufModifiedAlgorithm, pattern);

      if (scramble.length > 0) {
        setScrambleMode(true);
        setScrambleText(scramble);
        setTargetAlgorithm(aufModifiedAlgorithm);
        setHelpTone('hidden');
        return true;
      } else {
        setScrambleMode(false);
        setScrambleText('');
        setTargetAlgorithm('');
        setHelpTone('hidden');
        return false;
      }
    } finally {
      setIsComputing(false);
    }
  }, []);

  const advanceScramble = useCallback(async (move: string, currentPattern: KPattern | null) => {
    if (!scrambleMode || !scrambleText.trim() || !currentPattern || !targetAlgorithm.trim()) {
      return false;
    }

    const rawNextScramble = await getScrambleToSolution(targetAlgorithm, currentPattern);
    let nextScramble = rawNextScramble;
    const currentScrambleMoves = scrambleText.split(' ').filter(Boolean);
    const recomputedMoves = nextScramble.split(' ').filter(Boolean);
    const firstCurrentScrambleMove = currentScrambleMoves[0] ?? '';
    const isDoubleTurn = firstCurrentScrambleMove.endsWith('2');

    if (recomputedMoves.length >= currentScrambleMoves.length && recomputedMoves.length > 2) {
      if (move === firstCurrentScrambleMove || (move.charAt(0) === firstCurrentScrambleMove.charAt(0) && isDoubleTurn)) {
        nextScramble = currentScrambleMoves.slice(1).join(' ');
        if (isDoubleTurn) {
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
  }, [scrambleMode, scrambleText, targetAlgorithm]);

  const clearScramble = useCallback(() => {
    setScrambleMode(false);
    setScrambleText('');
    setTargetAlgorithm('');
    setHelpTone('hidden');
  }, []);

  return useMemo(() => ({
    scrambleMode,
    scrambleText,
    isComputing,
    targetAlgorithm,
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
  ]);
}
