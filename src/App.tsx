import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type ComponentType,
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
import { getStickeringForCategory } from './lib/stickering';
import { deleteAlgorithm, getBestTime, getSavedAlgorithms, removeAlgorithmTimesStorage } from './lib/storage';
import { usePracticeToggles } from './hooks/usePracticeToggles';
import { useTrainingGraphs } from './hooks/useTrainingGraphs';
import { averageOfFiveTimeNumber } from './lib/case-cards';
import { patternToPlayerAlg } from './lib/scramble';
import {
  HamburgerIcon,
} from './components/Icons';
import { ImportFileInput } from './components/ImportFileInput';
import { MenuHelpIcon, MenuNewAlgIcon, MenuOptionsIcon, MenuPracticeIcon } from './components/MenuNavIcons';
import { PracticeView } from './views/PracticeView';
import { OptionsView } from './views/OptionsView';
import { HelpView } from './views/HelpView';
import { trainingViewStore } from './state/trainingViewStore';

type MenuView = 'practice' | 'new-alg' | 'options' | 'help';

const MENU_ITEMS: Array<{ id: MenuView; label: string; Icon: ComponentType }> = [
  { id: 'practice', label: 'Practice', Icon: MenuPracticeIcon },
  { id: 'new-alg', label: 'New Alg', Icon: MenuNewAlgIcon },
  { id: 'options', label: 'Options', Icon: MenuOptionsIcon },
  { id: 'help', label: 'Help', Icon: MenuHelpIcon },
];

export function App() {
  const [activeView, setActiveView] = useState<MenuView>('practice');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDumbcubeHelp, setShowDumbcubeHelp] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');
  const [infoVisible, setInfoVisible] = useState(false);
  const [showTimesInsteadOfGraph, setShowTimesInsteadOfGraph] = useState(false);
  const [isMoveMasked, setIsMoveMasked] = useState(false);
  const [mainCubeStickeringDeferred, setMainCubeStickeringDeferred] = useState(true);
  const [scrambleStartAlg, setScrambleStartAlg] = useState('');
  const [acknowledgedDisconnectToken, setAcknowledgedDisconnectToken] = useState(0);
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);
  const [algEditorVisible, setAlgEditorVisible] = useState(false);
  const hideAlgEditorTimeoutRef = useRef<number | null>(null);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const menuItemsRef = useRef<HTMLDivElement | null>(null);
  const isTouchScrollingRef = useRef(false);
  const lastAutoScrambleKeyRef = useRef('');
  const lastProcessedScrambleMoveRef = useRef('');
  const lastProcessedInputMoveRef = useRef('');
  const lastProcessedPracticeMoveRef = useRef('');
  const lastProcessedAnyMoveKeyRef = useRef('');
  const handledGyroSupportSessionRef = useRef('');
  const flashingIndicatorTimeoutRef = useRef<number | null>(null);
  const [isFlashingIndicatorVisible, setIsFlashingIndicatorVisible] = useState(false);
  const [flashingIndicatorColor, setFlashingIndicatorColor] = useState<'gray' | 'red' | 'green'>('gray');
  const caseLibrary = useCaseLibrary();
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
  const options = useAppSettings();
  const practiceToggles = usePracticeToggles();
  const selectedCases = useMemo(
    () => selectedCaseIds
      .map((selectedCaseId) => caseCards.find((card) => card.id === selectedCaseId) ?? null)
      .filter((card): card is (typeof caseCards)[number] => card !== null),
    [caseCards, selectedCaseIds],
  );
  const smartcube = useSmartcubeConnection(options.gyroscope);
  const training = useTrainingState(selectedCases, selectedCategory, {
    selectionChangeMode,
    randomizeAUF: practiceToggles.randomizeAUF,
    randomOrder: practiceToggles.randomOrder,
    prioritizeSlowCases: practiceToggles.prioritizeSlowCases,
    prioritizeFailedCases: practiceToggles.prioritizeFailedCases,
    smartcubeConnected: smartcube.connected,
    currentPattern: smartcube.currentPattern,
    statsRefreshToken,
  });
  const scramble = useScrambleState();
  const algorithmActions = useAlgorithmImportExport(reloadSavedAlgorithms);
  const selectedStickering = mainCubeStickeringDeferred && !options.fullStickering
    ? 'full'
    : getStickeringForCategory(selectedCategory || 'PLL', options.fullStickering);
  const optionsVisible = activeView === 'options';
  const helpVisible = activeView === 'help';
  const newAlgVisible = activeView === 'new-alg';
  const optionsMounted = optionsVisible || infoVisible;
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
    // In input-mode with a connected smartcube, we want the virtual cube to animate turns.
    // We seed the cube's state once from the current pattern, then animate incremental moves via appendMove.
    const pattern = smartcube.currentPattern;
    if (!training.inputMode || !smartcube.connected || !pattern) {
      setInputModeSmartcubeSeed(null);
      return;
    }

    const seedKey = `${smartcube.disconnectToken}:${training.visualResetKey}`;
    setInputModeSmartcubeSeed((current) => {
      if (current?.key === seedKey) {
        return current;
      }
      const alg = patternToPlayerAlg(pattern);
      return { key: seedKey, alg };
    });
  }, [smartcube.connected, smartcube.currentPattern, smartcube.disconnectToken, training.inputMode, training.visualResetKey]);

  // `mainCubeAlg` represents the *algorithm shown on the main cube*, which only
  // changes at case transitions — not per move. Deps intentionally exclude
  // `smartcube.currentPattern`, which fires on every physical move and would
  // otherwise rerun this memo (and the Alg.fromString(...).invert() work) each
  // time, even when the returned string is identical.
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

    if (!training.displayAlg.trim()) {
      return '';
    }

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
  useTrainingGraphs(
    training.currentCase,
    training.displayAlg || training.algInput,
    training.statsAlgId,
    `${statsRefreshToken}:${activeStatsSolveCount}`,
  );

  // Mirror move-list specific fields into an external store so only the move list rerenders per-move.
  useEffect(() => {
    trainingViewStore.setState({
      displayMoves: training.displayMoves,
      fixText: training.fixText,
      fixVisible: training.fixVisible,
      helpTone: training.helpTone,
    });
  }, [training.displayMoves, training.fixText, training.fixVisible, training.helpTone]);

  // Sync case-card slices into the store so CaseCard instances subscribe via selectors
  // and don't re-render on every training state change.
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
    caseCardStore.setState({ fullStickering: options.fullStickering });
  }, [options.fullStickering]);

  // Refresh per-card best/ao5 from localStorage whenever solves may have changed.
  useEffect(() => {
    const bestTimes: Record<string, number | null> = {};
    const ao5Times: Record<string, number | null> = {};
    for (const card of caseCards) {
      bestTimes[card.id] = getBestTime(card.id);
      ao5Times[card.id] = averageOfFiveTimeNumber(card.id);
    }
    caseCardStore.setState({ bestTimes, ao5Times });
  }, [activeStatsSolveCount, caseCards, statsRefreshToken]);

  // Keep action wrappers pointing at the latest closures.
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

    if (!smartcube.gyroSupportResolved) {
      return;
    }

    const sessionKey = `${smartcube.disconnectToken}:${smartcube.info.deviceMAC}:${smartcube.info.gyroSupported}`;
    if (handledGyroSupportSessionRef.current === sessionKey) {
      return;
    }

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
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const clickedToggle = menuToggleRef.current?.contains(target) ?? false;
      const clickedMenu = menuItemsRef.current?.contains(target) ?? false;

      if (!clickedToggle && !clickedMenu) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('click', onDocumentClick);
    return () => {
      document.removeEventListener('click', onDocumentClick);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || smartcube.connected || training.inputMode) {
        return;
      }

      event.preventDefault();
      training.handleSpaceKeyDown();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space' || smartcube.connected || training.inputMode) {
        return;
      }

      event.preventDefault();
      const shouldFlash = training.timerState === 'READY';
      training.handleSpaceKeyUp();
      if (shouldFlash) {
        showFlashingIndicator('gray', 200);
      }
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
    if (!training.flashRequest) {
      return;
    }

    showFlashingIndicator(training.flashRequest.color, training.flashRequest.durationMs);
  }, [showFlashingIndicator, training.flashRequest]);

  useEffect(() => {
    if (options.flashingIndicatorEnabled) {
      return;
    }

    if (flashingIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(flashingIndicatorTimeoutRef.current);
      flashingIndicatorTimeoutRef.current = null;
    }

    setIsFlashingIndicatorVisible(false);
  }, [options.flashingIndicatorEnabled]);

  useEffect(() => {
    if (!deleteSuccessMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDeleteSuccessMessage('');
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deleteSuccessMessage]);

  useEffect(() => {
    if (!options.alwaysScrambleTo) {
      lastAutoScrambleKeyRef.current = '';
      return;
    }

    if (training.inputMode || training.timerState !== 'READY') {
      return;
    }

    const key = `${training.statsAlgId}:${training.displayAlg || training.algInput}`;
    if (lastAutoScrambleKeyRef.current === key) {
      return;
    }

    lastAutoScrambleKeyRef.current = key;
    void scramble.startScrambleTo(
      training.displayAlg || training.algInput,
      training.currentCase,
      smartcube.currentPattern,
      practiceToggles.randomizeAUF,
    ).then((started) => {
      if (!started) {
        return;
      }

      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
      setScrambleStartAlg(smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : '');
      lastProcessedScrambleMoveRef.current = '';
      training.prepareForScramble();
    });
  }, [
    options.alwaysScrambleTo,
    practiceToggles.randomizeAUF,
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
    if (!smartcube.lastProcessedMove) {
      return;
    }

    const moveKey = smartcube.lastProcessedMove.key;

    // Global dedupe: UI state transitions can cause this effect to re-run with the same moveKey.
    // We should never process the same smartcube move twice, regardless of mode.
    if (lastProcessedAnyMoveKeyRef.current === moveKey) {
      return;
    }
    lastProcessedAnyMoveKeyRef.current = moveKey;

    if (training.inputMode) {
      if (lastProcessedInputMoveRef.current === moveKey) {
        return;
      }
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
      if (lastProcessedPracticeMoveRef.current === moveKey) {
        return;
      }
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

    if (lastProcessedScrambleMoveRef.current === moveKey) {
      return;
    }
    lastProcessedScrambleMoveRef.current = moveKey;
    lastProcessedPracticeMoveRef.current = '';

    void scramble.advanceScramble(smartcube.lastProcessedMove.move, smartcube.currentPattern).then((completed) => {
      if (completed) {
        training.setKeepInitialState(true);
        void training.trainCurrent(smartcube.currentPattern, {
          algorithm: scramble.targetAlgorithm,
          preserveDisplayedAlgorithm: true,
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
  ]);

  const selectView = useCallback((view: MenuView) => {
    setActiveView(view);
    setMenuOpen(false);
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

  const handleTouchStart = useCallback(() => {
    isTouchScrollingRef.current = false;
  }, []);

  const handleTouchMove = useCallback(() => {
    isTouchScrollingRef.current = true;
  }, []);

  const handleTimerActivation = useCallback(() => {
    if (smartcube.connected || training.inputMode) {
      return;
    }

    const shouldFlash =
      training.timerState === 'STOPPED' ||
      training.timerState === 'IDLE' ||
      training.timerState === 'READY';

    if (shouldFlash) {
      showFlashingIndicator('gray', 200);
    }

    training.activateTimer();
  }, [
    showFlashingIndicator,
    smartcube.connected,
    training.activateTimer,
    training.inputMode,
    training.timerState,
  ]);

  const handleTouchEnd = useCallback(() => {
    if (!isTouchScrollingRef.current) {
      handleTimerActivation();
    }
  }, [handleTimerActivation]);

  const handleDeleteAlgorithms = useCallback(() => {
    if (!selectedCategory || selectedCases.length === 0) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete the selected algorithms?')) {
      return;
    }

    for (const selectedCase of selectedCases) {
      deleteAlgorithm(selectedCategory, selectedCase.algorithm);
    }

    training.clearFailedCounts();
    reloadSavedAlgorithms();
    setDeleteMode(false);
    setDeleteSuccessMessage('Algorithms deleted successfully');
    setStatsRefreshToken((value) => value + 1);
  }, [reloadSavedAlgorithms, selectedCategory, selectedCases, training.clearFailedCounts]);

  const handleDeleteTimes = useCallback(() => {
    if (selectedCases.length === 0) {
      return;
    }

    if (!window.confirm('Are you sure you want to remove the times for the selected algorithms?')) {
      return;
    }

    for (const selectedCase of selectedCases) {
      removeAlgorithmTimesStorage(selectedCase.id);
    }

    training.clearFailedCounts();
    setStatsRefreshToken((value) => value + 1);
  }, [selectedCases, training.clearFailedCounts]);

  const handleEditCurrentAlgorithm = useCallback(() => {
    const algorithm = training.currentCase?.algorithm || training.displayAlg || training.algInput;
    if (!algorithm.trim()) {
      return;
    }

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
    if (algorithmActions.submitSave(training.displayAlg || training.algInput) && nextCategory) {
      training.clearFailedCounts();
      setStatsRefreshToken((value) => value + 1);
      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
      setSelectedCategory(nextCategory);
      setMainCubeStickeringDeferred(false);
    }
  }, [
    algorithmActions.categoryInput,
    algorithmActions.submitSave,
    setSelectedCategory,
    smartcube.disconnectToken,
    training.algInput,
    training.clearFailedCounts,
    training.displayAlg,
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
    const ok = algorithmActions.submitSave(training.algInput);
    if (ok && nextCategory) {
      training.clearFailedCounts();
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
  }, [
    algorithmActions.submitSave,
    algorithmActions.categoryInput,
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
          const firstCategory = Object.keys(getSavedAlgorithms())[0] ?? '';
          setSelectedCategory(firstCategory);
          setStatsRefreshToken((value) => value + 1);
        }
      });
    }
    event.currentTarget.value = '';
  }, [algorithmActions.importFromFile, setSelectedCategory, training.clearFailedCounts]);

  return (
    <div className="app-shell">
      <div className="app-main-row">
        <div id="menu-container" className="menu-container">
          <div id="menu-toggle-container" className="menu-toggle-container">
            <button
              id="menu-toggle"
              ref={menuToggleRef}
              className="menu-toggle"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              <HamburgerIcon />
            </button>
            <div
              id="menu-items"
              ref={menuItemsRef}
              className={`menu-items ${menuOpen ? '' : 'menu-items-mobile-hidden'}`.trim()}
            >
              {MENU_ITEMS.map((item, index) => {
                const selected = activeView === item.id;
                const radiusClass =
                  index === 0
                    ? 'menu-item-top'
                    : index === MENU_ITEMS.length - 1
                      ? 'menu-item-bottom'
                      : '';
                const MenuIcon = item.Icon;

                return (
                  <button
                    key={item.id}
                    id={
                      item.id === 'practice'
                        ? 'load-alg'
                        : item.id === 'new-alg'
                          ? 'save-alg'
                          : item.id === 'options'
                            ? 'show-options'
                            : 'show-help'
                    }
                    className={`menu-item ${radiusClass} ${selected ? 'selected' : ''}`.trim()}
                    type="button"
                    onClick={() => selectView(item.id)}
                  >
                    <span className="menu-item-icon-wrap" aria-hidden>
                      <MenuIcon />
                    </span>
                    <span className="menu-item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div id="app" className="app-content">
          {!isReady ? <div className="footer">Loading saved data…</div> : null}
          <PracticeView
            topVisible={activeView === 'practice' || activeView === 'new-alg'}
            practiceVisible={activeView === 'practice'}
            options={options}
            practiceToggles={practiceToggles}
            caseLibrary={caseLibrary}
            training={training}
            scramble={scramble}
            smartcube={smartcube}
            algorithmActions={algorithmActions}
            showAlgEditor={algEditorVisible}
            onAlgEditorSave={newAlgVisible ? handleNewAlgSave : handleInlineAlgSave}
            onAlgEditorCancel={newAlgVisible ? handleNewAlgCancel : handleInlineAlgCancel}
            mainCubeAlg={mainCubeAlg}
            selectedStickering={selectedStickering}
            setAcknowledgedDisconnectToken={setAcknowledgedDisconnectToken}
            setMainCubeStickeringDeferred={setMainCubeStickeringDeferred}
            lastProcessedScrambleMoveRef={lastProcessedScrambleMoveRef}
            setScrambleStartAlg={setScrambleStartAlg}
            setDeleteMode={setDeleteMode}
            deleteMode={deleteMode}
            deleteSuccessMessage={deleteSuccessMessage}
            handleDeleteAlgorithms={handleDeleteAlgorithms}
            handleDeleteTimes={handleDeleteTimes}
            showTimesInsteadOfGraph={showTimesInsteadOfGraph}
            setShowTimesInsteadOfGraph={setShowTimesInsteadOfGraph}
            isMoveMasked={isMoveMasked}
            setIsMoveMasked={setIsMoveMasked}
            handleEditCurrentAlgorithm={handleEditCurrentAlgorithm}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            handleTouchTimerActivation={handleTimerActivation}
            isFlashingIndicatorVisible={isFlashingIndicatorVisible}
            flashingIndicatorColor={flashingIndicatorColor}
            smartcubeAppendMoveKey={smartcubeAppendMoveKey}
            smartcubeAppendMove={smartcubeAppendMove}
          />

          {helpVisible ? (
            <HelpView
              visible
              showDumbcubeHelp={showDumbcubeHelp}
              setShowDumbcubeHelp={setShowDumbcubeHelp}
            />
          ) : null}

          <ImportFileInput onChange={handleImportFileChange} />

          {optionsMounted ? (
            <OptionsView
              visible={optionsVisible}
              infoVisible={infoVisible}
              setInfoVisible={setInfoVisible}
              options={options}
              smartcube={smartcube}
              algorithmActions={algorithmActions}
            />
          ) : null}
        </div>
      </div>

      <div id="footer" className="footer">
        <p>
          Cubedex has been created with ♥ by <a href="https://twitter.com/pof" target="_blank" rel="noreferrer">Pau Oliva Fora</a> using <a href="https://github.com/poliva/smartcube-web-bluetooth" target="_blank" rel="noreferrer">smartcube-web-bluetooth</a> and <a href="https://github.com/cubing/cubing.js" target="_blank" rel="noreferrer">cubing.js</a>.
        </p>
        <p>
          The <a href="https://github.com/poliva/cubedex" target="_blank" rel="noreferrer">source code</a> is available on GitHub, feel free to contribute by sending a PR or <a href="https://ko-fi.com/cubedex" target="_blank" rel="noreferrer">buy me a coffee</a>.
        </p>
      </div>
    </div>
  );
}
