import { PUZZLES, type PuzzleId } from '../lib/puzzles';
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { PracticeTogglesState } from '../hooks/usePracticeToggles';
import type { TrainingState } from '../hooks/useTrainingState';
import type { ScrambleState } from '../hooks/useScrambleState';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import { averageOfFiveTimeNumber, historyTimeString } from '../lib/case-cards';
import { getBestTime } from '../lib/storage';
import { alignForGuidance, fixOrientation, patternToPlayerAlg } from '../lib/scramble';
import { projectTrainingPattern } from '../lib/training-visual';
import { guidanceFrameRotation } from '../lib/cube-orientation';
import { CubeGuidancePanel } from '../components/CubeGuidancePanel';
import { MainCubeArea } from './MainCubeArea';
import { MoveListPanel } from './MoveListPanel';
import { StatsPanel } from './StatsPanel';
import { NewAlgView } from './NewAlgView';
import { Icon, IC, EyeIcon, EyeSlashIcon } from '../components/ui/Icon';
import { StatChip } from '../components/ui/StatChip';
import { Toggle } from '../components/ui/Toggle';

function RecentTimesModeToggle({
  showTimesInsteadOfGraph,
  onToggle,
}: {
  showTimesInsteadOfGraph: boolean;
  onToggle: () => void;
}) {
  const label = showTimesInsteadOfGraph ? 'Show graph' : 'Show times list';
  return (
    <button
      type="button"
      className="recent-times-toggle"
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {showTimesInsteadOfGraph ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="-2 0 19 19" aria-hidden>
          <path d="M13.55 15.256H1.45a.554.554 0 0 1-.553-.554V3.168a.554.554 0 1 1 1.108 0v10.98h11.544a.554.554 0 0 1 0 1.108zM3.121 13.02V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.785 0V3.507a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v9.513zm2.785 0V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.786 0v-2.753a.476.476 0 0 1 .475-.475h.785a.476.476 0 0 1 .475.475v2.753z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M11.75 6C7.89 6 4.75 9.14 4.75 13C4.75 16.86 7.89 20 11.75 20C15.61 20 18.75 16.86 18.75 13C18.75 9.14 15.61 6 11.75 6ZM11.75 18.5C8.72 18.5 6.25 16.03 6.25 13C6.25 9.97 8.72 7.5 11.75 7.5C14.78 7.5 17.25 9.97 17.25 13C17.25 16.03 14.78 18.5 11.75 18.5ZM8.5 4.75C8.5 4.34 8.84 4 9.25 4H14.25C14.66 4 15 4.34 15 4.75C15 5.16 14.66 5.5 14.25 5.5H9.25C8.84 5.5 8.5 5.16 8.5 4.75ZM12.5 10V13C12.5 13.41 12.16 13.75 11.75 13.75C11.34 13.75 11 13.41 11 13V10C11 9.59 11.34 9.25 11.75 9.25C12.16 9.25 12.5 9.59 12.5 10ZM19.04 8.27C18.89 8.42 18.7 8.49 18.51 8.49C18.32 8.49 18.13 8.42 17.98 8.27L16.48 6.77C16.19 6.48 16.19 6 16.48 5.71C16.77 5.42 17.25 5.42 17.54 5.71L19.04 7.21C19.33 7.5 19.33 7.98 19.04 8.27Z" />
        </svg>
      )}
    </button>
  );
}

const ORIENTATION_REMINDER =
  'Ensure the cube is oriented with WHITE on top and GREEN on front.';

/** Matches `.alg-display-moves` sizing so status strips align with the main alg line. */
const STATUS_BAR_MOVES_LINE_STYLE: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'clamp(1.0625rem, 2.5vw, 1.1875rem)',
  lineHeight: 1.35,
};

const STATUS_BAR_REMINDER_LINE_STYLE: CSSProperties = {
  fontSize: 'clamp(1.0625rem, 2.5vw, 1.1875rem)',
  lineHeight: 1.45,
};

export const PracticeView = memo(function PracticeView({
  puzzle = '3x3x3',
  visible,
  options,
  practiceToggles,
  training,
  scramble,
  smartcube,
  algorithmActions,
  showAlgEditor,
  onAlgEditorSave,
  onAlgEditorCancel,
  mainCubeAlg,
  selectedStickering,
  setAcknowledgedDisconnectToken,
  lastProcessedScrambleMoveRef,
  setScrambleStartAlg,
  isMoveMasked,
  setIsMoveMasked,
  handleEditCurrentAlgorithm,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleTouchTimerActivation,
  isFlashingIndicatorVisible,
  flashingIndicatorColor,
  smartcubeAppendMoveKey,
  smartcubeAppendMove,
  isMobile,
  orientationResetToken,
  orientationResetAlg,
  showTimesInsteadOfGraph,
  setShowTimesInsteadOfGraph,
  onOpenCaseLibrary,
  onCycleLearnedState,
  currentCaseLearnedState,
}: {
  puzzle?: PuzzleId;
  visible: boolean;
  options: AppSettingsState;
  practiceToggles: PracticeTogglesState;
  training: TrainingState;
  scramble: ScrambleState;
  smartcube: SmartcubeConnectionState;
  algorithmActions: AlgorithmImportExportState;
  showAlgEditor: boolean;
  onAlgEditorSave: () => void;
  onAlgEditorCancel: () => void;
  mainCubeAlg: string;
  selectedStickering: string;
  setAcknowledgedDisconnectToken: (value: number) => void;
  lastProcessedScrambleMoveRef: { current: string };
  setScrambleStartAlg: (value: string) => void;
  isMoveMasked: boolean;
  setIsMoveMasked: (updater: (value: boolean) => boolean) => void;
  handleEditCurrentAlgorithm: () => void;
  handleTouchStart: () => void;
  handleTouchMove: () => void;
  handleTouchEnd: () => void;
  handleTouchTimerActivation: () => void;
  isFlashingIndicatorVisible: boolean;
  flashingIndicatorColor: 'gray' | 'red' | 'green';
  smartcubeAppendMoveKey?: string;
  smartcubeAppendMove?: string;
  isMobile: boolean;
  orientationResetToken: number;
  orientationResetAlg: string | null;
  showTimesInsteadOfGraph: boolean;
  setShowTimesInsteadOfGraph: (updater: (value: boolean) => boolean) => void;
  onOpenCaseLibrary: () => void;
  onCycleLearnedState: (algId: string) => void;
  currentCaseLearnedState: 0 | 1 | 2 | undefined;
}) {
  const skipPracticeEnterAnim = useRef(true);
  const [practiceViewEnter, setPracticeViewEnter] = useState(false);
  const [practiceTogglesExpanded, setPracticeTogglesExpanded] = useState(false);
  const [caseNavigationBusy, setCaseNavigationBusy] = useState(false);
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (skipPracticeEnterAnim.current) {
      skipPracticeEnterAnim.current = false;
      return;
    }
    setPracticeViewEnter(true);
    const t = window.setTimeout(() => {
      setPracticeViewEnter(false);
    }, 130);
    return () => {
      window.clearTimeout(t);
    };
  }, [visible]);

  const statsAlgId = training.statsAlgId;
  const bestTime = getBestTime(statsAlgId);
  const ao5 = averageOfFiveTimeNumber(statsAlgId);
  const lastTime = training.stats.lastFive.at(-1);

  const timerCardScale = training.inputMode
    ? 1
    : training.timerState === 'IDLE'
      ? 0.985
      : training.timerState === 'READY'
        ? 1.02
        : 1;
  const timerTransformStyle: CSSProperties = {
    transform: `scale(${timerCardScale})`,
    transformOrigin: '50% 50%',
    transition: 'transform 0.22s ease, border-color 0.15s, box-shadow 0.15s, color 0.2s',
  };

  const [guidedRecovery, setGuidedRecovery] = useState(false);
  const [showBackOnTrack, setShowBackOnTrack] = useState(false);
  const undoRecovery = PUZZLES[puzzle].smartcube && Boolean(training.recoveryTarget);
  const canGuide3x3 = puzzle === '3x3x3' && smartcube.connected && training.fixVisible && Boolean(training.fixText);
  useEffect(() => {
    setShowBackOnTrack(Boolean(training.recoveredAt));
    if (!training.recoveredAt) return;
    const timer = window.setTimeout(() => setShowBackOnTrack(false), 1600);
    return () => window.clearTimeout(timer);
  }, [training.recoveredAt]);
  useEffect(() => {
    setGuidedRecovery(false);
  }, [puzzle, visible, showAlgEditor, training.visualResetKey, training.currentCase?.id, training.inputMode, smartcube.connected]);
  useEffect(() => {
    if (!training.recoveryTarget) setGuidedRecovery(false);
  }, [training.recoveryTarget]);
  const showingGuidedRecovery = guidedRecovery && undoRecovery && smartcube.connected && !showAlgEditor && visible;
  const showingGuidedSetup = PUZZLES[puzzle].smartcube && Boolean(scramble.setupTarget)
    && scramble.scrambleMode && smartcube.connected && !showAlgEditor && visible;
  const finishedSetup = useRef<typeof scramble.setupTarget>(null);
  const orientationReminder = puzzle === '2x2x2'
    ? 'Use U/R/F turns in the cube’s reference frame. If the setup does not match, reconnect and retry.'
    : ORIENTATION_REMINDER;

  const showingLastSolve =
    !training.inputMode
    && training.lastSolveText != null
    && (training.timerState === 'IDLE' || training.timerState === 'READY');
  const displayedTimerText = showingLastSolve
    ? training.lastSolveText!
    : training.timerState === 'IDLE'
      ? '0.00'
      : training.timerText;
  const timerColor = showingLastSolve
    ? 'var(--ok)'
    : training.timerState === 'READY'
      ? 'var(--ok)'
      : training.timerState === 'RUNNING'
        ? 'var(--fg3)'
        : 'var(--fg)';
  const showPbBadge =
    training.lastSolveIsPb
    && !training.inputMode
    && training.timerState !== 'RUNNING';
  const flashAccent =
    flashingIndicatorColor === 'green'
      ? 'rgba(34,197,94,0.65)'
      : flashingIndicatorColor === 'red'
        ? 'rgba(239,68,68,0.65)'
        : 'rgba(148,163,184,0.55)';
  const timerCardFlashStyle = isFlashingIndicatorVisible
    ? {
      borderColor: flashAccent,
      boxShadow: `0 0 0 1px ${flashAccent}, 0 0 24px ${flashAccent}`,
    }
    : undefined;

  const timerLabel = training.inputMode
    ? ''
    : showingLastSolve
      ? (training.lastSolveAlgName ?? 'Last')
      : training.timerState === 'IDLE'
        ? (smartcube.connected ? 'Train to begin' : 'Hold Space')
        : training.timerState === 'READY'
          ? 'Ready'
          : training.timerState === 'RUNNING'
            ? 'Solving…'
            : 'Time';

  const showPracticeTimerCard = training.selectedCases.length > 0;

  const showStatus = !showingGuidedRecovery && !showingGuidedSetup && (undoRecovery || canGuide3x3 || showBackOnTrack || Boolean(smartcube.stateSyncError) || scramble.helpTone === 'green' || training.helpTone === 'red' || scramble.scrambleMode);
  const statusColor =
    undoRecovery || canGuide3x3 || smartcube.stateSyncError || training.helpTone === 'red' ? 'var(--danger)' :
    scramble.helpTone === 'green' ? 'var(--ok)' :
    scramble.scrambleMode ? 'var(--ok)' : undefined;

  const isDangerStatus = undoRecovery || canGuide3x3 || training.helpTone === 'red';
  const isScrambleGrowHint = scramble.scrambleMode && scramble.helpTone === 'green';
  const useWarningStatusIcon = isDangerStatus || isScrambleGrowHint;
  const mergeFixIntoStatusBar = isDangerStatus && training.fixVisible && Boolean(training.fixText);

  let statusBody: ReactNode;
  if (undoRecovery || canGuide3x3) {
    statusBody = <>
      <span style={STATUS_BAR_REMINDER_LINE_STYLE}>{training.recoveryMoveCount > 1 || (canGuide3x3 && training.fixText.trim().split(/\s+/).length > 1)
        ? 'Undo your recent turns to get back on track, or use visual recovery.'
        : 'Turned the wrong way? Undo your last turn.'}</span>
      <button type="button" className="recovery-button" onClick={() => {
        training.beginRecovery(options.matchVirtualCubeOnRecovery);
        setGuidedRecovery(true);
      }}>Help me recover</button>
    </>;
  } else if (smartcube.stateSyncError) {
    statusBody = <><span>{smartcube.stateSyncError}</span><button type="button" className="recovery-button" onClick={() => { void smartcube.refreshPattern().catch(() => {}); }}>Retry reading cube</button></>;
  } else if (showBackOnTrack) {
    statusBody = <span role="status">Back on track</span>;
  } else if (isDangerStatus) {
    if (mergeFixIntoStatusBar) {
      statusBody = (
        <>
          <span style={STATUS_BAR_MOVES_LINE_STYLE}>{training.fixText}</span>
          <span style={STATUS_BAR_REMINDER_LINE_STYLE}>{orientationReminder}</span>
        </>
      );
    } else {
      statusBody = <span style={STATUS_BAR_REMINDER_LINE_STYLE}>{orientationReminder}</span>;
    }
  } else if (isScrambleGrowHint) {
    statusBody = (
      <>
        <span style={STATUS_BAR_MOVES_LINE_STYLE}>{scramble.scrambleText}</span>
        <span style={STATUS_BAR_REMINDER_LINE_STYLE}>{orientationReminder}</span>
      </>
    );
  } else if (scramble.scrambleMode) {
    statusBody = (
      <>
        <span style={STATUS_BAR_MOVES_LINE_STYLE}>{scramble.scrambleText}</span>
        {!PUZZLES[puzzle].smartcube && (
          <span style={STATUS_BAR_REMINDER_LINE_STYLE}>Apply from solved, then press Train.</span>
        )}
      </>
    );
  } else {
    statusBody = null;
  }

  const trainingPicture = useMemo(() => {
    if (!PUZZLES[puzzle].smartcube || !smartcube.connected || training.inputMode || scramble.scrambleMode
      || !training.displayAlg || !training.caseStartPattern || !smartcube.currentPattern) return null;
    if (puzzle === '3x3x3' && !training.casePicturePattern && !training.recoveredAt) return null;
    // A 2×2 report can choose a different corner frame between cases. Use
    // tracked progress so a physical R stays R in ordinary previews too.
    const current = (puzzle === '2x2x2' || training.casePicturePattern || training.recoveredAt) && training.caseCurrentPattern
      ? training.caseCurrentPattern : smartcube.currentPattern;
    if (puzzle === '3x3x3') {
      // Wide and slice turns rotate the algorithm's centers. The gyro already
      // supplies that physical rotation, so render stickers in the starting
      // center frame rather than applying the rotation a second time.
      return options.gyroscope && smartcube.gyroSupported
        ? alignForGuidance(current, training.caseStartPattern) : current;
    }
    return projectTrainingPattern(training.displayAlg, training.caseStartPattern, current, training.casePicturePattern);
  }, [puzzle, smartcube.connected, smartcube.currentPattern, training.inputMode, scramble.scrambleMode,
    training.displayAlg, training.caseStartPattern, training.casePicturePattern, training.caseCurrentPattern, training.recoveredAt,
    options.gyroscope, smartcube.gyroSupported]);
  const fixedTrainingGrip = Boolean(trainingPicture && ((training.casePicturePattern && training.caseCurrentPattern) || training.recoveredAt));
  // Compensate the device frame in the gyro, leaving sticker turns in the
  // tracked grip. Otherwise a frame change is visible as a second rotation.
  const gyroFrameQuaternion = useMemo(() => puzzle === '2x2x2' && options.gyroscope && smartcube.gyroSupported
    && trainingPicture && training.caseCurrentPattern && smartcube.currentPattern
    ? guidanceFrameRotation(training.caseCurrentPattern, smartcube.currentPattern) : undefined,
  [puzzle, options.gyroscope, smartcube.gyroSupported, trainingPicture, training.caseCurrentPattern, smartcube.currentPattern]);
  const caseNavigationDisabled = caseNavigationBusy || training.countdownActive || training.timeAttackActive || scramble.isComputing;

  async function changeCase(direction: -1 | 1) {
    if (caseNavigationDisabled) return;
    setCaseNavigationBusy(true);
    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
    scramble.clearScramble();
    lastProcessedScrambleMoveRef.current = '';
    try {
      await training.navigateCase(direction);
    } finally {
      setCaseNavigationBusy(false);
    }
  }

  const caseNavigation = training.selectedCases.length > 1 && training.currentCase && !training.inputMode && !showAlgEditor && (
    <div className="case-navigation" role="group" aria-label="Case navigation"
      onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }}
      onKeyUp={event => { if (event.code === 'Space') event.stopPropagation(); }}>
      <button type="button" aria-label="Previous case" title="Previous case — repeat the last case"
        disabled={caseNavigationDisabled || !training.canGoToPreviousCase} onClick={() => void changeCase(-1)}>
        <Icon d="M15 18l-6-6 6-6" size={18} />
        <span>Previous</span>
      </button>
      <button type="button" aria-label="Next case" title="Next case — skip this case"
        disabled={caseNavigationDisabled} onClick={() => void changeCase(1)}>
        <span>Next</span>
        <Icon d="M9 6l6 6-6 6" size={18} />
      </button>
    </div>
  );

  const cubeNode = showingGuidedSetup ? (
    <CubeGuidancePanel
      key={`${smartcube.disconnectToken}:${training.visualResetKey}:${scramble.targetAlgorithm}`}
      mode="setup"
      expertScrambler={options.expertScrambler}
      smartcube={smartcube}
      target={scramble.setupTarget!}
      pictureControls={caseNavigation}
      onRecovered={pattern => {
        const target = scramble.setupTarget!;
        if (!fixOrientation(pattern).isIdentical(fixOrientation(target))) return false;
        if (finishedSetup.current === target) return true;
        finishedSetup.current = target;
        const algorithm = scramble.targetAlgorithm;
        // The confirmed picture defines the physical grip. A device snapshot
        // may describe those same stickers in a different whole-cube frame.
        lastProcessedScrambleMoveRef.current = smartcube.lastProcessedMove?.key ?? '';
        scramble.clearScramble();
        training.setKeepInitialState(true);
        void training.trainCurrent(target, {
          algorithm, preserveDisplayedAlgorithm: true,
          statsScopeId: training.timeAttackMode ? training.statsAlgId : training.currentCase?.id,
          trackRecognition: true,
        });
        return true;
      }}
      onCancel={() => {
        scramble.clearScramble();
        void training.trainCurrent(smartcube.currentPattern, { algorithm: scramble.targetAlgorithm });
      }}
    />
  ) : showingGuidedRecovery ? (
    <CubeGuidancePanel
      key={`${training.visualResetKey}:${training.currentCase?.id ?? ''}`}
      smartcube={smartcube}
      target={training.recoveryTarget!}
      pictureControls={caseNavigation}
      expertScrambler={options.expertScrambler}
      onRecovered={training.checkRecovery}
      onGripCheck={training.setRecoveryGripCheck}
      onCancel={() => {
        training.beginRecovery(false);
        setGuidedRecovery(false);
      }}
    />
  ) : (
    <div
      style={{
        position: 'relative',
        width: isMobile ? `min(calc(100vw - 56px), ${options.cubeSizePx}px)` : `min(100%, ${options.cubeSizePx}px)`,
        height: isMobile ? `min(calc(100vw - 56px), ${options.cubeSizePx}px)` : undefined,
        aspectRatio: isMobile ? undefined : 1,
        maxWidth: '100%',
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      {caseNavigation}
      <div className={training.countdownActive ? 'cube-area-content cube-area-content--hidden' : 'cube-area-content'}
        aria-hidden={training.countdownActive}>
        <MainCubeArea
          puzzle={puzzle}
          alg={mainCubeAlg}
          targetPattern={trainingPicture}
          fixedOrientation={fixedTrainingGrip}
          sizePx={options.cubeSizePx}
          visualization={fixedTrainingGrip || (!PUZZLES[puzzle].lastLayerPreview && options.visualization.includes('LL')) ? '3D' : options.visualization}
          hintFacelets={fixedTrainingGrip ? 'none' : options.hintFacelets}
          controlPanel={options.controlPanel}
          experimentalStickering={puzzle !== '3x3x3' ? 'full' : selectedStickering}
          setupAlg={PUZZLES[puzzle].cube && options.whiteOnBottom ? 'z2' : ''}
          backView={options.backview as 'none' | 'side-by-side' | 'top-right'}
          resetToken={`${smartcube.connected}:${training.visualResetKey}`}
          orientationResetToken={orientationResetToken}
          orientationResetAlg={orientationResetAlg}
          appendMoveKey={smartcubeAppendMoveKey}
          appendMove={smartcubeAppendMove}
          gyroscopeEnabled={options.gyroscope && smartcube.connected}
          gyroFrameQuaternion={gyroFrameQuaternion}
          cubeQuaternionRef={smartcube.cubeQuaternionRef}
        />
      </div>
      {training.countdownActive ? (
        <div className="cube-countdown-overlay" aria-live="polite" aria-label={`Countdown ${training.countdownValue ?? ''}`}>
          {training.countdownValue}
        </div>
      ) : null}
    </div>
  );

  const segHeight = isMobile ? 52 : 48;
  const segButtonBase = {
    width: isMobile ? 52 : 48,
    alignSelf: 'stretch',
    border: 'none',
    borderRadius: 0,
    flexShrink: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  } as const;
  const segDivider = (
    <div aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-l)', flexShrink: 0 }} />
  );

  const algBar = (
    <div
      id="alg-bar"
      className="alg-bar alg-bar--segmented"
      style={{
        width: '100%',
        maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
        height: segHeight,
        flexShrink: 0,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--raised)',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <button
        id="train-alg"
        type="button"
        title="Train"
        onClick={() => {
          setAcknowledgedDisconnectToken(smartcube.disconnectToken);
          if (scramble.scrambleMode && (scramble.setupTarget || !options.alwaysScrambleTo || !PUZZLES[puzzle].smartcube)) {
            scramble.clearScramble();
            lastProcessedScrambleMoveRef.current = '';
          }
          if (training.timerState === 'RUNNING') {
            training.abortRunningAttempt();
            if (training.timeAttackMode) return;
          }
          void training.trainCurrent(smartcube.currentPattern);
        }}
        style={{
          ...segButtonBase,
          background: 'var(--accent)',
          color: '#fff',
        }}
      >
        <Icon d={training.timerState === 'RUNNING' ? IC.stop : IC.play} size={isMobile ? 20 : 18} />
      </button>

      {segDivider}

      <div
        className="alg-track"
        style={{
          borderRadius: 0,
          border: 'none',
          background: 'transparent',
          padding: '0 12px',
          alignSelf: 'stretch',
        }}
      >
        <input
          id="alg-input"
          type="text"
          placeholder="Enter alg e.g., (R U R' U) (R U2' R')"
          className={`alg-input alg-input--track ${training.inputMode ? '' : 'hidden'}`.trim()}
          value={training.algInput}
          onChange={(event) => training.setAlgInput(event.target.value)}
        />

        {!training.inputMode ? (
          <>
            <MoveListPanel
              darkMode={options.darkMode}
              isMoveMasked={isMoveMasked}
              setIsMoveMasked={setIsMoveMasked}
              onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
              showMoves
              showFix={false}
              variant="algTrack"
            />
            <button
              type="button"
              onClick={() => setIsMoveMasked((v) => !v)}
              title={isMoveMasked ? 'Unmask algorithm' : 'Mask algorithm'}
              style={{
                border: 'none',
                background: 'transparent',
                color: isMoveMasked ? 'var(--accent)' : 'var(--fg3)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isMoveMasked
                ? <EyeSlashIcon size={isMobile ? 28 : 32} />
                : <EyeIcon size={isMobile ? 28 : 32} />
              }
            </button>
          </>
        ) : null}
      </div>

      {!isMobile && (
        <>
          {segDivider}
          <button
            type="button"
            title="Edit algorithm"
            onClick={handleEditCurrentAlgorithm}
            style={{
              ...segButtonBase,
              background: 'transparent',
              color: 'var(--fg2)',
            }}
          >
            <Icon d={IC.edit} size={16} />
          </button>
        </>
      )}

      {segDivider}

      {PUZZLES[puzzle].available && <button
        id="scramble-to"
        type="button"
        title="Scramble To..."
        onClick={() => {
          const alreadyPreparedAlg = training.displayAlg;
          void scramble.startScrambleTo(
            alreadyPreparedAlg || training.algInput,
            training.currentCase,
            PUZZLES[puzzle].smartcube ? smartcube.currentPattern : null,
            !alreadyPreparedAlg && PUZZLES[puzzle].randomAUF && practiceToggles.randomizeAUF,
            trainingPicture,
          ).then((started) => {
            if (!started) return;
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setScrambleStartAlg(PUZZLES[puzzle].smartcube && smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : '');
            lastProcessedScrambleMoveRef.current = '';
            training.prepareForScramble();
          });
        }}
        style={{
          ...segButtonBase,
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
        }}
      >
        {scramble.isComputing ? '…' : <Icon d={IC.wand} size={isMobile ? 20 : 18} />}
      </button>}
    </div>
  );

  const statusBar = showStatus ? (
    <div
      data-testid="practice-status-bar"
      style={{
        width: '100%',
        maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
        padding: '9px 14px',
        borderRadius: 10,
        background: statusColor === 'var(--danger)' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${statusColor === 'var(--danger)' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
        color: statusColor,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}>
        {useWarningStatusIcon
          ? <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
        }
      </svg>
      <div
        data-testid="practice-status-bar-body"
        style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      >
        {statusBody}
      </div>
    </div>
  ) : null;

  const fixPanel = puzzle === '2x2x2' ? null : (
    <MoveListPanel
      darkMode={options.darkMode}
      isMoveMasked={isMoveMasked}
      setIsMoveMasked={setIsMoveMasked}
      onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
      showMoves={false}
      showFix
      suppressFixErrorStrip={mergeFixIntoStatusBar}
    />
  );

  const activeToggleChipStyle: CSSProperties = {
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  const practiceTogglesFields = (
    <>
      <Toggle
        checked={practiceToggles.smartReviewScheduling}
        disabled={practiceToggles.timeAttack}
        onChange={(checked) => practiceToggles.setSmartReviewScheduling(checked)}
        label="Smart Order"
      />
      <Toggle
        checked={PUZZLES[puzzle].randomAUF && practiceToggles.randomizeAUF}
        disabled={!PUZZLES[puzzle].randomAUF}
        onChange={(checked) => practiceToggles.setRandomizeAUF(checked)}
        label="Random AUF"
      />
      <Toggle
        checked={practiceToggles.randomOrder}
        disabled={practiceToggles.smartReviewScheduling}
        onChange={(checked) => practiceToggles.setRandomOrder(checked)}
        label="Random Order"
      />
      <Toggle
        checked={practiceToggles.prioritizeSlowCases}
        disabled={practiceToggles.smartReviewScheduling}
        onChange={(checked) => practiceToggles.setPrioritizeSlowCases(checked)}
        label="Slow First"
      />
      <Toggle
        checked={practiceToggles.prioritizeFailedCases}
        onChange={(checked) => practiceToggles.setPrioritizeFailedCases(checked)}
        label="Prioritize Failed"
      />
      <Toggle
        checked={practiceToggles.timeAttack}
        onChange={(checked) => practiceToggles.setTimeAttack(checked)}
        label="Time Attack"
      />
    </>
  );

  const practiceTogglesStrip = (
    <div style={{
      width: '100%',
      maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Collapsed header with active toggles visible */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setPracticeTogglesExpanded(!practiceTogglesExpanded)}
        role="button"
        aria-expanded={practiceTogglesExpanded}
      >
        {training.timeAttackMode && !training.inputMode ? (
          <div style={{
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 4,
          }}>
            Time Attack — Case {training.timeAttackCurrentCaseNumber} of {training.timeAttackTotalCases}
          </div>
        ) : (
          <>
            {practiceToggles.smartReviewScheduling && !practiceToggles.timeAttack && (
              <span style={activeToggleChipStyle}>Smart Order</span>
            )}
            {PUZZLES[puzzle].randomAUF && practiceToggles.randomizeAUF && (
              <span style={activeToggleChipStyle}>Random AUF</span>
            )}
            {practiceToggles.randomOrder && !practiceToggles.smartReviewScheduling && (
              <span style={activeToggleChipStyle}>Random Order</span>
            )}
            {practiceToggles.prioritizeSlowCases && !practiceToggles.smartReviewScheduling && (
              <span style={activeToggleChipStyle}>Slow First</span>
            )}
            {practiceToggles.prioritizeFailedCases && (
              <span style={activeToggleChipStyle}>Prioritize Failed</span>
            )}
            {practiceToggles.timeAttack && (
              <span style={activeToggleChipStyle}>Time Attack</span>
            )}
            {!practiceToggles.smartReviewScheduling && !practiceToggles.randomizeAUF && !practiceToggles.randomOrder &&
             !practiceToggles.prioritizeSlowCases && !practiceToggles.prioritizeFailedCases && !practiceToggles.timeAttack && (
              <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Practice options</span>
            )}
          </>
        )}
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--fg3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {practiceTogglesExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded toggles list */}
      {practiceTogglesExpanded && (
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px 20px',
          alignItems: 'center',
        }}>
          {practiceTogglesFields}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div
        className={practiceViewEnter ? 'app-view-fade-in' : undefined}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 'calc(var(--tab-h) + 12px)',
          display: visible ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Cube */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 16px 8px',
          gap: 8,
        }}>
          <div style={{
            position: 'relative',
            width: `min(calc(100vw - 32px), ${options.cubeSizePx + 24}px)`,
            maxWidth: '100%',
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
            padding: 5,
            flexShrink: 0,
          }}>
            {cubeNode}
          </div>
        </div>

        {/* Timer hero */}
        {showPracticeTimerCard ? (
          <div
            className="mobile-timer-card"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              margin: '0 12px 16px',
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              padding: '20px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              minHeight: 130,
              boxShadow: '0 4px 16px oklch(0% 0 0/0.2)',
              ...timerTransformStyle,
              ...timerCardFlashStyle,
            }}
          >
            {timerLabel ? (
              <span style={{
                fontSize: 10,
                color: 'var(--fg3)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>{timerLabel}</span>
            ) : null}
            <div className="practice-timer-value practice-timer-value--mobile" style={{
              fontFamily: 'var(--mono)',
              fontSize: 'clamp(38px, 14vw, 56px)',
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: timerColor,
              transition: 'color 0.2s',
              width: '100%',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>
              {displayedTimerText}
            </div>
            {showPbBadge ? (
              <span style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 700 }}>New PB!</span>
            ) : null}
          </div>
        ) : null}
        {training.stats.hasHistory ? (
          <div
            className="mobile-stat-chip-row"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center', flexWrap: 'wrap', margin: '-8px 12px 16px', position: 'relative', zIndex: 1 }}>
            <StatChip label="Last" value={historyTimeString(lastTime?.value ?? null)} />
            <StatChip label="Best" value={historyTimeString(bestTime)} />
            <StatChip label="Ao5" value={historyTimeString(ao5)} highlight />
          </div>
        ) : null}

        {/* Alg bar */}
        <div className="mobile-alg-bar-shell" style={{ margin: '0 12px 10px' }}>
          {algBar}
        </div>

        {/* Fix panel */}
        {fixPanel}

        {/* Status */}
        {statusBar && <div style={{ margin: '0 12px 10px' }}>{statusBar}</div>}

        {/* New alg editor */}
        <div style={{ margin: '0 12px 10px' }}>
          <NewAlgView
        puzzle={puzzle}
            visible={showAlgEditor}
            algorithmActions={algorithmActions}
            onSave={onAlgEditorSave}
            onCancel={onAlgEditorCancel}
          />
        </div>

        {/* Mini stats */}
        {training.stats.hasHistory && (
          <div style={{
            margin: '0 12px 10px',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
          >
            <div className="recent-times-header">
              <div style={{
                fontSize: 10,
                color: 'var(--fg3)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              >
                {options.showAlgName && !training.countdownActive ? training.currentAlgName : 'Recent times'}
              </div>
              <RecentTimesModeToggle
                showTimesInsteadOfGraph={showTimesInsteadOfGraph}
                onToggle={() => setShowTimesInsteadOfGraph((v) => !v)}
              />
            </div>
            <div
              className={showTimesInsteadOfGraph ? 'times-display' : 'times-display hidden'}
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
              </div>
            </div>
            <div
              id="graph-display"
              className={showTimesInsteadOfGraph ? 'graph-display hidden' : 'graph-display'}
            >
              <canvas id="timeGraph" />
            </div>
          </div>
        )}

        {/* Practice toggles */}
        {!showAlgEditor && (
        <div style={{ margin: '0 12px 10px' }}>
          {practiceTogglesStrip}
        </div>
        )}

        {/* Stats graph */}
        <div style={{ margin: '0 12px 10px' }}>
          <StatsPanel
            visible={!showAlgEditor}
            showAlgName={options.showAlgName && !training.countdownActive}
            algName={training.currentAlgName}
            stats={training.stats}
            onOpenCaseLibrary={onOpenCaseLibrary}
            learnedState={currentCaseLearnedState}
            onCycleLearnedState={training.statsAlgId ? () => onCycleLearnedState(training.statsAlgId) : undefined}
          />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      className={practiceViewEnter ? 'app-view-fade-in' : undefined}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '18px 20px',
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* 3-col top area */}
      <div className="practice-top-grid">
        {/* LEFT: stats card (hidden until there's solve history) */}
        <div className="practice-side-column practice-side-column--left">
          {training.stats.hasHistory ? (
            <div className="practice-recent-card" style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
            >
              <div className="recent-times-header">
                <div style={{
                  fontSize: 10,
                  color: 'var(--fg3)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                >
                  {options.showAlgName && !training.countdownActive ? training.currentAlgName : 'Recent times'}
                </div>
                <RecentTimesModeToggle
                  showTimesInsteadOfGraph={showTimesInsteadOfGraph}
                  onToggle={() => setShowTimesInsteadOfGraph((v) => !v)}
                />
              </div>
              <div className={`${showTimesInsteadOfGraph ? 'times-display' : 'hidden times-display'}`.trim()}>
                <div className="times-grid">
                  {training.stats.lastFive.map((entry, index) => (
                    <Fragment key={`time-row-d-${entry.value}-${entry.label}-${index}`}>
                      <div className="times-grid-label">{entry.label.split(': ')[0]}:</div>
                      <div className="times-grid-value">
                        {entry.label.split(': ').slice(1).join(': ')}{entry.isPb ? ' 🎉' : ''}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
              <div
                id="graph-display"
                className={showTimesInsteadOfGraph ? 'graph-display hidden' : 'graph-display'}
              >
                <canvas id="timeGraph" />
              </div>
            </div>
          ) : null}
        </div>

        {/* CENTER: cube */}
        <div className="practice-cube-column">
          <div className="practice-cube-card" style={{
            position: 'relative',
            maxWidth: `calc(${options.cubeSizePx}px + 28px)`,
            padding: 5,
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
          }}>
            {cubeNode}
          </div>
        </div>

        {/* RIGHT: timer */}
        <div
          className="practice-side-column practice-side-column--right"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            gap: 12,
          }}
        >
          {showPracticeTimerCard ? (
            <div className="practice-timer-card" style={{
              padding: '18px 22px',
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
              width: '100%',
              minHeight: 140,
              ...timerTransformStyle,
              ...timerCardFlashStyle,
            }}
            >
              {timerLabel ? (
                <span style={{
                  fontSize: 10,
                  color: 'var(--fg3)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                }}>{timerLabel}</span>
              ) : null}
              <div className="practice-timer-value" style={{
                fontFamily: 'var(--mono)',
                fontSize: 'clamp(40px, 3.2vw, 60px)',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: timerColor,
                transition: 'color 0.2s',
                width: '100%',
                whiteSpace: 'nowrap',
              }}>
                {displayedTimerText}
              </div>
              {showPbBadge ? (
                <span style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 700 }}>New PB!</span>
              ) : null}
            </div>
          ) : null}
          {training.stats.hasHistory ? (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
            }}>
              <StatChip label="Last" value={historyTimeString(lastTime?.value ?? null)} />
              <StatChip label="Best" value={historyTimeString(bestTime)} />
              <StatChip label="Ao5" value={historyTimeString(ao5)} highlight />
            </div>
          ) : null}
        </div>
      </div>

      {/* Alg bar */}
      {algBar}

      {/* Fix panel */}
      {fixPanel}

      {/* Status */}
      {statusBar}

      {/* New alg editor inline */}
      <div style={{ width: '100%', maxWidth: 'var(--practice-alg-track-max)' }}>
        <NewAlgView
        puzzle={puzzle}
          visible={showAlgEditor}
          algorithmActions={algorithmActions}
          onSave={onAlgEditorSave}
          onCancel={onAlgEditorCancel}
        />
      </div>

      {/* Practice toggles */}
      {!showAlgEditor && practiceTogglesStrip}

      {/* Big stats graph (#alg-stats) */}
      <div style={{ width: '100%', maxWidth: 'var(--practice-alg-track-max)' }}>
        <StatsPanel
          visible={!showAlgEditor}
          showAlgName={options.showAlgName && !training.countdownActive}
          algName={training.currentAlgName}
          stats={training.stats}
          onOpenCaseLibrary={onOpenCaseLibrary}
          learnedState={currentCaseLearnedState}
          onCycleLearnedState={training.statsAlgId ? () => onCycleLearnedState(training.statsAlgId) : undefined}
        />
      </div>

      {/* Keep this referenced until timer row is extracted into its own component. */}
      <button type="button" className="hidden" onClick={handleTouchTimerActivation} aria-hidden />
    </div>
  );
});
