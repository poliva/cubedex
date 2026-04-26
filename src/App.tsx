import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { caseCardStore, setCaseCardActions } from './state/caseCardStore';
import { useCaseLibrary } from './hooks/useCaseLibrary';
import { useTrainingState } from './hooks/useTrainingState';
import { useAppSettings } from './hooks/useAppSettings';
import { useScrambleState } from './hooks/useScrambleState';
import { useSmartcubeConnection } from './hooks/useSmartcubeConnection';
import { useAlgorithmImportExport } from './hooks/useAlgorithmImportExport';
import { useIsMobile } from './hooks/useIsMobile';
import { getStickeringForCategory } from './lib/stickering';
import { invalidatePreview } from './lib/preview-cache';
import { deleteAlgorithm, expandNotation, getBestTime, getSavedAlgorithms, removeAlgorithmTimesStorage } from './lib/storage';
import { usePracticeToggles } from './hooks/usePracticeToggles';
import { useTrainingGraphs } from './hooks/useTrainingGraphs';
import { averageOfFiveTimeNumber } from './lib/case-cards';
import { patternToPlayerAlg } from './lib/scramble';
import { ImportFileInput } from './components/ImportFileInput';
import { PracticeView } from './views/PracticeView';
import { CasesView } from './views/CasesView';
import { OptionsView } from './views/OptionsView';
import { HelpView } from './views/HelpView';
import { NewAlgView } from './views/NewAlgView';
import { Sidebar } from './components/shell/Sidebar';
import { DesktopTopbar } from './components/shell/DesktopTopbar';
import { MobileTopbar } from './components/shell/MobileTopbar';
import { BottomTabBar } from './components/shell/BottomTabBar';
import { Footer } from './components/shell/Footer';
import { trainingViewStore } from './state/trainingViewStore';

type MenuView = 'practice' | 'cases' | 'new-alg' | 'options' | 'help';

export function App() {
  const [activeView, setActiveView] = useState<MenuView>('practice');
  const [showDumbcubeHelp, setShowDumbcubeHelp] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');
  const [infoVisible, setInfoVisible] = useState(false);
  const [isMoveMasked, setIsMoveMasked] = useState(false);
  const [showTimesInsteadOfGraph, setShowTimesInsteadOfGraph] = useState(false);
  const [mainCubeStickeringDeferred, setMainCubeStickeringDeferred] = useState(true);
  const [scrambleStartAlg, setScrambleStartAlg] = useState('');
  const [acknowledgedDisconnectToken, setAcknowledgedDisconnectToken] = useState(0);
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [algEditorVisible, setAlgEditorVisible] = useState(false);
  const hideAlgEditorTimeoutRef = useRef<number | null>(null);
  const lastAutoScrambleKeyRef = useRef('');
  const lastProcessedScrambleMoveRef = useRef('');
  const lastProcessedInputMoveRef = useRef('');
  const lastProcessedPracticeMoveRef = useRef('');
  const lastProcessedAnyMoveKeyRef = useRef('');
  const handledGyroSupportSessionRef = useRef('');
  const flashingIndicatorTimeoutRef = useRef<number | null>(null);
  const [isFlashingIndicatorVisible, setIsFlashingIndicatorVisible] = useState(false);
  const [flashingIndicatorColor, setFlashingIndicatorColor] = useState<'gray' | 'red' | 'green'>('gray');
  const [orientationResetState, setOrientationResetState] = useState<{ token: number; alg: string | null }>({ token: 0, alg: null });

  const isMobile = useIsMobile();
  const options = useAppSettings();
  const practiceToggles = usePracticeToggles();
  const caseLibrary = useCaseLibrary({
    autoUpdateLearningState: options.autoUpdateLearningState,
    smartReviewScheduling: practiceToggles.smartReviewScheduling,
    reviewRefreshToken,
  });
  const {
    isReady,
    selectedCategory,
    caseCards,
    selectedCaseIds,
    selectionChangeMode,
    setSelectedCategory,
    toggleCaseSelection,
    cycleCaseLearnedState,
    reloadSavedAlgorithms,
  } = caseLibrary;
  const selectedCases = useMemo(
    () => selectedCaseIds
      .map((selectedCaseId) => caseCards.find((card) => card.id === selectedCaseId) ?? null)
      .filter((card): card is (typeof caseCards)[number] => card !== null),
    [caseCards, selectedCaseIds],
  );
  const smartcube = useSmartcubeConnection(options.gyroscope);
  const training = useTrainingState(selectedCases, selectedCategory, {
    selectionChangeMode,
    countdownMode: options.countdownMode,
    randomizeAUF: practiceToggles.randomizeAUF,
    randomOrder: practiceToggles.randomOrder,
    timeAttack: practiceToggles.timeAttack,
    prioritizeSlowCases: practiceToggles.prioritizeSlowCases,
    prioritizeFailedCases: practiceToggles.prioritizeFailedCases,
    smartReviewScheduling: practiceToggles.smartReviewScheduling,
    smartcubeConnected: smartcube.connected,
    currentPattern: smartcube.currentPattern,
    statsRefreshToken,
    reviewRefreshToken,
    onReviewRecorded: () => setReviewRefreshToken((value) => value + 1),
  });
  const scramble = useScrambleState();
  const algorithmActions = useAlgorithmImportExport(reloadSavedAlgorithms);
  const selectedStickering = mainCubeStickeringDeferred && !options.fullStickering
    ? 'full'
    : getStickeringForCategory(selectedCategory || 'PLL', options.fullStickering);
  const optionsVisible = activeView === 'options';
  const optionsDeviceInfoOpen = activeView === 'options' && infoVisible;

  const showFlashingIndicator = useCallback((color: 'gray' | 'red' | 'green', durationMs: number) => {
    if (!options.flashingIndicatorEnabled && color !== 'gray') {
      return;
    }
    setFlashingIndicatorColor(color);
    setIsFlashingIndicatorVisible(true);
    if (flashingIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(flashingIndicatorTimeoutRef.current);
    }
    flashingIndicatorTimeoutRef.current = window.setTimeout(() => {
      setIsFlashingIndicatorVisible(false);
      flashingIndicatorTimeoutRef.current = null;
    }, durationMs);
  }, [options.flashingIndicatorEnabled]);

  const [inputModeSmartcubeSeed, setInputModeSmartcubeSeed] = useState<{ key: string; alg: string } | null>(null);
  useEffect(() => {
    const pattern = smartcube.currentPattern;
    if (!training.inputMode || !smartcube.connected || !pattern) {
      setInputModeSmartcubeSeed(null);
      return;
    }
    const seedKey = `${smartcube.disconnectToken}:${training.visualResetKey}`;
    setInputModeSmartcubeSeed((current) => {
      if (current?.key === seedKey) return current;
      const alg = patternToPlayerAlg(pattern);
      return { key: seedKey, alg };
    });
  }, [smartcube.connected, smartcube.currentPattern, smartcube.disconnectToken, training.inputMode, training.visualResetKey]);

  // `mainCubeAlg` intentionally excludes `smartcube.currentPattern` from deps — see CLAUDE.md.
  const mainCubeAlg = useMemo(() => {
    if (!smartcube.connected && smartcube.disconnectToken !== acknowledgedDisconnectToken) {
      return '';
    }
    if (scramble.scrambleMode && smartcube.connected) {
      return scrambleStartAlg;
    }
    if (training.inputMode) {
      if (smartcube.connected && inputModeSmartcubeSeed) {
        return inputModeSmartcubeSeed.alg;
      }
      return training.displayAlg.trim()
        ? Alg.fromString(training.displayAlg).invert().toString()
        : '';
    }
    if (!training.displayAlg.trim()) return '';
    return Alg.fromString(training.displayAlg).invert().toString();
  }, [
    acknowledgedDisconnectToken,
    inputModeSmartcubeSeed,
    scramble.scrambleMode,
    scrambleStartAlg,
    smartcube.connected,
    smartcube.disconnectToken,
    training.displayAlg,
    training.inputMode,
  ]);

  const smartcubeAppendMoveKey = smartcube.lastProcessedMove?.key;
  const smartcubeAppendMove = smartcube.lastProcessedMove?.visualMove;
  const activeStatsSolveCount = training.practiceCounts[training.statsAlgId] ?? 0;
  const selectedCaseSolveCount = selectedCases.reduce(
    (sum, selectedCase) => sum + (training.practiceCounts[selectedCase.id] ?? 0),
    0,
  );
  useTrainingGraphs(
    training.currentCase,
    training.displayAlg || training.algInput,
    training.statsAlgId,
    `${statsRefreshToken}:${activeStatsSolveCount}:${isMobile}:${showTimesInsteadOfGraph}`,
  );

  useEffect(() => {
    trainingViewStore.setState({
      displayMoves: training.displayMoves,
      fixText: training.fixText,
      fixVisible: training.fixVisible,
      helpTone: training.helpTone,
    });
  }, [training.displayMoves, training.fixText, training.fixVisible, training.helpTone]);

  useEffect(() => {
    caseCardStore.setState({
      practiceCounts: training.practiceCounts,
      failedCounts: training.failedCounts,
    });
  }, [training.practiceCounts, training.failedCounts]);

  useEffect(() => {
    caseCardStore.setState({ selectedCaseIds });
  }, [selectedCaseIds]);

  useEffect(() => {
    caseCardStore.setState({ autoUpdateLearningState: options.autoUpdateLearningState });
  }, [options.autoUpdateLearningState]);

  useEffect(() => {
    const bestTimes: Record<string, number | null> = {};
    const ao5Times: Record<string, number | null> = {};
    for (const card of caseCards) {
      bestTimes[card.id] = getBestTime(card.id);
      ao5Times[card.id] = averageOfFiveTimeNumber(card.id);
    }
    caseCardStore.setState({ bestTimes, ao5Times });
  }, [activeStatsSolveCount, caseCards, selectedCaseSolveCount, statsRefreshToken]);

  useEffect(() => {
    setCaseCardActions({
      cycleCaseLearnedState,
      toggleCaseSelection,
      onBeforeToggleCase: () => {
        setAcknowledgedDisconnectToken(smartcube.disconnectToken);
        setMainCubeStickeringDeferred(false);
      },
    });
  }, [cycleCaseLearnedState, toggleCaseSelection, smartcube.disconnectToken]);

  useEffect(() => {
    if (!scramble.scrambleMode) {
      setScrambleStartAlg('');
      lastAutoScrambleKeyRef.current = '';
    }
  }, [scramble.scrambleMode]);

  useEffect(() => {
    if (!smartcube.connected) {
      handledGyroSupportSessionRef.current = '';
      return;
    }
    if (!smartcube.gyroSupportResolved) return;
    const sessionKey = `${smartcube.disconnectToken}:${smartcube.info.deviceMAC}:${smartcube.info.gyroSupported}`;
    if (handledGyroSupportSessionRef.current === sessionKey) return;
    handledGyroSupportSessionRef.current = sessionKey;
    if (smartcube.gyroSupported) {
      options.setGyroscope(true);
    } else if (options.gyroscope) {
      options.setGyroscope(false);
    }
  }, [
    options.gyroscope,
    options.setGyroscope,
    smartcube.connected,
    smartcube.disconnectToken,
    smartcube.gyroSupportResolved,
    smartcube.gyroSupported,
    smartcube.info.deviceMAC,
    smartcube.info.gyroSupported,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || smartcube.connected || training.inputMode) return;
      event.preventDefault();
      training.handleSpaceKeyDown();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space' || smartcube.connected || training.inputMode) return;
      event.preventDefault();
      const shouldFlash = training.timerState === 'READY';
      training.handleSpaceKeyUp();
      if (shouldFlash) showFlashingIndicator('gray', 200);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [
    showFlashingIndicator,
    smartcube.connected,
    training.handleSpaceKeyDown,
    training.handleSpaceKeyUp,
    training.inputMode,
    training.timerState,
  ]);

  useEffect(() => {
    return () => {
      if (flashingIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(flashingIndicatorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!training.flashRequest) return;
    showFlashingIndicator(training.flashRequest.color, training.flashRequest.durationMs);
  }, [showFlashingIndicator, training.flashRequest]);

  useEffect(() => {
    if (options.flashingIndicatorEnabled) return;
    if (flashingIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(flashingIndicatorTimeoutRef.current);
      flashingIndicatorTimeoutRef.current = null;
    }
    setIsFlashingIndicatorVisible(false);
  }, [options.flashingIndicatorEnabled]);

  useEffect(() => {
    if (!deleteSuccessMessage) return;
    const timeoutId = window.setTimeout(() => setDeleteSuccessMessage(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [deleteSuccessMessage]);

  useEffect(() => {
    if (!options.alwaysScrambleTo) {
      lastAutoScrambleKeyRef.current = '';
      return;
    }
    if (practiceToggles.timeAttack) {
      lastAutoScrambleKeyRef.current = '';
      return;
    }
    if (training.inputMode || training.timerState !== 'READY') return;
    const key = `${training.statsAlgId}:${training.displayAlg || training.algInput}`;
    if (lastAutoScrambleKeyRef.current === key) return;
    lastAutoScrambleKeyRef.current = key;
    void scramble.startScrambleTo(
      training.displayAlg || training.algInput,
      training.currentCase,
      smartcube.currentPattern,
      practiceToggles.randomizeAUF,
    ).then((started) => {
      if (!started) return;
      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
      setScrambleStartAlg(smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : '');
      lastProcessedScrambleMoveRef.current = '';
      training.prepareForScramble();
    });
  }, [
    options.alwaysScrambleTo,
    practiceToggles.randomizeAUF,
    practiceToggles.timeAttack,
    scramble.startScrambleTo,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.algInput,
    training.currentCase,
    training.displayAlg,
    training.inputMode,
    training.prepareForScramble,
    training.statsAlgId,
    training.timerState,
  ]);

  useEffect(() => {
    if (!smartcube.lastProcessedMove) return;
    const moveKey = smartcube.lastProcessedMove.key;
    if (lastProcessedAnyMoveKeyRef.current === moveKey) return;
    lastProcessedAnyMoveKeyRef.current = moveKey;

    if (training.inputMode) {
      if (lastProcessedInputMoveRef.current === moveKey) return;
      lastProcessedInputMoveRef.current = moveKey;
      lastProcessedPracticeMoveRef.current = '';
      const currentValue = training.algInput.trim();
      const nextValue = Alg.fromString(`${currentValue} ${smartcube.lastProcessedMove.rawMoves.map((entry) => entry.move).join(' ')}`.trim())
        .experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 })
        .toString();
      training.setAlgInput(nextValue);
      return;
    }

    if (!scramble.scrambleMode) {
      if (lastProcessedPracticeMoveRef.current === moveKey) return;
      lastProcessedPracticeMoveRef.current = moveKey;
      if (smartcube.lastProcessedMove.currentPattern) {
        training.handleSmartcubeMove(
          smartcube.lastProcessedMove.currentPattern,
          smartcube.lastProcessedMove.move,
          smartcube.lastProcessedMove.rawMoves,
          smartcube.lastProcessedMove.isBugged,
        );
      }
      return;
    }

    if (lastProcessedScrambleMoveRef.current === moveKey) return;
    lastProcessedScrambleMoveRef.current = moveKey;
    lastProcessedPracticeMoveRef.current = '';

    void scramble.advanceScramble(smartcube.lastProcessedMove.move, smartcube.currentPattern).then((completed) => {
      if (completed) {
        training.setKeepInitialState(true);
        void training.trainCurrent(smartcube.currentPattern, {
          algorithm: scramble.targetAlgorithm,
          preserveDisplayedAlgorithm: true,
          statsScopeId: training.timeAttackMode ? training.statsAlgId : training.currentCase?.id,
          trackRecognition: true,
        });
      }
    });
  }, [
    scramble.advanceScramble,
    scramble.scrambleMode,
    scramble.targetAlgorithm,
    smartcube.currentPattern,
    smartcube.lastProcessedMove,
    training.algInput,
    training.handleSmartcubeMove,
    training.inputMode,
    training.setAlgInput,
    training.setKeepInitialState,
    training.trainCurrent,
    training.timeAttackMode,
    training.statsAlgId,
  ]);

  const selectView = useCallback((view: MenuView) => {
    setActiveView(view);
    setInfoVisible(false);
    if (hideAlgEditorTimeoutRef.current != null) {
      window.clearTimeout(hideAlgEditorTimeoutRef.current);
      hideAlgEditorTimeoutRef.current = null;
    }
    setAlgEditorVisible(view === 'new-alg');

    if (view === 'new-alg') {
      training.enterInputMode(training.algInput || training.displayAlg);
      scramble.clearScramble();
      algorithmActions.clearForm();
      algorithmActions.clearMessages();
    }

    if (view === 'practice') {
      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
      if (scramble.scrambleMode && !options.alwaysScrambleTo) {
        scramble.clearScramble();
        lastProcessedScrambleMoveRef.current = '';
      }
      void training.trainCurrent(smartcube.currentPattern);
    }

    if (view !== 'practice') {
      lastProcessedScrambleMoveRef.current = '';
    }
  }, [
    algorithmActions.clearMessages,
    options.alwaysScrambleTo,
    scramble.clearScramble,
    scramble.scrambleMode,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.algInput,
    training.displayAlg,
    training.enterInputMode,
    training.trainCurrent,
  ]);

  const isTouchScrollingRef = useRef(false);
  const _handleTouchStart = useCallback(() => { isTouchScrollingRef.current = false; }, []);
  const _handleTouchMove = useCallback(() => { isTouchScrollingRef.current = true; }, []);

  const handleTimerActivation = useCallback(() => {
    if (smartcube.connected || training.inputMode || training.countdownActive) return;
    const shouldFlash =
      training.timerState === 'STOPPED' ||
      training.timerState === 'IDLE' ||
      training.timerState === 'READY';
    if (shouldFlash) showFlashingIndicator('gray', 200);
    training.activateTimer();
  }, [
    showFlashingIndicator,
    smartcube.connected,
    training.activateTimer,
    training.countdownActive,
    training.inputMode,
    training.timerState,
  ]);

  const handleTouchEnd = useCallback(() => {
    if (!isTouchScrollingRef.current) handleTimerActivation();
  }, [handleTimerActivation]);

  const handleResetOrientation = useCallback(() => {
    smartcube.resetOrientation();
    setOrientationResetState((current) => ({
      token: current.token + 1,
      alg: smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : null,
    }));
  }, [smartcube.resetOrientation, smartcube.currentPattern]);

  const handleResetGyro = useCallback(() => {
    smartcube.resetGyro();
  }, [smartcube.resetGyro]);

  const handleDeleteAlgorithms = useCallback(() => {
    if (!selectedCategory || selectedCases.length === 0) return;
    if (!window.confirm('Are you sure you want to delete the selected algorithms?')) return;
    void (async () => {
      for (const selectedCase of selectedCases) {
        // Invalidate previews before deleting
        invalidatePreview(selectedCase.algorithm);
        await deleteAlgorithm(selectedCategory, selectedCase.algorithm);
      }
      training.clearFailedCounts();
      reloadSavedAlgorithms();
      setDeleteMode(false);
      setDeleteSuccessMessage('Algorithms deleted successfully');
      setStatsRefreshToken((value) => value + 1);
    })();
  }, [reloadSavedAlgorithms, selectedCategory, selectedCases, training.clearFailedCounts]);

  const handleDeleteTimes = useCallback(() => {
    if (selectedCases.length === 0) return;
    if (!window.confirm('Are you sure you want to remove the times for the selected algorithms?')) return;
    for (const selectedCase of selectedCases) {
      removeAlgorithmTimesStorage(selectedCase.id);
    }
    training.clearFailedCounts();
    setStatsRefreshToken((value) => value + 1);
    setReviewRefreshToken((value) => value + 1);
  }, [selectedCases, training.clearFailedCounts]);

  const handleEditCurrentAlgorithm = useCallback(() => {
    const algorithm = training.currentCase?.algorithm || training.displayAlg || training.algInput;
    if (!algorithm.trim()) return;

    if (training.currentCase) {
      algorithmActions.setCategoryInput(training.currentCase.category);
      algorithmActions.setSubsetInput(training.currentCase.subset);
      algorithmActions.setAlgNameInput(training.currentCase.name);
      algorithmActions.clearMessages();
    }

    if (hideAlgEditorTimeoutRef.current != null) {
      window.clearTimeout(hideAlgEditorTimeoutRef.current);
      hideAlgEditorTimeoutRef.current = null;
    }
    setAlgEditorVisible(true);
    training.enterInputMode(algorithm);
    queueMicrotask(() => {
      document.getElementById('alg-input')?.focus();
    });
  }, [
    algorithmActions,
    training.algInput,
    training.currentCase,
    training.displayAlg,
    training.enterInputMode,
  ]);

  const handleNewAlgSave = useCallback(() => {
    const nextCategory = algorithmActions.categoryInput.trim();
    const algToSave = activeView === 'new-alg' ? training.algInput : (training.displayAlg || training.algInput);
    const algToSaveNormalized = expandNotation(algToSave);
    // Invalidate previews before saving - this ensures fresh previews after algorithm changes
    invalidatePreview(algToSaveNormalized);
    void algorithmActions.submitSave(algToSave).then((saved) => {
      if (saved && nextCategory) {
        training.clearFailedCounts();
        reloadSavedAlgorithms();
        setStatsRefreshToken((value) => value + 1);
        setAcknowledgedDisconnectToken(smartcube.disconnectToken);
        setSelectedCategory(nextCategory);
        setMainCubeStickeringDeferred(false);
      }
      if (saved) {
        setAlgEditorVisible(false);
        setActiveView('practice');
        void training.trainCurrent(smartcube.currentPattern);
      }
    });
  }, [
    activeView,
    algorithmActions.categoryInput,
    algorithmActions.submitSave,
    reloadSavedAlgorithms,
    setSelectedCategory,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.algInput,
    training.clearFailedCounts,
    training.displayAlg,
    training.trainCurrent,
  ]);

  const handleNewAlgCancel = useCallback(() => {
    algorithmActions.clearMessages();
    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
    if (hideAlgEditorTimeoutRef.current != null) {
      window.clearTimeout(hideAlgEditorTimeoutRef.current);
      hideAlgEditorTimeoutRef.current = null;
    }
    setAlgEditorVisible(false);
    setActiveView('practice');
    void training.trainCurrent(smartcube.currentPattern);
  }, [
    algorithmActions.clearMessages,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.trainCurrent,
  ]);

  const handleInlineAlgSave = useCallback(() => {
    const nextCategory = algorithmActions.categoryInput.trim();
    const algToSave = training.algInput;
    const algToSaveNormalized = expandNotation(algToSave);
    // Invalidate previews before saving - this ensures fresh previews after algorithm changes
    invalidatePreview(algToSaveNormalized);
    void algorithmActions.submitSave(algToSave).then((ok) => {
      if (ok && nextCategory) {
        training.clearFailedCounts();
        reloadSavedAlgorithms();
        setStatsRefreshToken((value) => value + 1);
        setAcknowledgedDisconnectToken(smartcube.disconnectToken);
        setSelectedCategory(nextCategory);
        setMainCubeStickeringDeferred(false);
      }
      if (ok) {
        void training.trainCurrent(smartcube.currentPattern);
        if (hideAlgEditorTimeoutRef.current != null) {
          window.clearTimeout(hideAlgEditorTimeoutRef.current);
        }
        hideAlgEditorTimeoutRef.current = window.setTimeout(() => {
          hideAlgEditorTimeoutRef.current = null;
          setAlgEditorVisible(false);
        }, 3100);
      }
    });
  }, [
    algorithmActions.submitSave,
    algorithmActions.categoryInput,
    reloadSavedAlgorithms,
    setSelectedCategory,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.algInput,
    training.clearFailedCounts,
    training.trainCurrent,
  ]);

  const handleInlineAlgCancel = useCallback(() => {
    algorithmActions.clearMessages();
    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
    if (hideAlgEditorTimeoutRef.current != null) {
      window.clearTimeout(hideAlgEditorTimeoutRef.current);
      hideAlgEditorTimeoutRef.current = null;
    }
    setAlgEditorVisible(false);
    void training.trainCurrent(smartcube.currentPattern);
  }, [
    algorithmActions.clearMessages,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.trainCurrent,
  ]);

  const handleImportFileChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    const file = event.target.files?.[0];
    if (file) {
      void algorithmActions.importFromFile(file).then((imported) => {
        if (imported) {
          training.clearFailedCounts();
          reloadSavedAlgorithms();
          const firstCategory = Object.keys(getSavedAlgorithms())[0] ?? '';
          setSelectedCategory(firstCategory);
          setStatsRefreshToken((value) => value + 1);
        }
      });
    }
    event.currentTarget.value = '';
  }, [algorithmActions.importFromFile, reloadSavedAlgorithms, setSelectedCategory, training.clearFailedCounts]);

  const handleBackupImportFileChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    const file = event.target.files?.[0];
    if (file) {
      void algorithmActions.importBackupFromFile(file).then((imported) => {
        if (imported) {
          training.clearFailedCounts();
          reloadSavedAlgorithms();
          const firstCategory = Object.keys(getSavedAlgorithms())[0] ?? '';
          setSelectedCategory(firstCategory);
          setStatsRefreshToken((value) => value + 1);
        }
      });
    }
    event.currentTarget.value = '';
  }, [algorithmActions.importBackupFromFile, reloadSavedAlgorithms, setSelectedCategory, training.clearFailedCounts]);

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', background: 'var(--bg)' } as React.CSSProperties}>
      {/* Sidebar: desktop only */}
      {!isMobile && <Sidebar active={activeView} onNav={selectView} />}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Topbar */}
        {isMobile
          ? (
            <MobileTopbar
              screen={activeView}
              smartcube={smartcube}
              showResetGyro={smartcube.connected && options.gyroscope && smartcube.gyroSupported}
              showResetOrientation={smartcube.connected && (!smartcube.gyroSupported || !options.gyroscope)}
              onResetGyro={handleResetGyro}
              onResetOrientation={handleResetOrientation}
              headerTitleOverride={optionsDeviceInfoOpen ? 'Device Info' : undefined}
              onHeaderBack={optionsDeviceInfoOpen ? () => setInfoVisible(false) : undefined}
              headerBackLabel="Back to options"
            />
          )
          : (
            <DesktopTopbar
              screen={activeView}
              selectedCategory={selectedCategory ?? ''}
              selectedCount={selectedCaseIds.length}
              smartcube={smartcube}
              showResetGyro={smartcube.connected && options.gyroscope && smartcube.gyroSupported}
              showResetOrientation={smartcube.connected && (!smartcube.gyroSupported || !options.gyroscope)}
              onResetGyro={handleResetGyro}
              onResetOrientation={handleResetOrientation}
              headerTitleOverride={optionsDeviceInfoOpen ? 'Device Info' : undefined}
              onHeaderBack={optionsDeviceInfoOpen ? () => setInfoVisible(false) : undefined}
              headerBackLabel="Back to options"
            />
          )
        }

        {!isReady ? (
          <div style={{ padding: '1rem', color: 'var(--fg3)', fontSize: 13 }}>Loading saved data…</div>
        ) : null}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* PracticeView always mounted (training state + cube continuity) */}
          <PracticeView
            visible={activeView === 'practice'}
            options={options}
            practiceToggles={practiceToggles}
            training={training}
            scramble={scramble}
            smartcube={smartcube}
            algorithmActions={algorithmActions}
            showAlgEditor={algEditorVisible}
            onAlgEditorSave={handleInlineAlgSave}
            onAlgEditorCancel={handleInlineAlgCancel}
            mainCubeAlg={mainCubeAlg}
            selectedStickering={selectedStickering}
            setAcknowledgedDisconnectToken={setAcknowledgedDisconnectToken}
            lastProcessedScrambleMoveRef={lastProcessedScrambleMoveRef}
            setScrambleStartAlg={setScrambleStartAlg}
            isMoveMasked={isMoveMasked}
            setIsMoveMasked={setIsMoveMasked}
            handleEditCurrentAlgorithm={handleEditCurrentAlgorithm}
            handleTouchStart={_handleTouchStart}
            handleTouchMove={_handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            handleTouchTimerActivation={handleTimerActivation}
            isFlashingIndicatorVisible={isFlashingIndicatorVisible}
            flashingIndicatorColor={flashingIndicatorColor}
            smartcubeAppendMoveKey={smartcubeAppendMoveKey}
            smartcubeAppendMove={smartcubeAppendMove}
            isMobile={isMobile}
            orientationResetToken={orientationResetState.token}
            orientationResetAlg={orientationResetState.alg}
            showTimesInsteadOfGraph={showTimesInsteadOfGraph}
            setShowTimesInsteadOfGraph={setShowTimesInsteadOfGraph}
          />

          {activeView === 'cases' && (
            <CasesView
              caseLibrary={caseLibrary}
              training={training}
              scramble={scramble}
              smartcube={smartcube}
              deleteMode={deleteMode}
              setDeleteMode={setDeleteMode}
              deleteSuccessMessage={deleteSuccessMessage}
              handleDeleteAlgorithms={handleDeleteAlgorithms}
              handleDeleteTimes={handleDeleteTimes}
              setAcknowledgedDisconnectToken={setAcknowledgedDisconnectToken}
              setMainCubeStickeringDeferred={setMainCubeStickeringDeferred}
              isMobile={isMobile}
              onPracticeSelected={() => selectView('practice')}
            />
          )}

          {activeView === 'new-alg' && (
            <NewAlgView
              visible
              standalone
              algorithmActions={algorithmActions}
              onSave={handleNewAlgSave}
              onCancel={handleNewAlgCancel}
              isMobile={isMobile}
              algInput={training.algInput}
              setAlgInput={training.setAlgInput}
            />
          )}

          {activeView === 'options' && (
            <OptionsView
              visible={optionsVisible}
              infoVisible={infoVisible}
              setInfoVisible={setInfoVisible}
              options={options}
              smartcube={smartcube}
              algorithmActions={algorithmActions}
              isMobile={isMobile}
            />
          )}

          {activeView === 'help' && (
            <HelpView
              visible
              showDumbcubeHelp={showDumbcubeHelp}
              setShowDumbcubeHelp={setShowDumbcubeHelp}
              isMobile={isMobile}
            />
          )}
        </div>

        {/* Footer: desktop only */}
        {!isMobile && <Footer />}
      </main>

      {/* Bottom tabs: mobile only */}
      {isMobile && <BottomTabBar active={activeView} onNav={selectView} />}

      <ImportFileInput id="import-file" onChange={handleImportFileChange} />
      <ImportFileInput id="import-backup-file" onChange={handleBackupImportFileChange} />
    </div>
  );
}
