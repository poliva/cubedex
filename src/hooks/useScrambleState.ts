import { useCallback, useMemo, useState } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { CaseCardData } from '../lib/case-cards';
import { solvedPattern } from '../lib/cube-utils';
import { getScrambleToSolution } from '../lib/scramble';
import { prepareTrainingAlgorithm } from '../lib/auf';

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

    let nextScramble = await getScrambleToSolution(targetAlgorithm, currentPattern);
    const currentScrambleMoves = scrambleText.split(' ').filter(Boolean);
    const recomputedMoves = nextScramble.split(' ').filter(Boolean);
    const firstCurrentScrambleMove = currentScrambleMoves[0] ?? '';
    const isDoubleTurn = firstCurrentScrambleMove.charAt(1) === '2';

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

    setHelpTone(recomputedMoves.length > currentScrambleMoves.length ? 'green' : 'hidden');

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
