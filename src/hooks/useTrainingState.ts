import { useEffect, useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';
import { cubeTimestampLinearFit } from 'smartcube-web-bluetooth';
import {
  averageOfFiveTimeNumber,
  averageTimeString,
  bestTimeString,
  makeTimeParts,
  type CaseCardData,
} from '../lib/legacy-algorithms';
import { countMovesETM } from '../lib/legacy-charts';
import { prepareTrainingAlgorithm } from '../lib/legacy-auf';
import { solvedPattern } from '../lib/cube-utils';
import { fixOrientation } from '../lib/legacy-scramble';
import { getInverseMove, getOppositeMove, sanitizeMove, trailingWholeCubeRotationMoveCount } from '../lib/legacy-training';
import {
  algToId,
  expandNotation,
  getBestTime,
  getLastTimes,
  setBestTime,
  setLastTimes,
} from '../lib/legacy-storage';
import { FACES, IDENTITY, SLICE_ROTATION, composePerm, invertPerm, type Face, type FacePerm } from '../lib/smartcube-parity';

export type TimerState = 'IDLE' | 'READY' | 'RUNNING' | 'STOPPED';

export interface TrainingTimeEntry {
  value: number;
  label: string;
  isPb: boolean;
}

export interface TrainingStats {
  best: string;
  ao5: string;
  average: string;
  averageTps: string;
  singlePb: string;
  practiceCount: number;
  hasHistory: boolean;
  lastFive: TrainingTimeEntry[];
}

export interface TrainingDisplayMove {
  prefix: string;
  token: string;
  suffix: string;
  color: DisplayColor;
  circle: boolean;
}

type DisplayColor = 'default' | 'green' | 'red' | 'blue' | 'next';

export interface SmartcubeMoveRecord {
  face: number;
  direction: number;
  move: string;
  localTimestamp: number | null;
  cubeTimestamp: number | null;
  isBugged?: boolean;
}

export interface TrainingFlashRequest {
  key: number;
  color: 'gray' | 'red' | 'green';
  durationMs: number;
}

export interface TrainingPracticeOptions {
  selectionChangeMode: 'bulk' | 'manual';
  randomizeAUF: boolean;
  randomOrder: boolean;
  prioritizeSlowCases: boolean;
  prioritizeFailedCases: boolean;
  smartcubeConnected: boolean;
  currentPattern?: KPattern | null;
  statsRefreshToken?: number;
}

interface TrainCurrentOptions {
  algorithm?: string;
  preserveDisplayedAlgorithm?: boolean;
}

export interface TrainingState {
  inputMode: boolean;
  scrambleMode: boolean;
  timerState: TimerState;
  timerText: string;
  algInput: string;
  displayAlg: string;
  currentCase: CaseCardData | null;
  currentAlgName: string;
  selectedCases: CaseCardData[];
  stats: TrainingStats;
  statsAlgId: string;
  displayMoves: TrainingDisplayMove[];
  fixText: string;
  fixVisible: boolean;
  helpTone: 'hidden' | 'red';
  failedCounts: Record<string, number>;
  practiceCounts: Record<string, number>;
  flashRequest: TrainingFlashRequest | null;
  setAlgInput: (value: string) => void;
  clearFailedCounts: () => void;
  enterInputMode: (algorithm?: string) => void;
  trainCurrent: (initialPattern?: KPattern | null, options?: TrainCurrentOptions) => Promise<void>;
  setTimerState: (state: TimerState) => void;
  activateTimer: () => void;
  handleSpaceKeyDown: () => void;
  handleSpaceKeyUp: () => void;
  handleSmartcubeMove: (currentPattern: KPattern, move: string, rawMoves?: SmartcubeMoveRecord[], isBugged?: boolean) => boolean;
  stopAndRecordSolve: (timeMs: number) => void;
  getElapsedMs: () => number;
  prepareForScramble: () => void;
  resetDrill: () => void;
  setKeepInitialState: (value: boolean) => void;
}

function formatTimerTimestamp(timestamp: number) {
  const t = makeTimeParts(timestamp);
  return `${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`;
}

function formatHistoryTimestamp(timestamp: number) {
  const t = makeTimeParts(timestamp);
  const minutesPart = t.minutes > 0 ? `${t.minutes}:` : '';
  return `${minutesPart}${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`;
}

function buildStats(algId: string, displayAlg: string, _practiceCount: number): TrainingStats {
  if (!algId) {
    return {
      best: '-',
      ao5: '-',
      average: '-',
      averageTps: '-',
      singlePb: '-',
      practiceCount: 0,
      hasHistory: false,
      lastFive: [],
    };
  }

  const lastTimes = getLastTimes(algId);
  const bestTime = getBestTime(algId);
  const averageValue = lastTimes.length > 0
    ? lastTimes.reduce((sum, time) => sum + time, 0) / lastTimes.length
    : null;
  const moveCount = displayAlg ? countMovesETM(displayAlg) : 0;
  const averageTps = averageValue && averageValue > 0
    ? (moveCount / (averageValue / 1000)).toFixed(2)
    : '-';
  const historyCount = lastTimes.length;
  const derivedPracticeCount = lastTimes.length;

  return {
    best: bestTimeString(bestTime),
    ao5: averageTimeString(averageOfFiveTimeNumber(algId)),
    average: averageTimeString(averageValue),
    averageTps,
    singlePb: bestTimeString(bestTime),
    practiceCount: derivedPracticeCount,
    hasHistory: historyCount > 0,
    lastFive: lastTimes.slice(-5).map((time, index, times) => ({
      value: time,
      label: `Time ${derivedPracticeCount < 5 ? index + 1 : derivedPracticeCount - times.length + index + 1}: ${formatHistoryTimestamp(time)}`,
      isPb: bestTime === time,
    })),
  };
}

function insertSlowCase(queue: CaseCardData[], nextCase: CaseCardData) {
  const bestTime = getBestTime(nextCase.id);
  if (!bestTime) {
    const index = queue.reduceRight((lastIndex, current, currentIndex) => {
      return !getBestTime(current.id) ? lastIndex : currentIndex;
    }, -1);

    if (index === -1) {
      queue.push(nextCase);
    } else {
      queue.splice(index, 0, nextCase);
    }
    return;
  }

  const index = queue.findIndex((current) => {
    const currentBest = getBestTime(current.id);
    return currentBest != null && currentBest < bestTime;
  });

  if (index === -1) {
    queue.push(nextCase);
  } else {
    queue.splice(index, 0, nextCase);
  }
}

function buildQueue(selectedCases: CaseCardData[], prioritizeSlowCases: boolean) {
  const queue: CaseCardData[] = [];
  for (const selectedCase of selectedCases) {
    if (prioritizeSlowCases) {
      insertSlowCase(queue, selectedCase);
    } else {
      queue.push(selectedCase);
    }
  }
  return queue;
}

function shuffleCases(cases: CaseCardData[]) {
  const nextCases = [...cases];
  for (let index = nextCases.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextCases[index], nextCases[randomIndex]] = [nextCases[randomIndex], nextCases[index]];
  }
  return nextCases;
}

function arraysEqual<T>(left: T[], right: T[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function splitMoveToken(move: string) {
  let prefix = '';
  let suffix = '';
  let token = '';

  for (const char of move) {
    if (char === '(') {
      prefix += char;
    } else if (char === ')') {
      suffix += char;
    } else {
      token += char;
    }
  }

  return { prefix, token, suffix };
}

function buildDisplayState(displayAlg: string, currentMoveIndex: number, badMoves: string[], randomizeAUF: boolean): {
  moves: TrainingDisplayMove[];
  fixText: string;
  suppressedFix: boolean;
} {
  const userAlg = displayAlg.split(/\s+/).filter(Boolean);
  let fixText = '';
  let simplifiedBadAlg: string[] = [];

  if (badMoves.length > 0) {
    for (let index = 0; index < badMoves.length; index += 1) {
      fixText += `${getInverseMove(badMoves[badMoves.length - 1 - index])} `;
    }

    const simplified = Alg.fromString(fixText)
      .experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 })
      .toString()
      .trim();
    fixText = simplified;
    simplifiedBadAlg = simplified ? simplified.split(/\s+/) : [];
  }

  let previousColor: DisplayColor = 'default';
  let isDoubleTurn = false;
  let isOppositeMove = false;
  let isAUF = false;

  const moves = userAlg.map<TrainingDisplayMove>((move, index) => {
    let color: DisplayColor = 'default';

    if (index <= currentMoveIndex) {
      color = 'green';
    } else if (index < 1 + currentMoveIndex + simplifiedBadAlg.length) {
      color = 'red';
    }

    if (index === currentMoveIndex + 1 && color !== 'red') {
      color = 'next';
    }

    const cleanMove = move.replace(/[()']/g, '').trim();

    if (index === 0 && currentMoveIndex === -1 && randomizeAUF) {
      if (
        simplifiedBadAlg.length === 1 &&
        simplifiedBadAlg[0]?.[0] === 'U' &&
        cleanMove.length > 0 &&
        cleanMove.charAt(0) === 'U'
      ) {
        color = 'blue';
        isAUF = true;
      }
    }

    if (index === currentMoveIndex + 1 && cleanMove.length > 1) {
      const isSingleBadAlg = simplifiedBadAlg.length === 1;
      const isDoubleBadAlg = simplifiedBadAlg.length === 2;
      const isTripleBadAlg = simplifiedBadAlg.length === 3;
      const rawExpected = cleanMove[0];
      const expectedFace = rawExpected.toUpperCase();
      const isWideMove = rawExpected >= 'a' && rawExpected <= 'z';
      const oppositeFace: Record<string, string> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
      let localOrientation: FacePerm = { ...IDENTITY };

      for (let moveIndex = 0; moveIndex <= currentMoveIndex; moveIndex += 1) {
        const currentMove = userAlg[moveIndex]?.replace(/[()]/g, '').trim() || '';
        const rotation = SLICE_ROTATION[currentMove];
        if (rotation) {
          localOrientation = composePerm(localOrientation, rotation);
        }
      }

      const inverse = invertPerm(localOrientation);
      const firstBadFace = simplifiedBadAlg[0]?.[0] as Face | undefined;
      const remappedBadFace = firstBadFace && FACES.includes(firstBadFace)
        ? inverse[firstBadFace]
        : simplifiedBadAlg[0]?.[0];
      const badFace = simplifiedBadAlg[0]?.[0];
      const faceMatch = badFace === expectedFace
        || remappedBadFace === expectedFace
        || (isWideMove && (badFace === oppositeFace[expectedFace] || remappedBadFace === oppositeFace[expectedFace]));

      if (
        (isSingleBadAlg && faceMatch)
        || (isDoubleBadAlg && 'MES'.includes(cleanMove[0]))
        || (isTripleBadAlg && 'MES'.includes(cleanMove[0]))
      ) {
        color = 'blue';
        isDoubleTurn = true;
      }
    }

    const inverseMove = simplifiedBadAlg[0] ? getInverseMove(simplifiedBadAlg[0]) : '';
    const currentMove = userAlg[index]?.replace(/[()']/g, '');
    if (index === currentMoveIndex + 1 && simplifiedBadAlg.length === 1) {
      const oppositeMove = getOppositeMove(inverseMove.replace(/[()'2]/g, ''));
      const nextMove = userAlg[index + 1]?.replace(/[()]/g, '');
      if (
        (inverseMove === nextMove || (inverseMove.charAt(0) === nextMove?.charAt(0) && nextMove?.charAt(1) === '2'))
        && (oppositeMove === currentMove || (oppositeMove === currentMove?.charAt(0) && currentMove?.charAt(1) === '2'))
      ) {
        color = 'next';
        isOppositeMove = true;
      }
    }

    if (index === currentMoveIndex + 2 && isOppositeMove) {
      color = move.endsWith('2') && inverseMove !== currentMove ? 'blue' : 'green';
    }
    if ((previousColor as string) === 'blue' || ((previousColor as string) !== 'blue' && (color as string) !== 'blue' && isDoubleTurn)) {
      color = 'default';
    }

    previousColor = color;
    const parts = splitMoveToken(move);
    return {
      ...parts,
      color,
      circle: index === currentMoveIndex + 1,
    };
  });

  return {
    moves,
    fixText,
    suppressedFix: isDoubleTurn || isAUF || isOppositeMove,
  };
}

export function useTrainingState(
  selectedCases: CaseCardData[],
  category = '',
  options: TrainingPracticeOptions,
): TrainingState {
  const [inputMode, setInputMode] = useState(true);
  const [scrambleMode, setScrambleMode] = useState(false);
  const [timerState, setTimerStateInternal] = useState<TimerState>('IDLE');
  const [timerText, setTimerText] = useState('');
  const [algInput, setAlgInputState] = useState('');
  const [displayAlg, setDisplayAlg] = useState('');
  const [currentCase, setCurrentCase] = useState<CaseCardData | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [badMoves, setBadMoves] = useState<string[]>([]);
  const [fixVisible, setFixVisible] = useState(false);
  const [helpTone, setHelpTone] = useState<'hidden' | 'red'>('hidden');
  const [failedCounts, setFailedCounts] = useState<Record<string, number>>({});
  const [practiceCounts, setPracticeCounts] = useState<Record<string, number>>({});
  const [flashRequest, setFlashRequest] = useState<TrainingFlashRequest | null>(null);

  const timerStartRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const isKeyboardTimerActiveRef = useRef(false);
  const initialPatternRef = useRef<KPattern | null>(null);
  const patternStatesRef = useRef<KPattern[]>([]);
  const expectedMovesRef = useRef<string[]>([]);
  const lastMovesRef = useRef<string[]>([]);
  const selectedQueueRef = useRef<CaseCardData[]>([]);
  const selectedQueueCopyRef = useRef<CaseCardData[]>([]);
  const currentCaseRef = useRef<CaseCardData | null>(null);
  const originalAlgIdRef = useRef('');
  const originalAlgTextRef = useRef('');
  const solutionMovesRef = useRef<SmartcubeMoveRecord[]>([]);
  const fixTimeoutRef = useRef<number | null>(null);
  const previousFixLengthRef = useRef(0);
  const hasShownFailureFlashRef = useRef(false);
  const hasFailedCurrentCaseRef = useRef(false);
  const flashKeyRef = useRef(0);
  const previousSelectedIdsRef = useRef<string[]>([]);
  const keepInitialStateRef = useRef(false);

  currentCaseRef.current = currentCase;

  const displayState = useMemo(
    () => buildDisplayState(displayAlg, currentMoveIndex, badMoves, options.randomizeAUF),
    [badMoves, currentMoveIndex, displayAlg, options.randomizeAUF],
  );

  const statsAlgId = originalAlgIdRef.current;
  const stats = useMemo(
    () => buildStats(statsAlgId, displayAlg, practiceCounts[statsAlgId] || 0),
    [displayAlg, failedCounts, options.statsRefreshToken, practiceCounts, statsAlgId, timerState],
  );

  useEffect(() => {
    if (timerState !== 'RUNNING') {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    function tick() {
      if (timerStartRef.current == null) {
        return;
      }
      const elapsed = performance.now() - timerStartRef.current;
      setTimerText(formatTimerTimestamp(elapsed));
      frameRef.current = window.requestAnimationFrame(tick);
    }

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [timerState]);

  useEffect(() => {
    if (fixTimeoutRef.current !== null) {
      window.clearTimeout(fixTimeoutRef.current);
      fixTimeoutRef.current = null;
    }

    if (!displayState.fixText || displayState.suppressedFix) {
      setFixVisible(false);
      setHelpTone('hidden');
      hasShownFailureFlashRef.current = false;
      return;
    }

    fixTimeoutRef.current = window.setTimeout(() => {
      setFixVisible(true);

      const fixMoveLength = countMovesETM(displayState.fixText);
      if (fixMoveLength > previousFixLengthRef.current && fixMoveLength > 1) {
        setHelpTone('red');
      } else {
        setHelpTone('hidden');
      }
      previousFixLengthRef.current = fixMoveLength;

      if (!hasShownFailureFlashRef.current) {
        flashKeyRef.current += 1;
        setFlashRequest({ key: flashKeyRef.current, color: 'red', durationMs: 300 });
        hasShownFailureFlashRef.current = true;
      }

      const failedCase = currentCaseRef.current;
      if (failedCase && !hasFailedCurrentCaseRef.current) {
        hasFailedCurrentCaseRef.current = true;
        setFailedCounts((current) => ({
          ...current,
          [failedCase.id]: (current[failedCase.id] || 0) + 1,
        }));

        if (
          options.prioritizeFailedCases
          && !selectedQueueCopyRef.current.some((entry) => entry.id === failedCase.id)
        ) {
          selectedQueueCopyRef.current.push(failedCase);
        }
      }
    }, 300);

    return () => {
      if (fixTimeoutRef.current !== null) {
        window.clearTimeout(fixTimeoutRef.current);
        fixTimeoutRef.current = null;
      }
    };
  }, [displayState.fixText, displayState.suppressedFix, options.prioritizeFailedCases]);

  function setAlgInput(value: string) {
    setAlgInputState(value);
  }

  function clearFailedCounts() {
    setFailedCounts({});
    setPracticeCounts({});
  }

  function selectQueueHead(nextCase: CaseCardData | null) {
    setCurrentCase(nextCase);
    if (nextCase) {
      setAlgInputState(nextCase.algorithm);
      if (inputMode) {
        setDisplayAlg(nextCase.algorithm);
      }
    }
  }

  function switchToNextAlgorithm() {
    flashKeyRef.current += 1;
    setFlashRequest({ key: flashKeyRef.current, color: 'green', durationMs: 200 });

    if (selectedQueueRef.current.length + selectedQueueCopyRef.current.length > 1) {
      const currentAlg = selectedQueueRef.current.shift() ?? null;
      if (selectedQueueRef.current.length === 0) {
        selectedQueueRef.current = [...selectedQueueCopyRef.current];
        selectedQueueCopyRef.current = [];
        if (options.prioritizeSlowCases) {
          selectedQueueRef.current = buildQueue(selectedQueueRef.current, true);
        }
      }
      if (options.randomOrder) {
        selectedQueueRef.current = shuffleCases(selectedQueueRef.current);
      }
      if (currentAlg) {
        selectedQueueCopyRef.current.push(currentAlg);
      }
    }

    selectQueueHead(selectedQueueRef.current[0] ?? currentCaseRef.current);
  }

  function insertSelectedCase(nextCase: CaseCardData) {
    if (selectedQueueRef.current.some((entry) => entry.id === nextCase.id)) {
      return;
    }

    if (options.prioritizeSlowCases) {
      insertSlowCase(selectedQueueRef.current, nextCase);
    } else {
      selectedQueueRef.current.push(nextCase);
    }
  }

  function retrainQueueHead(nextCase?: CaseCardData | null) {
    const queueHead = nextCase ?? selectedQueueRef.current[0] ?? null;
    selectQueueHead(queueHead);
    if (queueHead) {
      void trainCurrent(undefined, { algorithm: queueHead.algorithm });
    }
  }

  function clearProgressState() {
    expectedMovesRef.current = [];
    patternStatesRef.current = [];
    lastMovesRef.current = [];
    solutionMovesRef.current = [];
    setCurrentMoveIndex(-1);
    setBadMoves([]);
    setFixVisible(false);
    setHelpTone('hidden');
    previousFixLengthRef.current = 0;
    hasShownFailureFlashRef.current = false;
    hasFailedCurrentCaseRef.current = false;
  }

  function clearStatsIdentity() {
    originalAlgIdRef.current = '';
    originalAlgTextRef.current = '';
  }

  function setTimerState(state: TimerState) {
    setTimerStateInternal(state);

    if (state === 'IDLE') {
      timerStartRef.current = null;
      setTimerText('');
      return;
    }

    if (state === 'READY') {
      timerStartRef.current = null;
      if (timerText === '') {
        setTimerText('0:00.000');
      }
      return;
    }

    if (state === 'RUNNING') {
      solutionMovesRef.current = [];
      timerStartRef.current = performance.now();
      return;
    }

    if (state === 'STOPPED' && timerStartRef.current != null) {
      const elapsed = performance.now() - timerStartRef.current;
      setTimerText(formatTimerTimestamp(elapsed));
    }
  }

  function getElapsedMs() {
    if (timerStartRef.current == null) {
      return 0;
    }
    return Math.round(performance.now() - timerStartRef.current);
  }

  function enterInputMode(algorithm = algInput || displayAlg) {
    clearProgressState();
    clearStatsIdentity();
    initialPatternRef.current = null;
    setInputMode(true);
    setScrambleMode(false);
    setTimerText('');
    setTimerStateInternal('IDLE');
    setAlgInputState(expandNotation(algorithm.trim()));
  }

  async function trainCurrent(initialPattern?: KPattern | null, trainOptions?: TrainCurrentOptions) {
    const rawAlgorithm = trainOptions?.algorithm ?? algInput;
    const normalizedAlgorithm = expandNotation(rawAlgorithm.trim());
    if (!normalizedAlgorithm) {
      setInputMode(true);
      clearStatsIdentity();
      setTimerState('IDLE');
      setDisplayAlg('');
      clearProgressState();
      return;
    }

    const prepared = trainOptions?.preserveDisplayedAlgorithm
      ? {
          displayAlgorithm: normalizedAlgorithm,
          moves: normalizedAlgorithm.split(/\s+/).filter(Boolean),
          originalMoves: normalizedAlgorithm.split(/\s+/).filter(Boolean),
        }
      : await prepareTrainingAlgorithm(
          normalizedAlgorithm.split(/\s+/).filter(Boolean),
          category,
          options.randomizeAUF,
        );

    let basePattern: KPattern;
    if (keepInitialStateRef.current && initialPattern) {
      basePattern = initialPattern;
      keepInitialStateRef.current = false;
    } else {
      basePattern = initialPattern
        ?? (options.smartcubeConnected ? options.currentPattern ?? initialPatternRef.current : initialPatternRef.current ?? options.currentPattern)
        ?? await solvedPattern();
    }
    initialPatternRef.current = basePattern;
    originalAlgTextRef.current = normalizedAlgorithm;
    originalAlgIdRef.current = algToId(normalizedAlgorithm) || 'default-alg-id';

    clearProgressState();

    expectedMovesRef.current = prepared.moves.map(sanitizeMove);
    let previousPattern = basePattern;
    patternStatesRef.current = expectedMovesRef.current.map((move) => {
      previousPattern = previousPattern.applyMove(move);
      return fixOrientation(previousPattern);
    });

    setAlgInputState(normalizedAlgorithm);
    setDisplayAlg(prepared.displayAlgorithm);
    setInputMode(false);
    setScrambleMode(false);
    setTimerState('READY');
  }

  useEffect(() => {
    const nextSelectedIds = selectedCases.map((selectedCase) => selectedCase.id);
    if (arraysEqual(previousSelectedIdsRef.current, nextSelectedIds)) {
      return;
    }

    const previousSelectedIds = previousSelectedIdsRef.current;
    previousSelectedIdsRef.current = nextSelectedIds;

    if (selectedCases.length === 0) {
      selectedQueueRef.current = [];
      selectedQueueCopyRef.current = [];
      setCurrentCase(null);
      setInputMode(true);
      setScrambleMode(false);
      setTimerStateInternal('IDLE');
      setAlgInputState('');
      setDisplayAlg('');
      setTimerText('');
      clearStatsIdentity();
      initialPatternRef.current = null;
      clearProgressState();
      return;
    }

    if (previousSelectedIds.length === 0 || options.selectionChangeMode === 'bulk') {
      const newQueue = buildQueue(selectedCases, options.prioritizeSlowCases);
      const existingCopyIds = new Set(newQueue.map((c) => c.id));
      const retainedCopy = selectedQueueCopyRef.current.filter((c) => existingCopyIds.has(c.id));
      selectedQueueRef.current = newQueue;
      selectedQueueCopyRef.current = retainedCopy;
      retrainQueueHead(selectedQueueRef.current[0] ?? null);
      return;
    }

    const addedIds = nextSelectedIds.filter((selectedId) => !previousSelectedIds.includes(selectedId));
    const removedIds = previousSelectedIds.filter((selectedId) => !nextSelectedIds.includes(selectedId));

    if (addedIds.length > 0 && removedIds.length === 0) {
      const selectedCaseMap = new Map(selectedCases.map((selectedCase) => [selectedCase.id, selectedCase]));
      const previousHeadId = selectedQueueRef.current[0]?.id ?? null;

      for (const selectedId of nextSelectedIds) {
        if (!addedIds.includes(selectedId)) {
          continue;
        }

        const selectedCase = selectedCaseMap.get(selectedId);
        if (selectedCase) {
          insertSelectedCase(selectedCase);
        }
      }

      const nextHead = selectedQueueRef.current[0] ?? null;
      if (nextHead && nextHead.id !== previousHeadId) {
        retrainQueueHead(nextHead);
      }
      return;
    }

    if (removedIds.length > 0 && addedIds.length === 0) {
      const removedIdSet = new Set(removedIds);
      selectedQueueRef.current = selectedQueueRef.current.filter((entry) => !removedIdSet.has(entry.id));
      selectedQueueCopyRef.current = selectedQueueCopyRef.current.filter((entry) => !removedIdSet.has(entry.id));

      if (selectedQueueRef.current.length === 0) {
        resetDrill();
        setCurrentCase(null);
        return;
      }

      retrainQueueHead(selectedQueueRef.current[0] ?? null);
      return;
    }

    selectedQueueRef.current = buildQueue(selectedCases, options.prioritizeSlowCases);
    selectedQueueCopyRef.current = [];
    retrainQueueHead(selectedQueueRef.current[0] ?? null);
  }, [options.prioritizeSlowCases, options.selectionChangeMode, selectedCases]);

  function stopAndRecordSolve(timeMs: number) {
    const algId = originalAlgIdRef.current || 'default-alg-id';
    let finalTime = Math.round(timeMs);

    if (options.smartcubeConnected && solutionMovesRef.current.length > 0) {
      const fittedMoves = cubeTimestampLinearFit(solutionMovesRef.current);
      const lastMove = fittedMoves.at(-1);
      if (lastMove?.cubeTimestamp != null && Number.isFinite(lastMove.cubeTimestamp) && lastMove.cubeTimestamp > 0) {
        finalTime = lastMove.cubeTimestamp;
      }
    }

    const lastTimes = getLastTimes(algId);
    const nextTimes = [...lastTimes, finalTime];
    if (nextTimes.length > 100) {
      nextTimes.shift();
    }
    setLastTimes(algId, nextTimes);

    const currentBest = getBestTime(algId);
    if (currentBest == null || finalTime < currentBest) {
      setBestTime(algId, finalTime);
    }

    setPracticeCounts((current) => ({
      ...current,
      [algId]: (current[algId] || 0) + 1,
    }));
    setTimerText(formatTimerTimestamp(finalTime));
    setTimerStateInternal('STOPPED');
    isKeyboardTimerActiveRef.current = false;

    if (!options.smartcubeConnected) {
      const nextInitialPattern = patternStatesRef.current.at(-1) ?? initialPatternRef.current;

      switchToNextAlgorithm();

      const nextCase = selectedQueueRef.current[0] ?? null;
      if (nextCase) {
        void trainCurrent(nextInitialPattern, { algorithm: nextCase.algorithm });
      }
    }
  }

  function activateTimer() {
    if (timerState === 'STOPPED' || timerState === 'IDLE' || timerState === 'READY') {
      setTimerState('RUNNING');
    } else {
      stopAndRecordSolve(getElapsedMs());
    }
  }

  function handleSpaceKeyDown() {
    if (inputMode) {
      return;
    }

    if (timerState === 'STOPPED' || timerState === 'IDLE') {
      setTimerText('0:00.000');
      setTimerState('READY');
    } else if (timerState === 'RUNNING') {
      stopAndRecordSolve(getElapsedMs());
    } else if (timerState === 'READY' && !isKeyboardTimerActiveRef.current) {
      setTimerText('0:00.000');
    }
  }

  function handleSpaceKeyUp() {
    if (inputMode) {
      return;
    }

    if (timerState === 'READY' && !isKeyboardTimerActiveRef.current) {
      activateTimer();
      isKeyboardTimerActiveRef.current = true;
    } else {
      isKeyboardTimerActiveRef.current = false;
    }
  }

  function handleSmartcubeMove(currentPattern: KPattern, move: string, rawMoves?: SmartcubeMoveRecord[], isBugged = false) {
    if (inputMode || scrambleMode || patternStatesRef.current.length === 0) {
      return false;
    }

    if (isBugged) {
      return false;
    }

    if (timerState === 'READY') {
      setTimerState('RUNNING');
    }

    const capturedMoves = rawMoves && rawMoves.length > 0
      ? rawMoves
      : [{ face: -1, direction: 0, move, localTimestamp: null, cubeTimestamp: null }];
    lastMovesRef.current = [
      ...lastMovesRef.current,
      ...capturedMoves.map((entry) => entry.move),
    ].slice(-256);
    if (timerState === 'RUNNING' || timerState === 'READY' || timerState === 'STOPPED') {
      solutionMovesRef.current = [...solutionMovesRef.current, ...capturedMoves];
    }

    const patternAfterMove = fixOrientation(currentPattern);
    if (patternStatesRef.current.length > 0 && currentMoveIndex === 0 && initialPatternRef.current?.isIdentical(patternAfterMove)) {
      clearProgressState();
      return false;
    }

    const nextExpectedIdx = currentMoveIndex + 1;
    let matchedIndex: number | null = null;

    if (
      nextExpectedIdx >= 0
      && nextExpectedIdx < patternStatesRef.current.length
      && patternAfterMove.isIdentical(patternStatesRef.current[nextExpectedIdx])
    ) {
      matchedIndex = nextExpectedIdx;
    } else {
      patternStatesRef.current.forEach((pattern, index) => {
        if (matchedIndex === null && patternAfterMove.isIdentical(pattern)) {
          matchedIndex = index;
        }
      });
    }

    if (matchedIndex !== null) {
      setCurrentMoveIndex(matchedIndex);
      setBadMoves([]);
      const tailRotations = trailingWholeCubeRotationMoveCount(expectedMovesRef.current);
      const lastLayerMoveIndex = expectedMovesRef.current.length - 1 - tailRotations;
      const finishedIncludingIgnoredRotations = tailRotations > 0
        && lastLayerMoveIndex >= 0
        && matchedIndex === lastLayerMoveIndex;

      if (matchedIndex === expectedMovesRef.current.length - 1 || finishedIncludingIgnoredRotations) {
        clearProgressState();
        const completedPattern = patternAfterMove;
        initialPatternRef.current = completedPattern;
        setCurrentMoveIndex(0);
        stopAndRecordSolve(getElapsedMs());

        if (options.smartcubeConnected) {
          switchToNextAlgorithm();
          const nextCase = selectedQueueRef.current[0] ?? null;
          if (nextCase) {
            void trainCurrent(completedPattern, { algorithm: nextCase.algorithm });
          }
        }
        return true;
      }
      return false;
    }

    const wrongMoves = capturedMoves.map((entry) => entry.move);
    const nextBadMoves = [...badMoves, ...wrongMoves];
    const lastWrongMove = wrongMoves.at(-1) ?? move;

    if (
      currentMoveIndex === 0
      && nextBadMoves.length === 1
      && lastWrongMove === getInverseMove(expectedMovesRef.current[currentMoveIndex])
    ) {
      setCurrentMoveIndex(-1);
      setBadMoves([]);
      return false;
    }

    if (
      nextBadMoves.length >= 2
      && lastWrongMove === getInverseMove(nextBadMoves[nextBadMoves.length - 2])
    ) {
      setBadMoves(nextBadMoves.slice(0, -2));
      return false;
    }

    if (
      nextBadMoves.length > 3
      && lastMovesRef.current.length > 3
      && lastMovesRef.current.at(-1) === lastMovesRef.current.at(-2)
      && lastMovesRef.current.at(-2) === lastMovesRef.current.at(-3)
      && lastMovesRef.current.at(-3) === lastMovesRef.current.at(-4)
    ) {
      setBadMoves(nextBadMoves.slice(0, -4));
      return false;
    }

    setBadMoves(nextBadMoves);
    return false;
  }

  function prepareForScramble() {
    clearProgressState();
    setScrambleMode(true);
  }

  function resetDrill() {
    clearProgressState();
    clearStatsIdentity();
    initialPatternRef.current = null;
    setInputMode(true);
    setScrambleMode(false);
    setCurrentCase(null);
    setAlgInputState('');
    setDisplayAlg('');
    setTimerText('');
    setTimerState('IDLE');
  }

  function setKeepInitialState(value: boolean) {
    keepInitialStateRef.current = value;
  }

  return {
    inputMode,
    scrambleMode,
    timerState,
    timerText,
    algInput,
    displayAlg,
    currentCase,
    currentAlgName: currentCase?.name ?? '',
    selectedCases,
    stats,
    statsAlgId,
    displayMoves: displayState.moves,
    fixText: displayState.fixText,
    fixVisible,
    helpTone,
    failedCounts,
    practiceCounts,
    flashRequest,
    setAlgInput,
    clearFailedCounts,
    enterInputMode,
    trainCurrent,
    setTimerState,
    activateTimer,
    handleSpaceKeyDown,
    handleSpaceKeyUp,
    handleSmartcubeMove,
    stopAndRecordSolve,
    getElapsedMs,
    prepareForScramble,
    resetDrill,
    setKeepInitialState,
  };
}
