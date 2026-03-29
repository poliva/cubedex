// ── Test Harness ──────────────────────────────────────────────────────
// Playwright test interface: allows tests to simulate cube moves,
// set up algorithms, and inspect internal state.

import $ from 'jquery';
import { faceletsToPattern, patternToFacelets } from './utils';
import { expandNotation } from './notationHelper';
import { fixOrientation, partialStateEquals } from './faceMasking';
import { buildAlgFaceMap } from './faceMap';
import { S, SOLVED_STATE, _visualMoveLog, _flashLog } from './state';
import { expandSliceDoubles } from './algUtils';
import { resetmasterRepairFaceMap, updateRotationIndicator } from './visualization';

import { setTimerState } from './timer';
import { handleMoveEvent } from './handlers/moveHandler';
import { updateTimesDisplay } from './statsPanel';
import { switchToNextAlgorithm, drawAlgInCube } from './trainer';
import { deleteAlgorithm } from './algorithmStorage';
import { algToId } from './notationHelper';
import { cube3x3x3 } from "cubing/puzzles";

/** Registers the window.__test interface used by Playwright tests. */
export function initTestHarness() {
  (window as any).__test = {
    /** Returns a copy of all visual moves sent since last clearVisualLog(). */
    getVisualLog: (): { move: string; cancel: boolean }[] => [..._visualMoveLog],
    /** Clears the visual move log. */
    clearVisualLog: () => { _visualMoveLog.length = 0; },
    /** Returns a copy of all flash events since last clearFlashLog(). */
    getFlashLog: (): { color: string; duration: number }[] => [..._flashLog],
    /** Clears the flash event log. */
    clearFlashLog: () => { _flashLog.length = 0; },
    /** Returns the move handler debug log. */
    getMoveDebugLog: (): string[] => [...S.moveDebugLog],
    /** Clears the move handler debug log. */
    clearMoveDebugLog: () => { S.moveDebugLog.length = 0; },
    /** Waits until the KPuzzle is initialised and the app is ready for test use. */
    waitForReady: () => cube3x3x3.kpuzzle(),
    /**
     * Sets up an algorithm for testing without going through the full UI flow.
     * Puts the app in test mode (skips S.twistyTracker updates).
     */
    setAlgForTest: (alg: string) => {
      S.__testMode = true;
      S.inputMode = false;
      S.myKpattern = faceletsToPattern(SOLVED_STATE);
      const expandedNotation = expandNotation(alg).split(/\s+/);
      S.displayAlg = [...expandedNotation];
      S.userAlg = expandSliceDoubles(expandedNotation);
      S.originalUserAlg = [...S.userAlg];
      S.currentAlgName = 'Test';
      $('#alg-display').text(S.displayAlg.join(' '));
      S.currentMoveIndex = -1;
      S.badAlg = [];
      S.userActualMoves = [];
      S.hasFailedAlg = false;
      S.hadBadMoveDuringExec = false;
      S.hasTPSFail = false;
      S.scrambleMode = false;
      S.stareDelayActive = false;
      S.pendingSliceVis = null;
      S.reverseSliceBuffer = null;
      S.patternStates = [];
      S.algPatternStates = [];
      S.initialstate = S.myKpattern;
      S.initialPatternState = fixOrientation(S.initialstate);
      S.userAlg.forEach((move, index) => {
        const m = move.replace(/[()]/g, '');
        if (index === 0) S.patternStates[index] = S.initialstate.applyMove(m);
        else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(m);
        S.algPatternStates[index] = S.patternStates[index];
        S.patternStates[index] = fixOrientation(S.patternStates[index]);
      });
      S.desiredEndState = S.patternStates.length > 0 ? S.patternStates[S.patternStates.length - 1] : null;
      setTimerState('READY');
      _visualMoveLog.length = 0;
      S.moveDebugLog.length = 0;
      if (false) console.log(`[MoveHandler] ALG SETUP: alg=[${S.userAlg.join(' ')}], colorRot=${S.colorRotationFaceMap ? JSON.stringify(S.colorRotationFaceMap) : 'null'}, MRM=${JSON.stringify(S.masterRepairFaceMap)}`);
    },
    /**
     * Simulates a GAN cube move. handleMoveEvent manages S.myKpattern internally
     * (Layer 2 - algorithmic state), so we just forward the raw move.
     * Must call setAlgForTest() first.
     */
    simulateMove: async (move: string) => {
      await handleMoveEvent({ type: 'MOVE', move, timeStamp: Date.now() } as any);
    },
    /** Enables/disables the override-alg feature for tests. */
    setOverrideEnabled: (enabled: boolean) => { S.overrideAlgEnabled = enabled; },
    /**
     * Sets the ignore pieces and/or category (stickering) for the current algorithm in tests.
     * Must be called AFTER setAlgForTest(). Optionally also sets overrideAlgEnabled.
     * ignore: semicolon-separated piece names e.g. "BL; BLD"
     * category: e.g. "OLL", "PLL", "F2L"
     */
    setTestAlgConfig: ({ ignore, category, overrideEnabled, algorithm }: { ignore?: string; category?: string; overrideEnabled?: boolean; algorithm?: string }) => {
      if (ignore !== undefined || category !== undefined || algorithm !== undefined) {
        if (S.checkedAlgorithms.length === 0) (S.checkedAlgorithms as any[]).push({ algorithm: '', ignore: '' });
        if (ignore !== undefined) (S.checkedAlgorithms[0] as any).ignore = ignore;
        if (algorithm !== undefined) (S.checkedAlgorithms[0] as any).algorithm = algorithm;
        if (category !== undefined) {
          const $sel = $('#category-select');
          if ($sel.find(`option[value="${category}"]`).length === 0) {
            $sel.append(`<option value="${category}">${category}</option>`);
          }
          $sel.val(category);
        }
      }
      if (overrideEnabled !== undefined) S.overrideAlgEnabled = overrideEnabled;
    },
    /**
     * Sets up the initial case state by applying setupAlg to the solved cube, then rebuilds
     * patternStates and desiredEndState for the currently loaded userAlg from that new start.
     * Use this to simulate starting from a real OLL/PLL/F2L case (not just solved state).
     * Must be called AFTER setAlgForTest().
     */
    setupCaseFromAlg: (setupAlg: string) => {
      let state = faceletsToPattern(SOLVED_STATE);
      const moves = expandSliceDoubles(expandNotation(setupAlg).split(/\s+/));
      for (const m of moves) state = state.applyMove(m.replace(/[()]/g, ''));
      // Normalize orientation so patternToFacelets works (setup may include rotation moves like d)
      state = fixOrientation(state);
      S.initialstate = state;
      S.myKpattern = state;
      S.initialPatternState = fixOrientation(state);
      S.patternStates = [];
      S.algPatternStates = [];
      S.userAlg.forEach((move, index) => {
        const m = move.replace(/[()]/g, '');
        if (index === 0) S.patternStates[index] = S.initialstate.applyMove(m);
        else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(m);
        S.algPatternStates[index] = S.patternStates[index];
        S.patternStates[index] = fixOrientation(S.patternStates[index]);
      });
      S.desiredEndState = S.patternStates.length > 0 ? S.patternStates[S.patternStates.length - 1] : null;
      _visualMoveLog.length = 0;
    },
    /** Enables/disables keepRotation for tests. */
    setKeepRotation: (enabled: boolean) => { S.keepRotationEnabled = enabled; },
    /** Applies a raw rotation to myKpattern without triggering move handling (simulates GAN cube orientation change). */
    applyRawRotation: (move: string) => { S.myKpattern = S.myKpattern.applyMove(move); },
    /**
     * Loads a new algorithm while preserving the current physical state (myKpattern) and
     * masterRepairFaceMap. Used to simulate transitioning between algorithms with keepRotation.
     * initialState: the fixOrientation-normalized state to build pattern states from.
     * If omitted, uses the current myKpattern (fixOrientation'd).
     */
    loadNextAlgForTest: (alg: string) => {
      const expandedNotation = expandNotation(alg).split(/\s+/);
      S.displayAlg = [...expandedNotation];
      S.userAlg = expandSliceDoubles(expandedNotation);
      S.originalUserAlg = [...S.userAlg];
      S.currentMoveIndex = -1;
      S.badAlg = [];
      S.userActualMoves = [];
      S.hasFailedAlg = false;
      S.hadBadMoveDuringExec = false;
      S.hasTPSFail = false;
      S.stareDelayActive = false;
      // Use the current initialstate (set by the completion handler's keepInitialState path)
      // rather than resetting to solved.
      S.initialPatternState = fixOrientation(S.initialstate);
      S.patternStates = [];
      S.algPatternStates = [];
      S.userAlg.forEach((move, index) => {
        const m = move.replace(/[()]/g, '');
        if (index === 0) S.patternStates[index] = S.initialstate.applyMove(m);
        else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(m);
        S.algPatternStates[index] = S.patternStates[index];
        S.patternStates[index] = fixOrientation(S.patternStates[index]);
      });
      S.desiredEndState = S.patternStates.length > 0 ? S.patternStates[S.patternStates.length - 1] : null;
      setTimerState('READY');
      _visualMoveLog.length = 0;
    },
    /** Debug: returns current state info for tracing tests. */
    getDebugInfo: () => ({
      currentMoveIndex: S.currentMoveIndex,
      userAlg: [...S.userAlg],
      displayAlg: [...S.displayAlg],
      algDisplayText: $('#alg-display').text(),
      patternStatesLength: S.patternStates.length,
      myKpatternFacelets: S.myKpattern ? patternToFacelets(fixOrientation(S.myKpattern)) : null,
      patternStates0Facelets: S.patternStates.length > 0 ? patternToFacelets(S.patternStates[0]) : null,
      previousFacelets: S.previousFacelets,
      timerState: S.timerState,
      __testMode: S.__testMode,
      isBugged: S.isBugged,
      badAlg: [...S.badAlg],
      masterRepairFaceMap: { ...S.masterRepairFaceMap },
      keepRotationEnabled: S.keepRotationEnabled,
      lastMoveSuccess: S.lastSolveSuccess,
      hasFailedAlg: S.hasFailedAlg,
      hadBadMoveDuringExec: S.hadBadMoveDuringExec,
      overrideAlgEnabled: S.overrideAlgEnabled,
      resetPracticeEnabled: S.resetPracticeEnabled,
      // All settings for options persistence testing
      showAlgNameEnabled: S.showAlgNameEnabled,
      fullStickeringEnabled: S.fullStickeringEnabled,
      flashingIndicatorEnabled: S.flashingIndicatorEnabled,
      stareDelayEnabled: S.stareDelayEnabled,
      stareDelaySeconds: S.stareDelaySeconds,
      rotateColorsEnabled: S.rotateColorsEnabled,
      colorRotationMode: S.colorRotationMode,
      phantomModeEnabled: S.phantomModeEnabled,
      autoPromoteLearning: S.autoPromoteLearning,
      limitLearningEnabled: S.limitLearningEnabled,
      maxConcurrentLearning: S.maxConcurrentLearning,
      autoPromoteLearned: S.autoPromoteLearned,
      promotionThreshold: S.promotionThreshold,
      retryFailedEnabled: S.retryFailedEnabled,
      countdownModeEnabled: S.countdownModeEnabled,
      countdownSeconds: S.countdownSeconds,
      tpsFailEnabled: S.tpsFailEnabled,
      tpsFailThreshold: S.tpsFailThreshold,
      countdownFailThreshold: S.countdownFailThreshold,
      randomAlgorithms: S.randomAlgorithms,
      prioritizeSlowAlgs: S.prioritizeSlowAlgs,
      prioritizeDifficultAlgs: S.prioritizeDifficultAlgs,
      smartCaseSelection: S.smartCaseSelection,
      randomizeAUF: S.randomizeAUF,
      prioritizeFailedAlgs: S.prioritizeFailedAlgs,
      queueSize: S.queueSize,
      alwaysScrambleTo: S.alwaysScrambleTo,
      gyroscopeEnabled: S.gyroscopeEnabled,
      showCompactGraphEnabled: S.showCompactGraphEnabled,
      showLastCaseTileEnabled: S.showLastCaseTileEnabled,
      showPrevStatsEnabled: S.showPrevStatsEnabled,
      moveDebugLog: [...S.moveDebugLog],
      overrideContainerVisible: $('#alg-override-container').is(':visible'),
      overrideOriginalText: $('#alg-override-original').text(),
      overrideNewText: $('#alg-override-new').text(),
      // Override detection debug: simulate what the !found block would compute
      overrideDebug: (() => {
        if (!S.desiredEndState || !S.myKpattern) return null;
        const category = ($('#category-select').val()?.toString().toLowerCase() || '');
        const effectiveCategory = S.checkedAlgorithms[0]?.masking?.toLowerCase() || category;
        const rawIgnore = S.checkedAlgorithms[0]?.ignore || '';
        const currentState = fixOrientation(S.myKpattern);
        const matchRaw = partialStateEquals(currentState, S.desiredEndState, effectiveCategory, rawIgnore);
        const matchFull = currentState.isIdentical(S.desiredEndState);
        return { category: effectiveCategory, rawIgnore, matchRaw, matchFull };
      })(),
      algFixHtml: $('#alg-fix').html() || '',
      colorRotationFaceMap: S.colorRotationFaceMap ? { ...S.colorRotationFaceMap } : null,
      queueAlgNames: S.checkedAlgorithms.map(a => a.name),
      copyAlgNames: S.checkedAlgorithmsCopy.map(a => a.name),
    }),
    /** Resets masterRepairFaceMap to identity (simulates clicking #rotation-reset-btn). */
    resetRotation: () => {
      resetmasterRepairFaceMap();
      updateRotationIndicator();
    },
    /** Sets the colorRotationMode directly (e.g. 'none', 'vertical', 'upside', 'any'). */
    setColorRotationMode: (mode: string) => { S.colorRotationMode = mode as any; },
    /** Sets currentColorRotation string and re-draws the algorithm. */
    setCurrentColorRotation: (rotation: string) => {
      S.currentColorRotation = rotation;
      drawAlgInCube();
    },
    /** Re-draws the current algorithm in the cube (calls drawAlgInCube). */
    redraw: () => { drawAlgInCube(); },
    /** Sets a deterministic colorRotationFaceMap for tests.
     *  rotation: "y", "y'", "y2", or "" (null/disabled). */
    __setColorRotation: (rotation: string) => {
      S.colorRotationMode = 'vertical';
      S.colorRotationFaceMap = rotation
        ? buildAlgFaceMap([rotation], 0)
        : null;
    },
    /** Sets showPrevStatsEnabled and previous-case data for tests. */
    setShowPrevStats: (enabled: boolean, prevAlgId?: string, prevAlgName?: string, prevAlgMoves?: string) => {
      S.showPrevStatsEnabled = enabled;
      if (prevAlgId !== undefined) S.previousAlgId = prevAlgId;
      if (prevAlgName !== undefined) S.previousAlgName = prevAlgName;
      if (prevAlgMoves !== undefined) S.previousAlgMoves = prevAlgMoves;
    },
    /** Sets showAlgNameEnabled for tests. */
    setShowAlgName: (enabled: boolean) => { S.showAlgNameEnabled = enabled; },
    /** Sets the current alg display name for tests. */
    setCurrentAlgName: (name: string) => { S.currentAlgName = name; },
    /** Directly sets the practice queue for testing switchToNextAlgorithm logic.
     *  Each string becomes both the algorithm and the name for that entry. */
    setQueue: (queueNames: string[], copyNames: string[]) => {
      S.checkedAlgorithms = queueNames.map(n => ({ algorithm: n, name: n, bestTime: 0 }));
      S.checkedAlgorithmsCopy = copyNames.map(n => ({ algorithm: n, name: n, bestTime: 0 }));
      if (S.checkedAlgorithms.length > 0) {
        S.userAlg = ['R'];
        S.originalUserAlg = ['R'];
        S.displayAlg = ['R'];
        S.currentAlgName = S.checkedAlgorithms[0].name;
      }
    },
    /** Calls switchToNextAlgorithm with skipFlashing=true for queue-state tests. */
    advanceQueue: () => { switchToNextAlgorithm(true); },
    /** Triggers updateTimesDisplay to refresh the stats panel. */
    refreshStats: () => { updateTimesDisplay(); },
    /** Returns all stats-related localStorage keys for a given alg string. */
    getStatsForAlg: (alg: string) => {
      const id = algToId(alg);
      return {
        algId: id,
        lastTimes: localStorage.getItem('LastTimes-' + id),
        lastTimesCD: localStorage.getItem('LastTimes-CD-' + id),
        best: localStorage.getItem('Best-' + id),
        bestCD: localStorage.getItem('Best-CD-' + id),
        failedCount: localStorage.getItem('FailedCount-' + id),
        successCount: localStorage.getItem('SuccessCount-' + id),
        lastResults: localStorage.getItem('LastResults-' + id),
        consecutiveCorrect: localStorage.getItem('ConsecutiveCorrect-' + id),
        learned: localStorage.getItem('Learned-' + id),
      };
    },
    /** Calls deleteAlgorithm for a category+alg. */
    deleteAlgorithm: (category: string, algorithm: string) => {
      deleteAlgorithm(category, algorithm);
    },
    /** Simulates the stats-modal reset for a given alg string. */
    resetStatsForAlg: (alg: string) => {
      const id = algToId(alg);
      localStorage.removeItem('LastTimes-' + id);
      localStorage.removeItem('LastTimes-CD-' + id);
      localStorage.removeItem('Best-' + id);
      localStorage.removeItem('Best-CD-' + id);
      localStorage.removeItem('FailedCount-' + id);
      localStorage.removeItem('SuccessCount-' + id);
      localStorage.removeItem('LastResults-' + id);
      localStorage.removeItem('ConsecutiveCorrect-' + id);
    },
    /** Sets tpsFailEnabled and tpsFailThreshold for tests. */
    setTPSFail: (enabled: boolean, threshold?: number) => {
      S.tpsFailEnabled = enabled;
      if (threshold !== undefined) S.tpsFailThreshold = threshold;
    },
  };
}
