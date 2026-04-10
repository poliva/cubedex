import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { TwistyCube } from './components/TwistyCube';
import { useLegacyBootstrap } from './hooks/useLegacyBootstrap';
import { useTrainingState } from './hooks/useTrainingState';
import { useLegacyOptions } from './hooks/useLegacyOptions';
import { useScrambleState } from './hooks/useScrambleState';
import { useSmartcubeConnection } from './hooks/useSmartcubeConnection';
import { useLegacyManagement } from './hooks/useLegacyManagement';
import { getLegacyStickering } from './lib/legacy-stickering';
import { deleteAlgorithm, getBestTime, getSavedAlgorithms, removeAlgorithmTimesStorage } from './lib/legacy-storage';
import { usePracticeToggles } from './hooks/usePracticeToggles';
import { useLegacyCharts } from './hooks/useLegacyCharts';
import { averageOfFiveTimeNumber, averageTimeString, bestTimeString, makeTimeParts, type CaseCardData } from './lib/legacy-algorithms';
import { patternToPlayerAlg } from './lib/legacy-scramble';
import {
  BookOpenIcon,
  BookClosedGreenIcon,
  BookClosedOrangeIcon,
  HamburgerIcon,
  PlayIcon,
  StopIcon,
  ScatterIcon,
  BluetoothIcon,
  EyeIcon,
  EyeSlashIcon,
} from './components/Icons';
import { LegacySwitch } from './components/LegacySwitch';
import { MenuHelpIcon, MenuNewAlgIcon, MenuOptionsIcon, MenuPracticeIcon } from './components/MenuNavIcons';

type MenuView = 'practice' | 'new-alg' | 'options' | 'help';

const MENU_ITEMS: Array<{ id: MenuView; label: string; Icon: ComponentType }> = [
  { id: 'practice', label: 'Practice', Icon: MenuPracticeIcon },
  { id: 'new-alg', label: 'New Alg', Icon: MenuNewAlgIcon },
  { id: 'options', label: 'Options', Icon: MenuOptionsIcon },
  { id: 'help', label: 'Help', Icon: MenuHelpIcon },
];

function isVisible(activeView: MenuView, view: MenuView) {
  return activeView === view;
}

function formatHistoryMetric(time: number | null) {
  if (!time) {
    return '-';
  }

  const parts = makeTimeParts(time);
  const minutesPart = parts.minutes > 0 ? `${parts.minutes}:` : '';
  return `${minutesPart}${parts.seconds.toString(10).padStart(2, '0')}.${parts.milliseconds.toString(10).padStart(3, '0')}`;
}

function CaseCubePreview({
  alg,
  visualization,
  stickering,
  setupAnchor,
  enabled,
}: {
  alg: string;
  visualization: string;
  stickering: string;
  setupAnchor: 'start' | 'end';
  enabled: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    if (!enabled) {
      setIsActive(false);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setIsActive(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsActive(entry.isIntersecting);
      },
      { rootMargin: '0px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled]);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {isActive ? (
        <TwistyCube
          alg={alg}
          sizePx={240}
          visualization={visualization}
          hintFacelets="none"
          controlPanel="none"
          experimentalStickering={stickering}
          setupAnchor={setupAnchor}
          cameraLatitude={25}
          cameraLongitude={-35}
          background="none"
          dragInput="none"
          enableExternalOrientationLoop={false}
          nudgeRenderOnMount
          className="twisty-case-host"
        />
      ) : (
        <div className="twisty-case-host" />
      )}
    </div>
  );
}

function VirtualizedCaseGrid({
  cards,
  renderCaseCard,
}: {
  cards: CaseCardData[];
  renderCaseCard: (card: CaseCardData, index: number, style?: CSSProperties) => ReactElement;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerTopRef = useRef<number>(0);
  const [viewport, setViewport] = useState<{ scrollY: number; vh: number; width: number }>({
    scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
    vh: typeof window !== 'undefined' ? window.innerHeight : 0,
    width: 0,
  });

  function measureContainerTop() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    containerTopRef.current = rect.top + window.scrollY;
  }

  useLayoutEffect(() => {
    measureContainerTop();
  }, [viewport.width, cards.length]);

  useEffect(() => {
    function scheduleUpdate() {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        measureContainerTop();
        setViewport((v) => ({
          ...v,
          scrollY: window.scrollY,
          vh: window.innerHeight,
        }));
      });
    }

    function onScrollOrResize() {
      scheduleUpdate();
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setViewport((v) => (v.width === nextWidth ? v : { ...v, width: nextWidth }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gap = 16;
  // Keep in sync with `.case-wrapper` padding + inner content height.
  // Virtualization needs a fixed height; too small causes bottom clipping (toggle flush to card bottom).
  const itemHeight = 300;
  const overscanRows = 4;
  const cols = Math.max(1, Math.floor((viewport.width + gap) / (260 + gap)));
  const itemWidth = cols > 0 ? Math.max(220, Math.floor((viewport.width - gap * (cols - 1)) / cols)) : 220;
  const rowHeight = itemHeight + gap;
  const totalRows = Math.ceil(cards.length / cols);
  const totalHeight = Math.max(0, totalRows * rowHeight - gap);

  if (totalRows === 0) {
    return <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '0px' }} />;
  }

  const containerTop = containerTopRef.current;
  const viewTop = viewport.scrollY;
  const viewBottom = viewport.scrollY + viewport.vh;
  const startRow = Math.min(
    totalRows - 1,
    Math.max(0, Math.floor((viewTop - containerTop) / rowHeight) - overscanRows),
  );
  const endRow = Math.min(
    totalRows - 1,
    Math.max(startRow, Math.ceil((viewBottom - containerTop) / rowHeight) + overscanRows),
  );
  const startIndex = Math.max(0, startRow * cols);
  const endIndexExclusive = Math.min(cards.length, (endRow + 1) * cols);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: `${totalHeight}px` }}>
      {cards.slice(startIndex, endIndexExclusive).map((card, i) => {
        const absoluteIndex = startIndex + i;
        const row = Math.floor(absoluteIndex / cols);
        const col = absoluteIndex % cols;
        const top = row * rowHeight;
        const left = col * (itemWidth + gap);
        return renderCaseCard(card, absoluteIndex, {
          position: 'absolute',
          top,
          left,
          width: itemWidth,
          height: itemHeight,
        });
      })}
    </div>
  );
}

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
  const {
    isReady,
    categories,
    selectedCategory,
    subsets,
    selectedSubsets,
    caseCards,
    selectedCaseIds,
    selectionChangeMode,
    selectAllCases,
    selectLearningCases,
    setSelectedCategory,
    toggleSubset,
    toggleAllSubsets,
    toggleCaseSelection,
    setSelectAllCases,
    setSelectLearningCases,
    cycleCaseLearnedState,
    reloadSavedAlgorithms,
  } = useLegacyBootstrap();
  const options = useLegacyOptions();
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
  const management = useLegacyManagement(reloadSavedAlgorithms);
  const selectedStickering = mainCubeStickeringDeferred && !options.fullStickering
    ? 'full'
    : getLegacyStickering(selectedCategory || 'PLL', options.fullStickering);

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

  const mainCubeAlg = useMemo(() => {
    if (!smartcube.connected && smartcube.disconnectToken !== acknowledgedDisconnectToken) {
      return '';
    }

    if (scramble.scrambleMode && smartcube.connected) {
      return scrambleStartAlg;
    }

    if (training.inputMode) {
      if (smartcube.connected && smartcube.currentPattern) {
        return inputModeSmartcubeSeed?.alg ?? '';
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
    inputModeSmartcubeSeed?.alg,
    scramble.scrambleMode,
    scrambleStartAlg,
    smartcube.connected,
    smartcube.currentPattern,
    smartcube.disconnectToken,
    training.displayAlg,
    training.inputMode,
  ]);

  const smartcubeAppendMoveKey = smartcube.lastProcessedMove?.key;
  const smartcubeAppendMove = smartcube.lastProcessedMove?.visualMove;
  useLegacyCharts(
    training.currentCase,
    training.displayAlg || training.algInput,
    training.statsAlgId,
    `${statsRefreshToken}:${training.stats.practiceCount}`,
  );

  function renderCaseCard(card: (typeof caseCards)[number], index: number, style?: CSSProperties) {
    const liveBestTime = getBestTime(card.id);
    const liveAo5 = averageOfFiveTimeNumber(card.id);
    const practiceCount = training.practiceCounts[card.id] || 0;
    const failedCount = training.failedCounts[card.id] || 0;
    const successCount = Math.max(0, practiceCount - Math.min(failedCount, practiceCount));

    return (
      <div
        key={`${card.id}-${card.name}`}
        className={`case-wrapper ${training.failedCounts[card.id] ? 'bg-red-400 dark:bg-red-400' : index % 2 === 0 ? 'case-alt-dark' : 'case-alt-light'}`}
        id={card.id}
        data-name={card.name}
        data-algorithm={card.algorithm}
        data-category={card.category}
        data-subset={card.subset}
        style={style}
      >
        <div className="case-card-header">
          <div className="case-name" title={card.algorithm}>
            {card.name}
          </div>
          <button
            id={`bookmark-${card.id}`}
            data-value={card.learned}
            title="Learning status"
            className="bookmark-button"
            type="button"
            onClick={() => cycleCaseLearnedState(card.id)}
          >
            <span aria-hidden="true">
              {card.learned === 2 ? (
                <BookClosedGreenIcon />
              ) : card.learned === 1 ? (
                <BookClosedOrangeIcon />
              ) : (
                <BookOpenIcon />
              )}
            </span>
          </button>
        </div>
        <label htmlFor={`case-toggle-${card.id}`} className="case-card-body" title={card.algorithm}>
          <div id={`best-time-${card.id}`} className="case-metric">
            Best: {bestTimeString(liveBestTime)}
          </div>
          <div id={`ao5-time-${card.id}`} className="case-metric">
            Ao5: {averageTimeString(liveAo5)}
          </div>
          <div id={`alg-case-${card.id}`} className="case-preview">
            <div className="case-preview-inner">
              <CaseCubePreview
                alg={card.algorithm}
                visualization={card.category.toLowerCase().includes('ll') ? 'experimental-2D-LL' : '3D'}
                stickering={getLegacyStickering(card.category, options.fullStickering)}
                setupAnchor="end"
                enabled
              />
            </div>
          </div>
          <div className="case-toggle-row">
            <input
              type="checkbox"
              id={`case-toggle-${card.id}`}
              className="sr-only"
              checked={selectedCaseIds.includes(card.id)}
              onChange={(event) => {
                setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                setMainCubeStickeringDeferred(false);
                toggleCaseSelection(card.id, event.target.checked);
              }}
            />
            <div className="toggle-track" />
            <div className="toggle-dot dot" />
            <div className="case-results">
              <div id={`${card.id}-failed`} className="failed-count">{failedCount > 0 ? `❌: ${failedCount}` : ''}</div>
              <div id={`${card.id}-success`} className="success-count">{practiceCount > 0 ? `✅: ${successCount}` : ''}</div>
            </div>
          </div>
        </label>
      </div>
    );
  }

  // (virtualized grid + preview components are defined at module scope to avoid remount/flicker)

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
  }, [options, smartcube.connected, smartcube.disconnectToken, smartcube.gyroSupportResolved, smartcube.gyroSupported, smartcube.info.deviceMAC, smartcube.info.gyroSupported]);

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
  }, [smartcube.connected, training]);

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
  }, [training.flashRequest]);

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
    scramble,
    smartcube.currentPattern,
    training.algInput,
    training.displayAlg,
    training.inputMode,
    training,
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
  }, [scramble, smartcube.currentPattern, smartcube.lastProcessedMove, training]);

  function selectView(view: MenuView) {
    setActiveView(view);
    setMenuOpen(false);
    setInfoVisible(false);

    if (view === 'new-alg') {
      training.enterInputMode(training.algInput || training.displayAlg);
      scramble.clearScramble();
      management.clearMessages();
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
  }

  function showFlashingIndicator(color: 'gray' | 'red' | 'green', durationMs: number) {
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
  }

  function handleTouchStart() {
    isTouchScrollingRef.current = false;
  }

  function handleTouchMove() {
    isTouchScrollingRef.current = true;
  }

  function handleTimerActivation() {
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
  }

  function handleTouchEnd() {
    if (!isTouchScrollingRef.current) {
      handleTimerActivation();
    }
  }

  function handleDeleteAlgorithms() {
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
  }

  function handleDeleteTimes() {
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
  }

  function handleEditCurrentAlgorithm() {
    const algorithm = training.currentCase?.algorithm || training.displayAlg || training.algInput;
    if (!algorithm.trim()) {
      return;
    }

    training.enterInputMode(algorithm);
    queueMicrotask(() => {
      document.getElementById('alg-input')?.focus();
    });
  }

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
          {!isReady ? <div className="footer">Loading legacy data…</div> : null}

          <div id="app-top" className={activeView === 'practice' || activeView === 'new-alg' ? '' : 'hidden'}>
            <div id="container" className="top-grid-shell">
              <div
                id="flashing-indicator"
                className={`${isFlashingIndicatorVisible ? 'flashing-indicator' : 'hidden flashing-indicator'}`}
                style={{ backgroundColor: flashingIndicatorColor }}
              />

              <div id="left-side" className="top-column left-column">
                <div
                  id="left-side-inner"
                  className={`${training.stats.hasHistory && activeView === 'practice' ? 'shell-card side-card' : 'hidden shell-card side-card'}`}
                >
                  <div id="alg-name-display-container" className="alg-name-display-container">
                    <button
                      id="toggle-display"
                      className={`${training.stats.hasHistory ? 'icon-button' : 'hidden icon-button'}`}
                      type="button"
                      onClick={() => setShowTimesInsteadOfGraph((value) => !value)}
                    >
                      {showTimesInsteadOfGraph ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="-2 0 19 19">
                          <path d="M13.55 15.256H1.45a.554.554 0 0 1-.553-.554V3.168a.554.554 0 1 1 1.108 0v10.98h11.544a.554.554 0 0 1 0 1.108zM3.121 13.02V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.785 0V3.507a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v9.513zm2.785 0V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.786 0v-2.753a.476.476 0 0 1 .475-.475h.785a.476.476 0 0 1 .475.475v2.753z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path d="M11.75 6C7.89 6 4.75 9.14 4.75 13C4.75 16.86 7.89 20 11.75 20C15.61 20 18.75 16.86 18.75 13C18.75 9.14 15.61 6 11.75 6ZM11.75 18.5C8.72 18.5 6.25 16.03 6.25 13C6.25 9.97 8.72 7.5 11.75 7.5C14.78 7.5 17.25 9.97 17.25 13C17.25 16.03 14.78 18.5 11.75 18.5ZM8.5 4.75C8.5 4.34 8.84 4 9.25 4H14.25C14.66 4 15 4.34 15 4.75C15 5.16 14.66 5.5 14.25 5.5H9.25C8.84 5.5 8.5 5.16 8.5 4.75ZM12.5 10V13C12.5 13.41 12.16 13.75 11.75 13.75C11.34 13.75 11 13.41 11 13V10C11 9.59 11.34 9.25 11.75 9.25C12.16 9.25 12.5 9.59 12.5 10ZM19.04 8.27C18.89 8.42 18.7 8.49 18.51 8.49C18.32 8.49 18.13 8.42 17.98 8.27L16.48 6.77C16.19 6.48 16.19 6 16.48 5.71C16.77 5.42 17.25 5.42 17.54 5.71L19.04 7.21C19.33 7.5 19.33 7.98 19.04 8.27Z" fill="currentColor"/>
                        </svg>
                      )}
                    </button>
                    <p
                      id="alg-name-display"
                      className="alg-name-display"
                      onClick={() => setShowTimesInsteadOfGraph((value) => !value)}
                    >
                      {options.showAlgName ? training.currentAlgName : ''}
                    </p>
                  </div>
                  <div
                    id="times-display"
                    className={`${training.stats.hasHistory && showTimesInsteadOfGraph ? 'times-display' : 'hidden times-display'}`}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="times-grid">
                      {training.stats.lastFive.map((entry, index) => (
                        <Fragment key={`time-row-${entry.value}-${entry.label}-${index}`}>
                          <div className="times-grid-label">{entry.label.split(': ')[0]}:</div>
                          <div className="times-grid-value">
                            {entry.label.split(': ').slice(1).join(': ')}{entry.isPb ? ' 🎉' : ''}
                          </div>
                        </Fragment>
                      ))}
                      <div className="times-grid-label times-grid-emphasis">Ao5:</div>
                      <div className="times-grid-value times-grid-emphasis">{formatHistoryMetric(averageOfFiveTimeNumber(training.statsAlgId))}</div>
                      <div className="times-grid-label">Best:</div>
                      <div className="times-grid-value">{formatHistoryMetric(getBestTime(training.statsAlgId))}</div>
                    </div>
                  </div>
                  <div id="graph-display" className={`${showTimesInsteadOfGraph ? 'hidden graph-display' : 'graph-display'}`}>
                    <canvas id="timeGraph" />
                  </div>
                </div>
              </div>

              <div
                id="cube"
                className="cube-area"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  width: `min(100%, ${options.cubeSizePx}px)`,
                  aspectRatio: '1',
                  height: 'auto',
                  maxWidth: '100%',
                  minWidth: 0,
                  overflow: 'visible',
                }}
              >
                <TwistyCube
                  alg={mainCubeAlg}
                  sizePx={options.cubeSizePx}
                  visualization={options.visualization}
                  hintFacelets={options.hintFacelets}
                  controlPanel={options.controlPanel}
                  experimentalStickering={selectedStickering}
                  setupAlg={options.whiteOnBottom ? 'z2' : ''}
                  cameraLatitude={0}
                  cameraLongitude={0}
                  backView={options.backview as 'none' | 'side-by-side' | 'top-right'}
                  resetToken={`${smartcube.connected}:${smartcube.currentFacelets ?? 'none'}:${training.visualResetKey}`}
                  appendMoveKey={smartcubeAppendMoveKey}
                  appendMove={smartcubeAppendMove}
                  gyroscopeEnabled={options.gyroscope && smartcube.connected}
                  cubeQuaternionRef={smartcube.cubeQuaternionRef}
                  className="twisty-cube-host"
                />
              </div>

              <div id="right-side" className="top-column right-column">
                <div className="connect-row">
                  <button
                    id="header-reset-gyro"
                    className={`${smartcube.connected && options.gyroscope && smartcube.gyroSupported ? 'primary-button' : 'primary-button hidden'}`}
                    type="button"
                    disabled={!smartcube.connected || !options.gyroscope || !smartcube.gyroSupported}
                    title="Reset gyroscope orientation for the virtual cube"
                    aria-label="Reset gyroscope orientation for the virtual cube"
                    onClick={() => smartcube.resetGyro()}
                  >
                    Reset Gyro
                  </button>
                  <button
                    id="connect-button"
                    className="primary-button connect-button"
                    type="button"
                    onClick={() => void smartcube.connectOrDisconnect()}
                  >
                    <div id="connect">{smartcube.connectLabel}</div>
                    <div id="bluetooth-indicator" className={`${smartcube.connected ? 'hidden indicator-badge' : 'indicator-badge'}`}>
                      <BluetoothIcon />
                    </div>
                    <div
                      id="battery-indicator"
                      className={`${smartcube.connected ? 'indicator-badge' : 'hidden indicator-badge'}`}
                      title={smartcube.battery.level == null ? '' : `${smartcube.battery.level}%`}
                      style={{ color: smartcube.battery.color === 'default' ? undefined : smartcube.battery.color }}
                    >
                      <svg fill="none" className="battery-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.5 7.5L3.5 7.50001V16.5L18.5 16.5V14.3571H20.5V9.21429H18.5V7.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        {smartcube.battery.level != null && smartcube.battery.level >= 75 ? (
                          <>
                            <path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/>
                            <path d="M9.5 10.5C9.5 9.94772 9.94772 9.5 10.5 9.5H11.5C12.0523 9.5 12.5 9.94772 12.5 10.5V13.5C12.5 14.0523 12.0523 14.5 11.5 14.5H10.5C9.94772 14.5 9.5 14.0523 9.5 13.5V10.5Z" fill="currentColor"/>
                            <path d="M13.5 10.5C13.5 9.94772 13.9477 9.5 14.5 9.5H15.5C16.0523 9.5 16.5 9.94772 16.5 10.5V13.5C16.5 14.0523 16.0523 14.5 15.5 14.5H14.5C13.9477 14.5 13.5 14.0523 13.5 13.5V10.5Z" fill="currentColor"/>
                          </>
                        ) : null}
                        {smartcube.battery.level != null && smartcube.battery.level >= 50 && smartcube.battery.level < 75 ? (
                          <>
                            <path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/>
                            <path d="M9.5 10.5C9.5 9.94772 9.94772 9.5 10.5 9.5H11.5C12.0523 9.5 12.5 9.94772 12.5 10.5V13.5C12.5 14.0523 12.0523 14.5 11.5 14.5H10.5C9.94772 14.5 9.5 14.0523 9.5 13.5V10.5Z" fill="currentColor"/>
                          </>
                        ) : null}
                        {smartcube.battery.level != null && smartcube.battery.level >= 20 && smartcube.battery.level < 50 ? (
                          <path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/>
                        ) : null}
                        {smartcube.battery.level != null && smartcube.battery.level < 20 ? (
                          <>
                            <path d="M11 10V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M11.75 14.25C11.75 14.6642 11.4142 15 11 15C10.5858 15 10.25 14.6642 10.25 14.25C10.25 13.8358 10.5858 13.5 11 13.5C11.4142 13.5 11.75 13.8358 11.75 14.25Z" fill="currentColor"/>
                          </>
                        ) : null}
                      </svg>
                    </div>
                  </button>
                </div>
                <div
                  id="touch-timer"
                  className="touch-timer"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    id="timer"
                    className={`${!training.inputMode && training.timerState !== 'IDLE' ? 'timer-display' : 'hidden timer-display'}`}
                    style={{
                      color:
                        training.timerState === 'READY'
                          ? '#080'
                          : training.timerState === 'RUNNING'
                            ? '#999'
                            : options.darkMode
                              ? '#ccc'
                              : '#333',
                    }}
                  >
                    {training.timerText}
                  </div>
                </div>
              </div>
            </div>

            <div id="alg-bar" className="alg-bar">
              <button
                id="train-alg"
                title="Train"
                className="round-button"
                type="button"
                onClick={() => {
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  if (scramble.scrambleMode && !options.alwaysScrambleTo) {
                    scramble.clearScramble();
                    lastProcessedScrambleMoveRef.current = '';
                  }

                  if (training.timerState === 'RUNNING') {
                    training.abortRunningAttempt();
                  }
                  void training.trainCurrent(smartcube.currentPattern);
                }}
              >
                {training.timerState === 'RUNNING' ? <StopIcon /> : <PlayIcon />}
              </button>

              <input
                id="alg-input"
                type="text"
                placeholder="Enter alg e.g., (R U R' U) (R U2' R')"
                className={`alg-input ${training.inputMode ? '' : 'hidden'}`.trim()}
                value={training.algInput}
                onChange={(event) => training.setAlgInput(event.target.value)}
              />

              <div
                id="alg-display-container"
                className={`alg-display-container ${training.inputMode ? 'hidden' : ''}`.trim()}
              >
                <div className="alg-display-mask-row">
                  <a
                    href="#"
                    id="toggle-move-mask"
                    className="mask-toggle-button"
                    style={{ backgroundColor: isMoveMasked ? '#f97316' : '#3b82f6' }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsMoveMasked((value) => !value);
                    }}
                  >
                    {isMoveMasked ? <><EyeSlashIcon /> Unmask alg</> : <><EyeIcon /> Mask alg</>}
                  </a>
                </div>
                <div id="alg-display" className="alg-display" onClick={handleEditCurrentAlgorithm}>
                  <div className="alg-display-moves">
                  {training.displayMoves.map((move, index) => {
                      const color = move.color === 'green'
                        ? 'green'
                        : move.color === 'red'
                          ? 'red'
                          : move.color === 'blue'
                            ? 'blue'
                            : move.color === 'next'
                              ? 'white'
                              : options.darkMode
                                ? 'white'
                                : 'black';

                      return (
                        <span key={`${move.token}-${index}`}>
                          {move.prefix ? <span style={{ color: options.darkMode ? 'white' : 'black' }}>{move.prefix}</span> : null}
                          {move.circle ? (
                            <span className="circle">
                              <span
                                className="move"
                                style={{ color, WebkitTextSecurity: isMoveMasked ? 'disc' : 'none' } as CSSProperties}
                              >
                                {move.token}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="move"
                              style={{ color, WebkitTextSecurity: isMoveMasked ? 'disc' : 'none' } as CSSProperties}
                            >
                              {move.token}
                            </span>
                          )}
                          {move.suffix ? <span style={{ color: options.darkMode ? 'white' : 'black' }}>{move.suffix}</span> : null}{' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                id="scramble-to"
                title="Scramble To..."
                className="round-button"
                type="button"
                onClick={() => {
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
                }}
              >
                {scramble.isComputing ? '…' : <ScatterIcon />}
              </button>
            </div>

            <div
              id="alg-help-info"
              className={`${scramble.helpTone === 'green' || training.helpTone === 'red' ? 'info-inline' : 'hidden info-inline'}`}
              style={{ color: training.helpTone === 'red' ? '#f87171' : scramble.helpTone === 'green' ? '#34d399' : undefined }}
            >
              <p>Ensure the cube is oriented with WHITE center on top and GREEN center on front.</p>
            </div>
            <div id="alg-fix" className={`${training.fixVisible && training.fixText ? 'status-panel status-error' : 'hidden status-panel status-error'}`}>
              {training.fixText}
            </div>
            <div id="alg-scramble" className={`${scramble.scrambleMode ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
              {scramble.scrambleText}
            </div>
          </div>

          <div id="help" className={`help-panel shell-card ${isVisible(activeView, 'help') ? '' : 'hidden'}`.trim()}>
            <div className="panel-header-row">
              <p id="help-title" className="panel-title">{showDumbcubeHelp ? 'DUMBCUBE HELP' : 'SMARTCUBE HELP'}</p>
              <p id="dumbcube-toggle" className="help-toggle-text">
                {showDumbcubeHelp ? (
                  <>🛜 USING a smart cube?{' '}
                    <button type="button" className="text-blue-500" onClick={() => setShowDumbcubeHelp(false)}>
                      CLICK HERE
                    </button>
                  </>
                ) : (
                  <>🛜 NOT using a smart cube?{' '}
                    <button type="button" className="text-blue-500" onClick={() => setShowDumbcubeHelp(true)}>
                      CLICK HERE
                    </button>
                  </>
                )}
              </p>
            </div>

            {!showDumbcubeHelp ? (
              <>
                <p className="section-title">To get started with Cubedex:</p>
                <div id="help-content-smartcube">
                  <ul className="help-list">
                    <li>🔗 Connect your smart cube by clicking the <strong>Connect</strong> button. For more details, refer to the <a href="https://gist.github.com/afedotov/52057533a8b27a0277598160c384ae71" target="_blank" rel="noreferrer">FAQ</a>.</li>
                    <li>📜 Load an algorithm from the list or input your own in the input field using standard Rubik's cube notation. You can also input the algorithm by performing it on the cube.</li>
                    <li>🟩 Ensure the cube is oriented with <strong>WHITE on top</strong> and <strong>GREEN on front</strong>.</li>
                    <li>🏁 Click the <strong>▶️ Train</strong> button and turn the cube to start practicing the algorithm.</li>
                    <li>🪄 If you want the smartcube to match the virtual cube, click the <strong>Scramble To...</strong> button and follow the scramble.</li>
                  </ul>
                  <p className="section-title">During training:</p>
                  <ul className="help-list">
                    <li>⏱️ The timer will start automatically when you begin the algorithm.</li>
                    <li>🏆 Upon successful completion, the timer will stop and your last 5 times along with their average will be displayed.</li>
                    <li>🔄 If you make a mistake, follow the moves shown in the <strong>Fix</strong> section to correct it. Ensure the top center is <strong>WHITE</strong> and the front center is <strong>GREEN</strong>.</li>
                  </ul>
                  <p className="section-title">Customize your practice drills:</p>
                  <ul className="help-list">
                    <li>📂 Pick a category, choose subsets, and select the cases you want to work on.</li>
                    <li>🔖 Mark the algs you're learning or have already learned. You can use the <strong>Select Learning</strong> option to filter algs by learning status.</li>
                    <li>🔀 Try <strong>Random AUF</strong> to practice with random orientations. For 2-sided recognition, turn off the Gyroscope Orientation and Mirror Sticker hints in Options, letting you view only two sides of the cube. For sets like PLL or ZBLL, you'll also get random post-AUFs to sharpen your AUF prediction.</li>
                    <li>🎲 Enable <strong>Random Order</strong> to mix up the algorithms.</li>
                    <li>🐌 Turn on <strong>Slow Cases First</strong> to improve these slow algorithms.</li>
                    <li>🎯 Activate <strong>Prioritize Failed Cases</strong> to focus on the algorithms you find most challenging.</li>
                    <li>📝 Want to change the algorithm for one or more cases? Click on the algorithm to edit it. You can also <strong>Export Algs</strong> in Options, modify the algorithm in the JSON file, then import it back.</li>
                    <li>⏳ Training for PLL Time Attack? Create a new category and add all your PLL algorithms in sequence for a timed practice session.</li>
                  </ul>
                </div>
              </>
            ) : (
              <div id="help-content-dumbcube">
                <ul className="help-list">
                  <li>📜 Load an algorithm from the list or input your own in the input field using standard Rubik's cube notation.</li>
                  <li>🏁 Press the spacebar (on computer) or touch the timer (on touchscreen enabled devices) to start and stop the timer.</li>
                </ul>
                <p className="section-title">During training:</p>
                <ul className="help-list">
                  <li>🪄 If you want to setup the case on your cube, click the <strong>Scramble To...</strong> button and follow the scramble.</li>
                  <li>🏆 When you stop the timer your last 5 times along with their average will be displayed.</li>
                </ul>
                <p className="section-title">Customize your practice drills:</p>
                <ul className="help-list">
                  <li>📂 Pick a category, choose subsets, and select the cases you want to work on.</li>
                  <li>🔖 Mark the algs you're learning or have already learned. You can use the <strong>Select Learning</strong> option to filter algs by learning status.</li>
                  <li>🔀 Try <strong>Random AUF</strong> to practice with random orientations. For 2-sided recognition, turn off Mirror Sticker hints in Options, letting you view only two sides of the cube.</li>
                  <li>🎲 Enable <strong>Random Order</strong> to mix up the algorithms.</li>
                  <li>🐌 Turn on <strong>Slow Cases First</strong> to improve these slow algorithms.</li>
                  <li>📝 Want to change the algorithm for one or more cases? Click on the algorithm to edit it. You can also <strong>Export Algs</strong> in Options, modify the algorithm in the JSON file, then import it back.</li>
                  <li>⏳ Training for PLL Time Attack? Create a new category and add all your PLL algorithms in sequence for a timed practice session.</li>
                </ul>
              </div>
            )}

            <p className="section-title">Still need help? Watch the video tutorial:</p>
            <div className="video-shell">
              <div style={{ position: 'relative', overflow: 'hidden', width: '100%', paddingTop: '56.25%' }}>
                <iframe
                  title="Cubedex Tutorial"
                  loading="lazy"
                  src="https://www.youtube.com/embed/AZcFMiT2Vm0"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  allow="fullscreen; picture-in-picture"
                />
              </div>
            </div>

            <div className="help-footer-shell">
              <div id="help-footer" className="subpanel">
                <p className="centered-text"><strong>Love Cubedex? Help us grow! 🌱</strong></p>
                <p className="centered-text">No Ads here 🤗 Support the app's development on <a href="https://ko-fi.com/cubedex" target="_blank" rel="noreferrer">Ko-fi</a>:</p>
                <p className="centered-text"><a href="https://ko-fi.com/H2H6132Z3Z" target="_blank" rel="noreferrer">Support Me on Ko-fi</a></p>
              </div>
            </div>
          </div>

          <div id="save-container" className={`save-panel ${isVisible(activeView, 'new-alg') ? '' : 'hidden'}`.trim()}>
            <div id="save-wrapper" className="form-grid">
              <label htmlFor="category-input" className="form-label">Category:</label>
              <input
                id="category-input"
                type="text"
                placeholder="Category name"
                className="text-input"
                value={management.categoryInput}
                onChange={(event) => management.setCategoryInput(event.target.value)}
              />
              <label htmlFor="subset-input" className="form-label">Subset:</label>
              <input
                id="subset-input"
                type="text"
                placeholder="Subset name"
                className="text-input"
                value={management.subsetInput}
                onChange={(event) => management.setSubsetInput(event.target.value)}
              />
              <label htmlFor="alg-name-input" className="form-label">Name:</label>
              <input
                id="alg-name-input"
                type="text"
                placeholder="Case name"
                className="text-input"
                value={management.algNameInput}
                onChange={(event) => management.setAlgNameInput(event.target.value)}
              />
            </div>
            <div className="save-panel-actions">
              <button
                id="confirm-save"
                className="save-panel-button"
                type="button"
                onClick={() => {
                  const nextCategory = management.categoryInput.trim();
                  if (management.submitSave(training.displayAlg || training.algInput) && nextCategory) {
                    training.clearFailedCounts();
                    setStatsRefreshToken((value) => value + 1);
                    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                    setSelectedCategory(nextCategory);
                    setMainCubeStickeringDeferred(false);
                  }
                }}
              >
                Save
              </button>
              <button
                id="cancel-save"
                className="save-panel-button"
                type="button"
                onClick={() => {
                  management.clearMessages();
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  setActiveView('practice');
                  void training.trainCurrent(smartcube.currentPattern);
                }}
              >
                Cancel
              </button>
            </div>
            <div id="save-error" className={`${management.saveError ? 'status-panel status-error' : 'hidden status-panel status-error'}`}>
              {management.saveError}
            </div>
            <div id="save-success" className={`${management.saveSuccess ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
              {management.saveSuccess}
            </div>
          </div>

          <div id="alg-stats" className={`${training.stats.hasHistory && activeView === 'practice' ? 'stats-panel shell-card' : 'hidden stats-panel shell-card'}`}>
            <div id="stats-container" className="stats-graph-container">
              <div className="stats-graph-shell">
                <canvas id="statsGraph" className="stats-graph-canvas" />
              </div>
            </div>
            <div id="metrics-container" className="metrics-container">
              <div id="alg-name-display2" className="metrics-title">
                {options.showAlgName ? training.currentAlgName : ''}
              </div>
              <div id="stats-grid" className="metrics-grid">
                <div id="average-time-box" className="metric-box">Average Time<br />{training.stats.average}</div>
                <div id="average-tps-box" className="metric-box">Average TPS<br />{training.stats.averageTps}</div>
                <div id="single-pb-box" className="metric-box">
                  Single PB<br />
                  {training.stats.singlePb}
                  {training.stats.lastFive.at(-1)?.isPb ? ' 🎉' : ''}
                </div>
              </div>
            </div>
          </div>

          <div id="load-container" className={`load-panel shell-card ${isVisible(activeView, 'practice') ? '' : 'hidden'}`.trim()}>
            <div id="default-alg-id" className="hidden bg-red-400" />

            <div className="control-row">
              <div id="category-selector" className="selector-card">
                <label htmlFor="category-select" className="input-label">Category:</label>
                <select
                  id="category-select"
                  className="select-input"
                  value={selectedCategory}
                  onChange={(event) => {
                    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                    setMainCubeStickeringDeferred(false);
                    setSelectedCategory(event.target.value);
                    training.clearFailedCounts();
                    training.resetDrill();
                    scramble.clearScramble();
                  }}
                >
                  <option value="">Filter by Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div id="options-selector" className="selector-options-card">
                <p className="input-label">Options:</p>
                <div className="toggle-grid">
                  <LegacySwitch
                    id="select-all-toggle"
                    checked={selectAllCases}
                    onChange={(checked) => {
                      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                      if (checked) {
                        setMainCubeStickeringDeferred(false);
                      }
                      setSelectAllCases(checked);
                    }}
                    label="Select All"
                  />
                  <LegacySwitch
                    id="select-learning-toggle"
                    checked={selectLearningCases}
                    onChange={(checked) => {
                      setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                      if (checked) {
                        setMainCubeStickeringDeferred(false);
                      }
                      setSelectLearningCases(checked);
                    }}
                    label="Select Learning"
                  />
                  <LegacySwitch
                    id="random-auf-toggle"
                    checked={practiceToggles.randomizeAUF}
                    onChange={(checked) => practiceToggles.setRandomizeAUF(checked)}
                    label="Random AUF"
                  />
                  <LegacySwitch
                    id="random-order-toggle"
                    checked={practiceToggles.randomOrder}
                    onChange={(checked) => practiceToggles.setRandomOrder(checked)}
                    label="Random Order"
                  />
                  <LegacySwitch
                    id="prioritize-slow-toggle"
                    checked={practiceToggles.prioritizeSlowCases}
                    onChange={(checked) => practiceToggles.setPrioritizeSlowCases(checked)}
                    label="Slow Cases First"
                  />
                  <LegacySwitch
                    id="prioritize-failed-toggle"
                    checked={practiceToggles.prioritizeFailedCases}
                    onChange={(checked) => practiceToggles.setPrioritizeFailedCases(checked)}
                    label="Prioritize Failed Cases"
                  />
                </div>
              </div>
            </div>

            <p className="input-label subset-label subset-label-row">
              <label htmlFor="select-all-subsets-toggle">Subset:</label>
              <input
                type="checkbox"
                id="select-all-subsets-toggle"
                className="subset-checkbox"
                checked={subsets.length > 0 && selectedSubsets.length === subsets.length}
                onChange={(event) => {
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  toggleAllSubsets(event.target.checked);
                  training.clearFailedCounts();
                  training.resetDrill();
                  scramble.clearScramble();
                }}
              />
            </p>

            <div id="subset-checkboxes" className="subsets-panel">
              <div id="subset-checkboxes-container" className="subset-grid">
                {subsets.map((subset) => (
                  <label key={subset} className="toggle-item subset-item">
                    <input
                      type="checkbox"
                      className="subset-checkbox"
                      checked={selectedSubsets.includes(subset)}
                      onChange={(event) => {
                        setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                        toggleSubset(subset, event.target.checked);
                        training.clearFailedCounts();
                        training.resetDrill();
                        scramble.clearScramble();
                      }}
                    />
                    <span>{subset}</span>
                  </label>
                ))}
              </div>
            </div>

            {caseCards.length > 10 ? (
              <div id="alg-cases" className="alg-cases-virtualized">
                <VirtualizedCaseGrid cards={caseCards} renderCaseCard={renderCaseCard} />
              </div>
            ) : (
              <div id="alg-cases" className="alg-cases-grid">
                {caseCards.map((card, index) => renderCaseCard(card, index))}
              </div>
            )}

            <div className="delete-mode-container">
              <LegacySwitch
                id="delete-mode-toggle"
                className="legacy-switch--inline"
                checked={deleteMode}
                onChange={(checked) => {
                  setDeleteMode(checked);
                  if (!checked) {
                    setDeleteSuccessMessage('');
                  }
                }}
                label="Delete Mode"
              />
              <button
                id="delete-alg"
                disabled={!deleteMode}
                className="primary-button"
                type="button"
                onClick={handleDeleteAlgorithms}
              >
                Delete Algorithm
              </button>
              <button
                id="delete-times"
                disabled={!deleteMode}
                className="primary-button"
                type="button"
                onClick={handleDeleteTimes}
              >
                Delete Times
              </button>
            </div>

            <div id="delete-success" className={`${deleteSuccessMessage ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
              {deleteSuccessMessage}
            </div>
          </div>

          <input
            type="file"
            id="import-file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void management.importFromFile(file).then((imported) => {
                  if (imported) {
                    training.clearFailedCounts();
                    const firstCategory = Object.keys(getSavedAlgorithms())[0] ?? '';
                    setSelectedCategory(firstCategory);
                    setStatsRefreshToken((value) => value + 1);
                  }
                });
              }
              event.currentTarget.value = '';
            }}
          />

          <div id="info" className={`${infoVisible ? 'info-panel shell-card' : 'hidden info-panel shell-card'}`}>
            <label htmlFor="deviceName" className="form-label">Device Name:</label>
            <input id="deviceName" type="text" readOnly value={smartcube.info.deviceName} className="readonly-input" />
            <label htmlFor="deviceMAC" className="form-label">Device MAC:</label>
            <input id="deviceMAC" type="text" readOnly value={smartcube.info.deviceMAC} className="readonly-input" />
            <label htmlFor="deviceProtocol" className="form-label">Protocol:</label>
            <input id="deviceProtocol" type="text" readOnly value={smartcube.info.deviceProtocol} className="readonly-input" />
            <label htmlFor="hardwareName" className="form-label">Hardware Name:</label>
            <input id="hardwareName" type="text" readOnly value={smartcube.info.hardwareName} className="readonly-input" />
            <label htmlFor="hardwareVersion" className="form-label">Hardware Version:</label>
            <input id="hardwareVersion" type="text" readOnly value={smartcube.info.hardwareVersion} className="readonly-input" />
            <label htmlFor="softwareVersion" className="form-label">Software Version:</label>
            <input id="softwareVersion" type="text" readOnly value={smartcube.info.softwareVersion} className="readonly-input" />
            <label htmlFor="productDate" className="form-label">Product Date:</label>
            <input id="productDate" type="text" readOnly value={smartcube.info.productDate} className="readonly-input" />
            <label htmlFor="gyroSupported" className="form-label">Gyro Supported:</label>
            <input id="gyroSupported" type="text" readOnly value={smartcube.info.gyroSupported} className="readonly-input" />
            <label htmlFor="batteryLevel" className="form-label">Battery:</label>
            <input id="batteryLevel" type="text" readOnly value={smartcube.info.batteryLevel} className="readonly-input" />
            <label htmlFor="skew" className="form-label">Clock Skew:</label>
            <input id="skew" type="text" readOnly value={smartcube.info.skew} className="readonly-input" />
            <label htmlFor="quaternion" className="form-label">Quaternion:</label>
            <input id="quaternion" type="text" readOnly value={smartcube.info.quaternion} className="readonly-input" />
            <label htmlFor="velocity" className="form-label">Angular Velocity:</label>
            <input id="velocity" type="text" readOnly value={smartcube.info.velocity} className="readonly-input" />
          </div>

          <div id="options-container" className={`options-panel shell-card ${isVisible(activeView, 'options') && !infoVisible ? '' : 'hidden'}`.trim()}>
            <div id="alg-options-container" className="options-section">
              <p className="options-section-title">Algorithms Options:</p>
              <div className="button-row options-button-row">
                <button id="export-algs" className="primary-button" type="button" onClick={() => management.exportAll()}>
                  Export Algs
                </button>
                <button
                  id="import-algs"
                  className="primary-button"
                  type="button"
                  onClick={() => document.getElementById('import-file')?.click()}
                >
                  Import Algs
                </button>
              </div>
            </div>

            <div id="device-options-container" className="options-section">
              <p className="options-section-title">Smartcube Options:</p>
              <div className="button-row options-button-row">
                <button
                  id="reset-state"
                  disabled={!smartcube.connected}
                  className="primary-button"
                  type="button"
                  onClick={() => void smartcube.resetState()}
                >
                  Reset State
                </button>
                <button
                  id="reset-gyro"
                  disabled={!smartcube.connected || !options.gyroscope || !smartcube.gyroSupported}
                  className="primary-button"
                  type="button"
                  onClick={() => smartcube.resetGyro()}
                >
                  Reset Gyro
                </button>
                <button
                  id="device-info"
                  disabled={!smartcube.connected}
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setInfoVisible((value) => !value);
                  }}
                >
                  Device Info
                </button>
              </div>
              <div className="device-ble-toggle-row">
                <LegacySwitch
                  id="smartcube-show-all-ble-toggle"
                  checked={smartcube.showAllBluetoothDevices}
                  onChange={(checked) => smartcube.setShowAllBluetoothDevices(checked)}
                  label="Show all Bluetooth devices when connecting"
                />
              </div>
            </div>

            <div className="options-toggle-row">
              <LegacySwitch
                id="dark-mode-toggle"
                checked={options.darkMode}
                onChange={(checked) => options.setDarkMode(checked)}
                label="Dark Mode"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="gyroscope-toggle"
                checked={smartcube.connected && !smartcube.gyroSupported ? false : options.gyroscope}
                disabled={smartcube.gyroscopeToggleDisabled}
                onChange={(checked) => options.setGyroscope(checked)}
                label="Animate Virtual Cube Using Gyroscope"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="control-panel-toggle"
                checked={options.controlPanel === 'bottom-row'}
                onChange={(checked) => options.setControlPanel(checked ? 'bottom-row' : 'none')}
                label="Virtual Cube Control Panel"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="hintFacelets-toggle"
                checked={options.hintFacelets === 'floating'}
                onChange={(checked) => options.setHintFacelets(checked ? 'floating' : 'none')}
                label="Floating Mirror Stickers"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="full-stickering-toggle"
                checked={options.fullStickering}
                onChange={(checked) => options.setFullStickering(checked)}
                label="Always Show Full Stickers"
              />
            </div>

            <div className="white-bottom-group">
              <LegacySwitch
                id="white-on-bottom-toggle"
                className="legacy-switch--indented"
                checked={options.whiteOnBottom}
                disabled={!options.fullStickering}
                onChange={(checked) => options.setWhiteOnBottom(checked)}
                label="Virtual Cube White on Bottom"
              />
              <span id="white-on-bottom-hint" className={`${options.fullStickering ? 'hidden subtle-text' : 'subtle-text'}`}>
                Requires “Always Show Full Stickers”
              </span>
            </div>

            <div className="options-toggle-row">
              <LegacySwitch
                id="flashing-indicator-toggle"
                checked={options.flashingIndicatorEnabled}
                onChange={(checked) => options.setFlashingIndicatorEnabled(checked)}
                label="Flashing Indicator"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="show-alg-name-toggle"
                checked={options.showAlgName}
                onChange={(checked) => options.setShowAlgName(checked)}
                label="Show Case Name"
              />
            </div>
            <div className="options-toggle-row">
              <LegacySwitch
                id="always-scramble-to-toggle"
                checked={options.alwaysScrambleTo}
                onChange={(checked) => options.setAlwaysScrambleTo(checked)}
                label='Always Keep "Scramble To" Enabled'
              />
            </div>

            <div id="visualization-container">
              <label htmlFor="visualization-select" className="options-viz-label">Cube Visualization Mode:</label>
              <select
                id="visualization-select"
                className="select-input"
                value={options.visualization}
                onChange={(event) => options.setVisualization(event.target.value)}
              >
                <option value="PG3D">PG3D</option>
                <option value="2D">2D</option>
                <option value="3D">3D</option>
                <option value="experimental-2D-LL">2D-LL</option>
                <option value="experimental-2D-LL-face">2D-LL-face</option>
              </select>

              <label htmlFor="backview-select" className="options-viz-label">Cube Back View:</label>
              <select
                id="backview-select"
                className="select-input"
                value={options.backview}
                onChange={(event) => options.setBackview(event.target.value)}
              >
                <option value="none">Disabled</option>
                <option value="side-by-side">Side-by-side</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>

            <div id="large-cube-container">
              <label htmlFor="cube-size" className="options-cube-size-label">Cube Size:</label>
              <div className="cube-size-row">
                <input
                  id="cube-size"
                  type="range"
                  min="240"
                  max="600"
                  step="10"
                  value={options.cubeSizePx}
                  onChange={(event) => options.setCubeSizePx(Number(event.target.value))}
                />
                <input
                  id="cube-size-number"
                  type="number"
                  min="240"
                  max="600"
                  step="10"
                  value={options.cubeSizePx}
                  onChange={(event) => options.setCubeSizePx(Number(event.target.value))}
                  className="number-input"
                />
              </div>
            </div>
          </div>
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
