import { TwistyPlayer } from 'cubing/twisty';
import { KPattern } from 'cubing/kpuzzle';
import { SmartCubeConnection, SmartCubeEvent } from 'smartcube-web-bluetooth';

export type SmartCubeMove = {
  face: number;
  direction: number;
  move: string;
  localTimestamp: number | null;
  cubeTimestamp: number | null;
};
import * as THREE from 'three';
import { Subscription } from 'rxjs';

// ── Algorithm interface ────────────────────────────────────────────────
export interface Algorithm {
  algorithm: string;
  name: string;
  bestTime: number;
  ignore?: string;
  masking?: string;
}

// ── Solved state constant ──────────────────────────────────────────────
export const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

// ── Identity quaternion ────────────────────────────────────────────────
export const HOME_ORIENTATION = new THREE.Quaternion(); // identity

// ── Visual move log (always same array instance) ───────────────────────
export const _visualMoveLog: { move: string; cancel: boolean }[] = [];

// ── Flash log (always same array instance) ─────────────────────────────
export const _flashLog: { color: string; duration: number }[] = [];

// ── Mutable shared state ───────────────────────────────────────────────
// All mutable state lives on this single object so that ES module importers
// can read AND write properties (plain `export let` bindings are read-only
// from the importer side).
export const S = {
  // TwistyPlayer instances (assigned in index.ts after creation)
  twistyPlayer: null as unknown as TwistyPlayer,
  twistyTracker: null as unknown as TwistyPlayer,

  // GAN Bluetooth connection
  conn: null as SmartCubeConnection | null,
  lastMoves: [] as SmartCubeMove[],
  solutionMoves: [] as SmartCubeMove[],

  // Algorithm state
  userAlg: [] as string[],
  displayAlg: [] as string[],
  originalUserAlg: [] as string[],
  scrambleToAlg: [] as string[],
  badAlg: [] as string[],
  patternStates: [] as KPattern[],
  algPatternStates: [] as KPattern[],
  initialPatternState: null as KPattern | null,
  initialstate: null as unknown as KPattern,
  desiredEndState: null as KPattern | null,
  currentMoveIndex: 0,
  inputMode: true,
  scrambleMode: false,
  userActualMoves: [] as string[],
  pendingOverridePattern: null as KPattern | null,

  // Editing state
  editingAlgId: '',
  lastCompletedAlgStr: '',
  editingOriginalAlg: '',
  editingSetupAlg: '',

  // Practice queue
  checkedAlgorithms: [] as Algorithm[],
  checkedAlgorithmsCopy: [] as Algorithm[],
  currentAlgName: '',

  // Mistake / failure tracking
  showMistakesTimeout: null as unknown as ReturnType<typeof setTimeout>,
  hasShownFlashingIndicator: false,
  hasFailedAlg: false,
  hadBadMoveDuringExec: false,
  hasTPSFail: false,
  retryFailedEnabled: localStorage.getItem('retryFailed') === 'true',
  previousFixHtmlLength: 0,

  // Pattern state helpers
  keepInitialState: false,
  previousFacelets: '',
  isBugged: false,
  __testMode: false,

  // Cube state from tracker
  myKpattern: null as unknown as KPattern,
  cubeStateInitialized: false,
  lastCompletedCase: null as Algorithm | null,
  previousAlgId: '' as string,
  previousAlgName: '' as string,
  previousAlgMoves: '' as string,

  // Timer
  timerState: 'IDLE' as 'IDLE' | 'READY' | 'RUNNING' | 'STOPPED',
  currentTimerValue: 0,
  localTimer: null as Subscription | null,

  // Orientation / gyroscope
  cubeQuaternion: HOME_ORIENTATION.clone() as THREE.Quaternion,
  hasGyroData: false,
  virtualOrientation: new THREE.Quaternion(),
  basis: null as THREE.Quaternion | null,

  // THREE.js scene references
  twistyScene: null as unknown as THREE.Scene,
  twistyVantage: null as any,

  // Mirror view
  twistyMirror: null as TwistyPlayer | null,
  twistyMirrorScene: null as THREE.Scene | null,
  twistyMirrorVantage: null as any,
  mirrorOrbitListener: null as (() => void) | null,

  // Visualization fix flag
  forceFix: false,

  // Settings: learning / progression
  maxConcurrentLearning: parseInt(localStorage.getItem('maxConcurrentLearning') || '4'),
  limitLearningEnabled: localStorage.getItem('limitLearningEnabled') !== 'false',
  autoPromoteLearning: localStorage.getItem('autoPromoteLearning') !== 'false',
  autoPromoteLearned: localStorage.getItem('autoPromoteLearned') !== 'false',
  promotionThreshold: parseInt(localStorage.getItem('promotionThreshold') || '10'),

  // Settings: display / UX
  colorRotationMode: (localStorage.getItem('rotateColorsMode') || 'none') as string,
  colorRotationFrequency: parseInt(localStorage.getItem('colorRotationFrequency') || '0'),  // 0 = on queue rotation (default), else every N cases
  colorRotationCounter: 0,  // counts case presentations since last rotation change
  get rotateColorsEnabled() { return this.colorRotationMode !== 'none'; },
  showLastCaseTileEnabled: localStorage.getItem('showLastCaseTile') === 'true',
  showLastTimeEnabled: localStorage.getItem('showLastTime') !== 'false',
  showCompactGraphEnabled: localStorage.getItem('showCompactGraph') !== 'false',
  showPrevStatsEnabled: localStorage.getItem('showPrevStats') === 'true',
  tpsFailEnabled: localStorage.getItem('tpsFailEnabled') !== 'false',
  tpsFailThreshold: parseFloat(localStorage.getItem('tpsFailThreshold') || '1'),
  countdownFailThreshold: parseFloat(localStorage.getItem('countdownFailThreshold') || '3'),
  stareDelayEnabled: localStorage.getItem('stareDelay') === 'true',
  stareDelaySeconds: parseFloat(localStorage.getItem('stareDelaySeconds') || '3'),
  stareDelayTimer: null as ReturnType<typeof setTimeout> | null,
  stareDelayActive: false,
  lastSolveTime: null as number | null,
  lastSolveSuccess: null as boolean | null,
  phantomModeEnabled: localStorage.getItem('phantomMode') === 'true',
  phantomModeActive: false,

  // Settings: practice order
  randomAlgorithms: false,
  randomizeAUF: false,
  prioritizeSlowAlgs: false,
  prioritizeFailedAlgs: false,
  prioritizeDifficultAlgs: false,
  smartCaseSelection: false,
  queueSize: 0, // 0 = auto (use old formula), otherwise fixed value

  // Settings: alg masking
  isMoveMasked: false,
  currentRotatedIgnore: undefined as string | undefined,
  currentMasking: undefined as string | undefined,

  // Settings: feature toggles
  fullStickeringEnabled: false,
  flashingIndicatorEnabled: true,
  showAlgNameEnabled: true,
  alwaysScrambleTo: false,
  overrideAlgEnabled: false,
  resetPracticeEnabled: false,
  keepRotationEnabled: localStorage.getItem('keepRotation') === 'true',

  // Master repair face map: accumulated rotation compensation between algorithms.
  // Maps GAN face -> canonical face. Identity when no rotation.
  masterRepairFaceMap: { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" } as Record<string, string>,

  // Pending slice visualization: first face move of a potential slice held back.
  pendingSliceVis: null as { visualMove: string; logicalMove: string; isUndo: boolean } | null,
  // Auto-flush timeout for the pending slice buffer.
  pendingSliceVisTimeout: null as ReturnType<typeof setTimeout> | null,

  // Buffer for reverse-direction slice double execution (e.g. M'M' for M2).
  // Collects face-component moves until the full double is completed or broken.
  reverseSliceBuffer: null as string[] | null,

  // Color rotation face map: transforms visual moves when rotateColors is active.
  // Built from the random y-rotation prepended to the display alg.
  colorRotationFaceMap: null as Record<string, string> | null,
  // Inverse of the current color rotation (used to rotate dimmed facelets for correct visual dimming).
  colorRotationInverse: '' as string,
  currentDisplayAlg: '' as string,
  // Current color rotation y-move (persists within an iteration, re-randomized on queue wrap).
  currentColorRotation: '' as string,

  // Countdown mode
  countdownModeEnabled: false,
  countdownSeconds: 3,
  countdownTimer: null as ReturnType<typeof setTimeout> | null,
  savedAlgDisplayHtml: '',
  solveUsedCountdown: false,

  // Keyboard timer
  isKeyboardTimerActive: false,
  isScrolling: false,

  // Gyroscope
  gyroscopeEnabled: true,

  // Slice orientation: tracks accumulated orientation from slice moves for visual remapping when gyro is disabled.
  // Maps canonical face -> sliced frame face. Identity when no slices have been performed.
  sliceOrientation: { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" } as Record<string, string>,

  // Slice input buffer: when gyro is disabled, holds a single face move for up to 100ms
  // to detect paired face moves that form a slice (e.g. F' + B = S).
  sliceBuffer: null as { event: SmartCubeEvent; timer: ReturnType<typeof setTimeout> } | null,

  // Move debug log of handler debug log: verbose trace for debugging move handling.  
  moveDebugLog: [] as string[],

  // Chart instances (stats modal)
  modalExecChart: null as any,
  modalRecexecChart: null as any,

  // Filter debounce
  filterChangeTimeout: null as ReturnType<typeof setTimeout> | null,
  batchingSubsetChanges: false,
};
