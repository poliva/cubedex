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
} from '../lib/case-cards';
import { countMovesETM } from '../lib/charts';
import { prepareTrainingAlgorithm } from '../lib/auf';
import { solvedPattern } from '../lib/cube-utils';
import { fixOrientation } from '../lib/scramble';
import { getInverseMove, getOppositeMove, sanitizeMove, trailingWholeCubeRotationMoveCount } from '../lib/move-helpers';
import {
  TIME_ATTACK_SCOPE_PREFIX,
  createTimeAttackScopeId,
  createGlobalScopeId,
  expandNotation,
  getBestTime,
  getSolveHistory,
  getTimeAttackLastRuns,
  setBestTime,
  setSolveHistory,
  setTimeAttackLastRuns,
} from '../lib/storage';
import { FACES, IDENTITY, SLICE_ROTATION, composePerm, invertPerm, type Face, type FacePerm } from '../lib/smartcube-parity';
import { useStableCallback } from './useStableCallback';

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
  avgExec: string;
  avgRecog: string;
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
  countdownMode: boolean;
  randomizeAUF: boolean;
  randomOrder: boolean;
  timeAttack: boolean;
  prioritizeSlowCases: boolean;
  prioritizeFailedCases: boolean;
  smartcubeConnected: boolean;
  currentPattern?: KPattern | null;
  statsRefreshToken?: number;
}

interface TrainCurrentOptions {
  algorithm?: string;
  preserveDisplayedAlgorithm?: boolean;
  statsScopeId?: string;
  startTimerImmediately?: boolean;
  trackRecognition?: boolean;
}

export interface TrainingState {
  inputMode: boolean;
  scrambleMode: boolean;
  timerState: TimerState;
  timerText: string;
  countdownActive: boolean;
  countdownValue: number | null;
  visualResetKey: number;
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
  timeAttackMode: boolean;
  timeAttackActive: boolean;
  timeAttackCurrentCaseNumber: number;
  timeAttackTotalCases: number;
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
  abortRunningAttempt: () => void;
  getElapsedMs: () => number;
  prepareForScramble: () => void;
  resetDrill: () => void;
  setKeepInitialState: (value: boolean) => void;
}

const MAX_RECOGNITION_MS = 15000;

function formatTimerTimestamp(timestamp: number) {
  const t = makeTimeParts(timestamp);
  return `${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`;
}

function formatHistoryTimestamp(timestamp: number) {
  const t = makeTimeParts(timestamp);
  const minutesPart = t.minutes > 0 ? `${t.minutes}:` : '';
  return `${minutesPart}${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`;
}

function averageFromValues(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildStats(
  algId: string,
  statsAlgorithm: string,
  _practiceCount: number,
  selectedCases: CaseCardData[] = [],
) : TrainingStats {
  if (!algId) {
    return {
      best: '-',
      ao5: '-',
      average: '-',
      avgExec: '-',
      avgRecog: '-',
      averageTps: '-',
      singlePb: '-',
      practiceCount: 0,
      hasHistory: false,
      lastFive: [],
    };
  }

  const solveHistory = getSolveHistory(algId);
  const lastTimes = solveHistory.map((entry) => entry.executionMs);
  const bestTime = getBestTime(algId);
  const averageExecution = averageFromValues(lastTimes);
  const averageRecognition = averageFromValues(
    solveHistory
      .map((entry) => entry.recognitionMs)
      .filter((value): value is number => value != null),
  );
  const averageTotal = averageFromValues(solveHistory.map((entry) => entry.totalMs));
  const isTimeAttackStats = algId.startsWith(TIME_ATTACK_SCOPE_PREFIX);
  const moveCount = isTimeAttackStats
    ? selectedCases.reduce((sum, currentCase) => sum + countMovesETM(currentCase.algorithm), 0)
    : (statsAlgorithm ? countMovesETM(statsAlgorithm) : 0);
  const averageTps = averageExecution && averageExecution > 0 && moveCount > 0
    ? (moveCount / (averageExecution / 1000)).toFixed(2)
    : '-';
  const historyCount = lastTimes.length;
  const derivedPracticeCount = lastTimes.length;

  return {
    best: bestTimeString(bestTime),
    ao5: averageTimeString(averageOfFiveTimeNumber(algId)),
    average: averageTimeString(averageTotal),
    avgExec: averageTimeString(averageExecution),
    avgRecog: averageTimeString(averageRecognition),
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

function appendLimitedTime<T>(value: T, values: T[]) {
  const nextTimes = [...values, value];
  if (nextTimes.length > 100) {
    nextTimes.shift();
  }
  return nextTimes;
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

// Cache for fix-alg simplification. Keyed by the raw `badMoves.join(' ')`
// so that redundant calls (e.g. same badMoves with a new `currentMoveIndex`)
// don't pay for `experimentalSimplify({ puzzleLoader: cube3x3x3 })`, which is
// by far the hottest part of `buildDisplayState`.
const fixSimplifyCache = new Map<string, string>();
const FIX_SIMPLIFY_CACHE_CAPACITY = 256;

// Cheap deterministic hash of a KPattern. For the 3x3x3 we serialize just the
// three orbits we use (EDGES/CORNERS/CENTERS) as `pieces|orientation`.
// JSON.stringify is fine here since the values are plain numeric arrays.
function hashKPattern(pattern: KPattern): string {
  const data = (pattern as unknown as { patternData: Record<string, { pieces: number[]; orientation: number[] }> }).patternData;
  if (!data) return '';
  const edges = data.EDGES;
  const corners = data.CORNERS;
  const centers = data.CENTERS;
  return (
    (edges ? `${edges.pieces.join(',')}|${edges.orientation.join(',')}` : '') +
    '/' +
    (corners ? `${corners.pieces.join(',')}|${corners.orientation.join(',')}` : '') +
    '/' +
    (centers ? `${centers.pieces.join(',')}|${centers.orientation.join(',')}` : '')
  );
}

function simplifyFixAlg(badMoves: string[]): string {
  if (badMoves.length === 0) return '';
  const cacheKey = badMoves.join(' ');
  const cached = fixSimplifyCache.get(cacheKey);
  if (cached !== undefined) {
    // Refresh LRU ordering.
    fixSimplifyCache.delete(cacheKey);
    fixSimplifyCache.set(cacheKey, cached);
    return cached;
  }
  let raw = '';
  for (let index = 0; index < badMoves.length; index += 1) {
    raw += `${getInverseMove(badMoves[badMoves.length - 1 - index])} `;
  }
  const simplified = Alg.fromString(raw)
    .experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 })
    .toString()
    .trim();
  fixSimplifyCache.set(cacheKey, simplified);
  while (fixSimplifyCache.size > FIX_SIMPLIFY_CACHE_CAPACITY) {
    const oldest = fixSimplifyCache.keys().next().value;
    if (oldest === undefined) break;
    fixSimplifyCache.delete(oldest);
  }
  return simplified;
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
    const simplified = simplifyFixAlg(badMoves);
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
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [visualResetKey, setVisualResetKey] = useState(0);
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
  const [timeAttackProgress, setTimeAttackProgress] = useState({
    active: false,
    currentCaseNumber: 0,
    totalCases: 0,
  });

  const timerStartRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const countdownGenerationRef = useRef(0);
  const isKeyboardTimerActiveRef = useRef(false);
  const ignoreNextSpaceKeyUpRef = useRef(false);
  const initialPatternRef = useRef<KPattern | null>(null);
  const patternStatesRef = useRef<KPattern[]>([]);
  // Hash of each pattern in `patternStatesRef` → index in that array.
  // Used to replace an O(n) `isIdentical` scan per smartcube move with an O(1) lookup.
  const patternHashMapRef = useRef<Map<string, number>>(new Map());
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
  const previousTimeAttackRef = useRef(options.timeAttack);
  const previousRandomOrderRef = useRef(options.randomOrder);
  const previousPrioritizeSlowCasesRef = useRef(options.prioritizeSlowCases);
  const previousSelectionChangeModeRef = useRef(options.selectionChangeMode);
  const keepInitialStateRef = useRef(false);
  const timeAttackSessionStartRef = useRef<number | null>(null);
  const timeAttackCaseTimesRef = useRef<number[]>([]);
  const timeAttackTotalCasesRef = useRef(0);
  const caseShownAtRef = useRef<number | null>(null);
  const firstActionAtRef = useRef<number | null>(null);
  const shouldTrackRecognitionRef = useRef(false);

  currentCaseRef.current = currentCase;
  const countdownActive = countdownValue != null;
  const countdownEnabled = options.countdownMode && !options.timeAttack;

  const displayState = useMemo(
    () => buildDisplayState(displayAlg, currentMoveIndex, badMoves, options.randomizeAUF),
    [badMoves, currentMoveIndex, displayAlg, options.randomizeAUF],
  );

  const statsAlgId = originalAlgIdRef.current;
  const stats = useMemo(
    () => buildStats(
      statsAlgId,
      originalAlgTextRef.current || displayAlg,
      practiceCounts[statsAlgId] || 0,
      selectedCases,
    ),
    [displayAlg, failedCounts, options.statsRefreshToken, practiceCounts, selectedCases, statsAlgId, timerState],
  );

  function getTimeAttackStatsScopeId() {
    return createTimeAttackScopeId(
      category,
      selectedCases.map((selectedCase) => selectedCase.id),
    );
  }

  function syncTimeAttackProgress(active: boolean, currentCaseNumber: number, totalCases = timeAttackTotalCasesRef.current) {
    setTimeAttackProgress({ active, currentCaseNumber, totalCases });
  }

  function clearTimeAttackSession(resetProgress = true) {
    timeAttackSessionStartRef.current = null;
    timeAttackCaseTimesRef.current = [];
    if (resetProgress) {
      timeAttackTotalCasesRef.current = 0;
      syncTimeAttackProgress(false, 0, 0);
    } else {
      setTimeAttackProgress((current) => ({
        active: false,
        currentCaseNumber: current.currentCaseNumber,
        totalCases: timeAttackTotalCasesRef.current,
      }));
    }
  }

  function cancelCountdown() {
    countdownGenerationRef.current += 1;
    if (countdownTimeoutRef.current !== null) {
      window.clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
    setCountdownValue(null);
  }

  function startCountdown(onComplete: () => void) {
    const generation = countdownGenerationRef.current + 1;
    countdownGenerationRef.current = generation;
    setCountdownValue(3);

    const step = (value: number) => {
      countdownTimeoutRef.current = window.setTimeout(() => {
        if (countdownGenerationRef.current !== generation) {
          return;
        }

        if (value === 1) {
          countdownTimeoutRef.current = null;
          setCountdownValue(null);
          onComplete();
          return;
        }

        const nextValue = value - 1;
        setCountdownValue(nextValue);
        step(nextValue);
      }, 1000);
    };

    step(3);
  }

  function buildSelectedQueueState(cases: CaseCardData[]) {
    const nextQueue = buildQueue(cases, options.prioritizeSlowCases);
    if (options.timeAttack && options.randomOrder) {
      return shuffleCases(nextQueue);
    }
    return nextQueue;
  }

  function resetTimeAttackQueue() {
    selectedQueueRef.current = buildSelectedQueueState(selectedCases);
    selectedQueueCopyRef.current = [];
    timeAttackTotalCasesRef.current = selectedQueueRef.current.length;
    syncTimeAttackProgress(false, selectedQueueRef.current.length > 0 ? 1 : 0, timeAttackTotalCasesRef.current);
  }

  function prepareNextTimeAttack(totalTimeText?: string) {
    clearTimeAttackSession();
    resetTimeAttackQueue();
    if (totalTimeText == null) {
      setTimerText('0:00.000');
    }
    const firstCase = selectedQueueRef.current[0] ?? null;
    selectQueueHead(firstCase);
    if (!firstCase) {
      return;
    }

    void trainCurrent(undefined, {
      algorithm: firstCase.algorithm,
      statsScopeId: getTimeAttackStatsScopeId(),
    }).then(() => {
      if (totalTimeText) {
        setTimerText(totalTimeText);
      }
    });
  }

  useEffect(() => {
    if (timerState !== 'RUNNING') {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    function tick() {
      const activeStart = options.timeAttack && timeAttackSessionStartRef.current != null
        ? timeAttackSessionStartRef.current
        : timerStartRef.current;
      if (activeStart == null) {
        return;
      }
      const elapsed = performance.now() - activeStart;
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
  }, [options.timeAttack, timerState]);

  useEffect(() => {
    if (options.timeAttack) {
      cancelCountdown();
    }
  }, [options.timeAttack]);

  useEffect(() => {
    return () => {
      if (countdownTimeoutRef.current !== null) {
        window.clearTimeout(countdownTimeoutRef.current);
      }
    };
  }, []);

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

  function incrementPracticeCount(scopeId: string) {
    setPracticeCounts((current) => ({
      ...current,
      [scopeId]: (current[scopeId] || 0) + 1,
    }));
  }

  function buildSolveHistoryEntry(executionMs: number) {
    const caseShownAt = caseShownAtRef.current;
    const firstActionAt = firstActionAtRef.current;
    const rawRecognitionMs = shouldTrackRecognitionRef.current
      && caseShownAt != null
      && firstActionAt != null
      && firstActionAt >= caseShownAt
      ? Math.round(firstActionAt - caseShownAt)
      : null;
    const recognitionMs = rawRecognitionMs != null && rawRecognitionMs <= MAX_RECOGNITION_MS
      ? rawRecognitionMs
      : null;

    return {
      executionMs,
      recognitionMs,
      totalMs: executionMs + (recognitionMs ?? 0),
    };
  }

  function persistSolveResult(scopeId: string, executionMs: number) {
    const nextHistory = appendLimitedTime(buildSolveHistoryEntry(executionMs), getSolveHistory(scopeId));
    setSolveHistory(scopeId, nextHistory);

    const currentBest = getBestTime(scopeId);
    if (currentBest == null || executionMs < currentBest) {
      setBestTime(scopeId, executionMs);
    }
  }

  function persistExecutionOnlyResult(scopeId: string, executionMs: number) {
    const nextHistory = appendLimitedTime({
      executionMs,
      recognitionMs: null,
      totalMs: executionMs,
    }, getSolveHistory(scopeId));
    setSolveHistory(scopeId, nextHistory);

    const currentBest = getBestTime(scopeId);
    if (currentBest == null || executionMs < currentBest) {
      setBestTime(scopeId, executionMs);
    }
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

  function getCaseStatsScopeId(nextCase: CaseCardData | null) {
    if (options.timeAttack && nextCase) {
      return getTimeAttackStatsScopeId();
    }
    return nextCase?.id;
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

  function advanceTimeAttackQueue() {
    flashKeyRef.current += 1;
    setFlashRequest({ key: flashKeyRef.current, color: 'green', durationMs: 200 });

    selectedQueueRef.current.shift();
    const nextCase = selectedQueueRef.current[0] ?? null;
    if (!nextCase) {
      syncTimeAttackProgress(false, timeAttackTotalCasesRef.current, timeAttackTotalCasesRef.current);
      return null;
    }

    const currentCaseNumber = timeAttackTotalCasesRef.current - selectedQueueRef.current.length + 1;
    syncTimeAttackProgress(true, currentCaseNumber, timeAttackTotalCasesRef.current);
    selectQueueHead(nextCase);
    return nextCase;
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
      void trainCurrent(undefined, {
        algorithm: queueHead.algorithm,
        statsScopeId: getCaseStatsScopeId(queueHead),
      });
    }
  }

  function clearProgressState() {
    expectedMovesRef.current = [];
    patternStatesRef.current = [];
    patternHashMapRef.current.clear();
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

  function clearRecognitionTracking() {
    caseShownAtRef.current = null;
    firstActionAtRef.current = null;
    shouldTrackRecognitionRef.current = false;
  }

  function resetAttemptStateKeepAlgorithm() {
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
      clearRecognitionTracking();
      setTimerText('');
      return;
    }

    if (state === 'READY') {
      timerStartRef.current = null;
      setTimerText('0:00.000');
      return;
    }

    if (state === 'RUNNING') {
      solutionMovesRef.current = [];
      const now = performance.now();
      timerStartRef.current = now;
      if (!options.smartcubeConnected && firstActionAtRef.current == null) {
        firstActionAtRef.current = now;
      }
      if (options.timeAttack && timeAttackTotalCasesRef.current > 0) {
        if (timeAttackSessionStartRef.current == null) {
          timeAttackSessionStartRef.current = now;
        }
        setTimeAttackProgress((current) => ({
          ...current,
          active: true,
        }));
      }
      return;
    }

    if (state === 'STOPPED' && timerStartRef.current != null) {
      const elapsed = options.timeAttack && timeAttackSessionStartRef.current != null
        ? performance.now() - timeAttackSessionStartRef.current
        : performance.now() - timerStartRef.current;
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
    cancelCountdown();
    clearProgressState();
    clearRecognitionTracking();
    clearStatsIdentity();
    clearTimeAttackSession();
    initialPatternRef.current = null;
    setInputMode(true);
    setScrambleMode(false);
    setTimerText('');
    setTimerStateInternal('IDLE');
    setAlgInputState(expandNotation(algorithm.trim()));
  }

  function revealTrainingCase(displayAlgorithm: string, normalizedAlgorithm: string, trainOptions?: TrainCurrentOptions) {
    setAlgInputState(normalizedAlgorithm);
    setDisplayAlg(displayAlgorithm);
    setInputMode(false);
    setScrambleMode(false);
    caseShownAtRef.current = performance.now();
    firstActionAtRef.current = !options.smartcubeConnected && trainOptions?.startTimerImmediately
      ? caseShownAtRef.current
      : null;
    shouldTrackRecognitionRef.current = trainOptions?.trackRecognition ?? false;
    setTimerState(trainOptions?.startTimerImmediately ? 'RUNNING' : 'READY');
    setVisualResetKey((v) => v + 1);
  }

  async function trainCurrent(initialPattern?: KPattern | null, trainOptions?: TrainCurrentOptions) {
    const rawAlgorithm = trainOptions?.algorithm ?? algInput;
    const normalizedAlgorithm = expandNotation(rawAlgorithm.trim());
    cancelCountdown();
    if (!normalizedAlgorithm) {
      setInputMode(true);
      clearStatsIdentity();
      setTimerState('IDLE');
      setDisplayAlg('');
      clearProgressState();
      clearRecognitionTracking();
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
    originalAlgIdRef.current = trainOptions?.statsScopeId
      ?? currentCaseRef.current?.id
      ?? createGlobalScopeId(normalizedAlgorithm);

    clearProgressState();
    clearRecognitionTracking();
    setInputMode(false);
    setScrambleMode(false);

    expectedMovesRef.current = prepared.moves.map(sanitizeMove);
    let previousPattern = basePattern;
    patternStatesRef.current = expectedMovesRef.current.map((move) => {
      previousPattern = previousPattern.applyMove(move);
      return fixOrientation(previousPattern);
    });
    // Rebuild the hash index in lockstep so `handleSmartcubeMove` can do O(1) lookups
    // instead of an O(n) `isIdentical` scan across pattern states.
    patternHashMapRef.current.clear();
    for (let i = 0; i < patternStatesRef.current.length; i += 1) {
      const hash = hashKPattern(patternStatesRef.current[i]);
      // First occurrence wins so the earliest matching index is returned when a
      // repeated pattern appears (rare but possible, e.g. A2 following A).
      if (!patternHashMapRef.current.has(hash)) {
        patternHashMapRef.current.set(hash, i);
      }
    }

    if (countdownEnabled) {
      setDisplayAlg('');
      setTimerState('IDLE');
      startCountdown(() => {
        revealTrainingCase(prepared.displayAlgorithm, normalizedAlgorithm, trainOptions);
      });
      return;
    }

    revealTrainingCase(prepared.displayAlgorithm, normalizedAlgorithm, trainOptions);
  }

  useEffect(() => {
    const nextSelectedIds = selectedCases.map((selectedCase) => selectedCase.id);
    const timeAttackChanged = previousTimeAttackRef.current !== options.timeAttack;
    const randomOrderChanged = previousRandomOrderRef.current !== options.randomOrder;
    const prioritizeSlowChanged = previousPrioritizeSlowCasesRef.current !== options.prioritizeSlowCases;
    const selectionModeChanged = previousSelectionChangeModeRef.current !== options.selectionChangeMode;

    if (
      arraysEqual(previousSelectedIdsRef.current, nextSelectedIds)
      && !timeAttackChanged
      && !randomOrderChanged
      && !prioritizeSlowChanged
      && !selectionModeChanged
    ) {
      return;
    }

    const previousSelectedIds = previousSelectedIdsRef.current;
    previousSelectedIdsRef.current = nextSelectedIds;
    previousTimeAttackRef.current = options.timeAttack;
    previousRandomOrderRef.current = options.randomOrder;
    previousPrioritizeSlowCasesRef.current = options.prioritizeSlowCases;
    previousSelectionChangeModeRef.current = options.selectionChangeMode;

    if (selectedCases.length === 0) {
      cancelCountdown();
      selectedQueueRef.current = [];
      selectedQueueCopyRef.current = [];
      clearTimeAttackSession();
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

    if (options.timeAttack) {
      clearTimeAttackSession();
      resetTimeAttackQueue();
      retrainQueueHead(selectedQueueRef.current[0] ?? null);
      return;
    }

    if (timeAttackChanged || randomOrderChanged || prioritizeSlowChanged || selectionModeChanged) {
      clearTimeAttackSession();
      selectedQueueRef.current = buildQueue(selectedCases, options.prioritizeSlowCases);
      selectedQueueCopyRef.current = [];
      retrainQueueHead(selectedQueueRef.current[0] ?? null);
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
  }, [options.prioritizeSlowCases, options.randomOrder, options.selectionChangeMode, options.timeAttack, selectedCases]);

  function stopAndRecordSolve(timeMs: number) {
    const algId = originalAlgIdRef.current || 'default-alg-id';
    const completedCaseId = currentCaseRef.current?.id;
    let finalTime = Math.round(timeMs);

    if (options.smartcubeConnected && solutionMovesRef.current.length > 0) {
      const fittedMoves = cubeTimestampLinearFit(solutionMovesRef.current);
      const lastMove = fittedMoves.at(-1);
      if (lastMove?.cubeTimestamp != null && Number.isFinite(lastMove.cubeTimestamp) && lastMove.cubeTimestamp > 0) {
        finalTime = lastMove.cubeTimestamp;
      }
    }

    if (options.timeAttack) {
      timeAttackCaseTimesRef.current = [...timeAttackCaseTimesRef.current, finalTime];
      if (completedCaseId) {
        persistSolveResult(completedCaseId, finalTime);
        incrementPracticeCount(completedCaseId);
      }
      isKeyboardTimerActiveRef.current = false;

      const nextInitialPattern = patternStatesRef.current.at(-1) ?? initialPatternRef.current;
      const nextCase = advanceTimeAttackQueue();
      if (nextCase) {
        void trainCurrent(nextInitialPattern, {
          algorithm: nextCase.algorithm,
          statsScopeId: getTimeAttackStatsScopeId(),
          startTimerImmediately: true,
          trackRecognition: true,
        });
        return;
      }

      const totalWallTime = timeAttackSessionStartRef.current == null
        ? finalTime
        : Math.round(performance.now() - timeAttackSessionStartRef.current);
      persistExecutionOnlyResult(algId, totalWallTime);
      setTimeAttackLastRuns(algId, appendLimitedTime(
        { wallMs: totalWallTime, caseTimes: timeAttackCaseTimesRef.current },
        getTimeAttackLastRuns(algId),
      ));

      incrementPracticeCount(algId);
      const totalTimeText = formatTimerTimestamp(totalWallTime);
      setTimerText(totalTimeText);
      setTimerStateInternal('STOPPED');
      prepareNextTimeAttack(totalTimeText);
      return;
    }

    persistSolveResult(algId, finalTime);
    incrementPracticeCount(algId);
    setTimerText(formatTimerTimestamp(finalTime));
    setTimerStateInternal('STOPPED');
    isKeyboardTimerActiveRef.current = false;

    if (!options.smartcubeConnected) {
      const nextInitialPattern = patternStatesRef.current.at(-1) ?? initialPatternRef.current;

      switchToNextAlgorithm();

      const nextCase = selectedQueueRef.current[0] ?? null;
      if (nextCase) {
        void trainCurrent(nextInitialPattern, {
          algorithm: nextCase.algorithm,
          statsScopeId: nextCase.id,
          trackRecognition: true,
        });
      }
    }
  }

  function abortRunningAttempt() {
    if (timerState !== 'RUNNING') {
      return;
    }
    if (options.timeAttack) {
      prepareNextTimeAttack();
      return;
    }
    timerStartRef.current = null;
    isKeyboardTimerActiveRef.current = false;
    solutionMovesRef.current = [];
    setTimerText('0:00.000');
    setTimerStateInternal('READY');
  }

  function completeOrAbortRunningAttempt() {
    if (timerState !== 'RUNNING') {
      return;
    }

    if (!options.timeAttack && !options.smartcubeConnected) {
      stopAndRecordSolve(getElapsedMs());
      return;
    }

    abortRunningAttempt();
  }

  function activateTimer() {
    if (countdownActive) {
      return;
    }
    if (timerState === 'STOPPED' || timerState === 'IDLE' || timerState === 'READY') {
      setTimerState('RUNNING');
    } else {
      completeOrAbortRunningAttempt();
    }
  }

  function handleSpaceKeyDown() {
    if (inputMode || countdownActive) {
      return;
    }

    if (timerState === 'STOPPED' || timerState === 'IDLE') {
      setTimerText('0:00.000');
      setTimerState('READY');
    } else if (timerState === 'RUNNING') {
      ignoreNextSpaceKeyUpRef.current = true;
      completeOrAbortRunningAttempt();
    } else if (timerState === 'READY' && !isKeyboardTimerActiveRef.current) {
      setTimerText('0:00.000');
    }
  }

  function handleSpaceKeyUp() {
    if (inputMode || countdownActive) {
      return;
    }

    if (ignoreNextSpaceKeyUpRef.current) {
      ignoreNextSpaceKeyUpRef.current = false;
      isKeyboardTimerActiveRef.current = false;
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
    if (inputMode || scrambleMode || countdownActive || patternStatesRef.current.length === 0) {
      return false;
    }

    if (isBugged) {
      return false;
    }

    const capturedMoves = rawMoves && rawMoves.length > 0
      ? rawMoves
      : [{ face: -1, direction: 0, move, localTimestamp: null, cubeTimestamp: null }];
    if (firstActionAtRef.current == null && shouldTrackRecognitionRef.current) {
      const firstLocalTimestamp = capturedMoves
        .map((entry) => entry.localTimestamp)
        .find((timestamp): timestamp is number => timestamp != null && Number.isFinite(timestamp));
      if (firstLocalTimestamp != null) {
        firstActionAtRef.current = firstLocalTimestamp;
      }
    }
    if (timerState === 'READY') {
      setTimerState('RUNNING');
    }
    lastMovesRef.current = [
      ...lastMovesRef.current,
      ...capturedMoves.map((entry) => entry.move),
    ].slice(-256);
    if (timerState === 'RUNNING' || timerState === 'READY' || timerState === 'STOPPED') {
      solutionMovesRef.current = [...solutionMovesRef.current, ...capturedMoves];
    }

    const patternAfterMove = fixOrientation(currentPattern);
    if (patternStatesRef.current.length > 0 && currentMoveIndex === 0 && initialPatternRef.current?.isIdentical(patternAfterMove)) {
      resetAttemptStateKeepAlgorithm();
      return false;
    }

    const nextExpectedIdx = currentMoveIndex + 1;
    let matchedIndex: number | null = null;

    // Fast path: the user made the expected next move. Keep the direct
    // `isIdentical` check first — it's the common case and cheaper than hashing
    // when it hits.
    if (
      nextExpectedIdx >= 0
      && nextExpectedIdx < patternStatesRef.current.length
      && patternAfterMove.isIdentical(patternStatesRef.current[nextExpectedIdx])
    ) {
      matchedIndex = nextExpectedIdx;
    } else {
      // Fallback: O(1) hash lookup against all known pattern states.
      const hash = hashKPattern(patternAfterMove);
      const hit = patternHashMapRef.current.get(hash);
      if (hit !== undefined) {
        matchedIndex = hit;
      }
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
        const completedPattern = patternAfterMove;
        initialPatternRef.current = completedPattern;
        setCurrentMoveIndex(0);
        stopAndRecordSolve(getElapsedMs());

        if (options.smartcubeConnected && !options.timeAttack) {
          switchToNextAlgorithm();
          const nextCase = selectedQueueRef.current[0] ?? null;
          if (nextCase) {
            void trainCurrent(completedPattern, {
              algorithm: nextCase.algorithm,
              statsScopeId: nextCase.id,
              trackRecognition: true,
            });
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
    cancelCountdown();
    clearProgressState();
    clearRecognitionTracking();
    setScrambleMode(true);
  }

  function resetDrill() {
    cancelCountdown();
    clearProgressState();
    clearRecognitionTracking();
    clearStatsIdentity();
    clearTimeAttackSession();
    initialPatternRef.current = null;
    setInputMode(true);
    setScrambleMode(false);
    setCurrentCase(null);
    setAlgInputState('');
    setDisplayAlg('');
    setTimerText('');
    setTimerState('IDLE');
    setVisualResetKey((v) => v + 1);
  }

  function setKeepInitialState(value: boolean) {
    keepInitialStateRef.current = value;
  }

  const stableSetAlgInput = useStableCallback(setAlgInput);
  const stableClearFailedCounts = useStableCallback(clearFailedCounts);
  const stableEnterInputMode = useStableCallback(enterInputMode);
  const stableTrainCurrent = useStableCallback(trainCurrent);
  const stableSetTimerState = useStableCallback(setTimerState);
  const stableActivateTimer = useStableCallback(activateTimer);
  const stableHandleSpaceKeyDown = useStableCallback(handleSpaceKeyDown);
  const stableHandleSpaceKeyUp = useStableCallback(handleSpaceKeyUp);
  const stableHandleSmartcubeMove = useStableCallback(handleSmartcubeMove);
  const stableStopAndRecordSolve = useStableCallback(stopAndRecordSolve);
  const stableAbortRunningAttempt = useStableCallback(abortRunningAttempt);
  const stableGetElapsedMs = useStableCallback(getElapsedMs);
  const stablePrepareForScramble = useStableCallback(prepareForScramble);
  const stableResetDrill = useStableCallback(resetDrill);
  const stableSetKeepInitialState = useStableCallback(setKeepInitialState);

  return useMemo(() => ({
    inputMode,
    scrambleMode,
    timerState,
    timerText,
    countdownActive,
    countdownValue,
    visualResetKey,
    algInput,
    displayAlg,
    currentCase,
    currentAlgName: options.timeAttack ? 'Time Attack' : currentCase?.name ?? '',
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
    timeAttackMode: options.timeAttack,
    timeAttackActive: timeAttackProgress.active,
    timeAttackCurrentCaseNumber: timeAttackProgress.currentCaseNumber,
    timeAttackTotalCases: timeAttackProgress.totalCases,
    setAlgInput: stableSetAlgInput,
    clearFailedCounts: stableClearFailedCounts,
    enterInputMode: stableEnterInputMode,
    trainCurrent: stableTrainCurrent,
    setTimerState: stableSetTimerState,
    activateTimer: stableActivateTimer,
    handleSpaceKeyDown: stableHandleSpaceKeyDown,
    handleSpaceKeyUp: stableHandleSpaceKeyUp,
    handleSmartcubeMove: stableHandleSmartcubeMove,
    stopAndRecordSolve: stableStopAndRecordSolve,
    abortRunningAttempt: stableAbortRunningAttempt,
    getElapsedMs: stableGetElapsedMs,
    prepareForScramble: stablePrepareForScramble,
    resetDrill: stableResetDrill,
    setKeepInitialState: stableSetKeepInitialState,
  }), [
    algInput,
    currentCase,
    displayAlg,
    displayState.fixText,
    displayState.moves,
    failedCounts,
    fixVisible,
    flashRequest,
    helpTone,
    inputMode,
    countdownActive,
    countdownValue,
    options.timeAttack,
    practiceCounts,
    scrambleMode,
    selectedCases,
    stableAbortRunningAttempt,
    stableActivateTimer,
    stableClearFailedCounts,
    stableEnterInputMode,
    stableGetElapsedMs,
    stableHandleSmartcubeMove,
    stableHandleSpaceKeyDown,
    stableHandleSpaceKeyUp,
    stablePrepareForScramble,
    stableResetDrill,
    stableSetAlgInput,
    stableSetKeepInitialState,
    stableSetTimerState,
    stableStopAndRecordSolve,
    stableTrainCurrent,
    stats,
    statsAlgId,
    timerState,
    timerText,
    timeAttackProgress.active,
    timeAttackProgress.currentCaseNumber,
    timeAttackProgress.totalCases,
    visualResetKey,
  ]);
}
