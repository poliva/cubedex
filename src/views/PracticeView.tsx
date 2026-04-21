import { Fragment, memo, useState } from 'react';
import type { CaseLibraryState } from '../hooks/useCaseLibrary';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { PracticeTogglesState } from '../hooks/usePracticeToggles';
import type { TrainingState } from '../hooks/useTrainingState';
import type { ScrambleState } from '../hooks/useScrambleState';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import { ToggleSwitch } from '../components/ToggleSwitch';
import {
  AlgHelpInfoIcon,
  BluetoothIcon,
  PlayIcon,
  ScatterIcon,
  StopIcon,
} from '../components/Icons';
import { averageOfFiveTimeNumber, makeTimeParts } from '../lib/case-cards';
import { getBestTime } from '../lib/storage';
import { patternToPlayerAlg } from '../lib/scramble';
import { CaseGrid } from './CaseGrid';
import { MainCubeArea } from './MainCubeArea';
import { MoveListPanel } from './MoveListPanel';
import { StatsPanel } from './StatsPanel';
import { NewAlgView } from './NewAlgView';

function formatHistoryMetric(time: number | null) {
  if (!time) {
    return '-';
  }

  const parts = makeTimeParts(time);
  const minutesPart = parts.minutes > 0 ? `${parts.minutes}:` : '';
  return `${minutesPart}${parts.seconds.toString(10).padStart(2, '0')}.${parts.milliseconds.toString(10).padStart(3, '0')}`;
}

export const PracticeView = memo(function PracticeView({
  topVisible,
  practiceVisible,
  options,
  practiceToggles,
  caseLibrary,
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
  setMainCubeStickeringDeferred,
  lastProcessedScrambleMoveRef,
  setScrambleStartAlg,
  setDeleteMode,
  deleteMode,
  deleteSuccessMessage,
  handleDeleteAlgorithms,
  handleDeleteTimes,
  showTimesInsteadOfGraph,
  setShowTimesInsteadOfGraph,
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
}: {
  topVisible: boolean;
  practiceVisible: boolean;
  options: AppSettingsState;
  practiceToggles: PracticeTogglesState;
  caseLibrary: CaseLibraryState;
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
  setMainCubeStickeringDeferred: (value: boolean) => void;
  lastProcessedScrambleMoveRef: { current: string };
  setScrambleStartAlg: (value: string) => void;
  setDeleteMode: (value: boolean) => void;
  deleteMode: boolean;
  deleteSuccessMessage: string;
  handleDeleteAlgorithms: () => void;
  handleDeleteTimes: () => void;
  showTimesInsteadOfGraph: boolean;
  setShowTimesInsteadOfGraph: (updater: (value: boolean) => boolean) => void;
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
}) {
  const {
    categories,
    selectedCategory,
    subsets,
    selectedSubsets,
    caseCards,
    selectAllCases,
    selectLearningCases,
    selectLearnedCases,
    setSelectedCategory,
    toggleSubset,
    toggleAllSubsets,
    setSelectAllCases,
    setSelectLearningCases,
    setSelectLearnedCases,
  } = caseLibrary;
  const [orientationResetState, setOrientationResetState] = useState<{ token: number; alg: string | null }>({
    token: 0,
    alg: null,
  });
  const showResetGyro = smartcube.connected && options.gyroscope && smartcube.gyroSupported;
  const showResetOrientation = smartcube.connected && (!smartcube.gyroSupported || !options.gyroscope);

  /*
  const lastAutoOrientationResetMoveKeyRef = useRef<string>('');
  useEffect(() => {
    const last = smartcube.lastProcessedMove;
    if (!last || !smartcube.connected) return;

    const moveKey = last.key ?? '';
    if (!moveKey || lastAutoOrientationResetMoveKeyRef.current === moveKey) {
      return;
    }

    const raw = last.rawMoves?.map((m) => m.move) ?? [];
    const isOppositeUD =
      raw.length === 2;
      //&& ((raw[0] === 'U' && raw[1] === "D'") || (raw[0] === "D'" && raw[1] === 'U'));
    const isNonGyroMode = !options.gyroscope || !smartcube.gyroSupported;
    const shouldAutoReset = isNonGyroMode && raw.length === 2 && (last.visualMove === 'E' || last.visualMove === "E'" || last.visualMove === "S'" || last.visualMove === "S");
    if (!shouldAutoReset) return;

    console.log('[auto orientation reset]');
    lastAutoOrientationResetMoveKeyRef.current = moveKey;
    smartcube.resetOrientation();
    setOrientationResetState((current) => ({
      token: current.token + 1,
      alg: smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : null,
    }));
  }, [options.gyroscope, smartcube, smartcube.connected, smartcube.currentPattern, smartcube.gyroSupported, smartcube.lastProcessedMove]);
  */

  return (
    <>
      <div id="app-top" className={topVisible ? '' : 'hidden'}>
        <div id="container" className="top-grid-shell">
          <div
            id="flashing-indicator"
            className={`${isFlashingIndicatorVisible ? 'flashing-indicator' : 'hidden flashing-indicator'}`}
            style={{ backgroundColor: flashingIndicatorColor }}
          />

          <div id="left-side" className="top-column left-column">
            <div
              id="left-side-inner"
              className={`${training.stats.hasHistory && practiceVisible ? 'shell-card side-card' : 'hidden shell-card side-card'}`}
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
                  {options.showAlgName && !training.countdownActive ? training.currentAlgName : ''}
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
            <div
              className={training.countdownActive ? 'cube-area-content cube-area-content--hidden' : 'cube-area-content'}
              aria-hidden={training.countdownActive}
            >
              <MainCubeArea
                alg={mainCubeAlg}
                sizePx={options.cubeSizePx}
                visualization={options.visualization}
                hintFacelets={options.hintFacelets}
                controlPanel={options.controlPanel}
                experimentalStickering={selectedStickering}
                setupAlg={options.whiteOnBottom ? 'z2' : ''}
                backView={options.backview as 'none' | 'side-by-side' | 'top-right'}
                resetToken={`${smartcube.connected}:${training.visualResetKey}`}
                orientationResetToken={orientationResetState.token}
                orientationResetAlg={orientationResetState.alg}
                appendMoveKey={smartcubeAppendMoveKey}
                appendMove={smartcubeAppendMove}
                gyroscopeEnabled={options.gyroscope && smartcube.connected}
                cubeQuaternionRef={smartcube.cubeQuaternionRef}
              />
            </div>
            {training.countdownActive ? (
              <div className="cube-countdown-overlay" aria-live="polite" aria-label={`Countdown ${training.countdownValue ?? ''}`}>
                {training.countdownValue}
              </div>
            ) : null}
          </div>

          <div id="right-side" className="top-column right-column">
            <div className="connect-row">
              <button
                id="header-reset-gyro"
                className={showResetGyro ? 'primary-button' : 'primary-button hidden'}
                type="button"
                disabled={!smartcube.connected || !options.gyroscope || !smartcube.gyroSupported}
                title="Reset gyroscope orientation for the virtual cube"
                aria-label="Reset gyroscope orientation for the virtual cube"
                onClick={() => smartcube.resetGyro()}
              >
                Reset Gyro
              </button>
              <button
                id="header-reset-orientation"
                className={showResetOrientation ? 'primary-button' : 'primary-button hidden'}
                type="button"
                disabled={!smartcube.connected}
                title="Reset the virtual cube orientation to its default view"
                aria-label="Reset the virtual cube orientation to its default view"
                onClick={() => {
                  smartcube.resetOrientation();
                  setOrientationResetState((current) => ({
                    token: current.token + 1,
                    alg: smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : null,
                  }));
                }}
              >
                Reset Orientation
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
              <div className="timer-stack">
                <div
                  className={`${training.timeAttackMode && !training.inputMode ? 'time-attack-banner' : 'hidden time-attack-banner'}`}
                >
                  <span className="time-attack-banner-title">Complete all cases continuously</span>
                  {training.timeAttackTotalCases > 0 ? (
                    <span className="time-attack-banner-progress">
                      Case {training.timeAttackCurrentCaseNumber} of {training.timeAttackTotalCases}
                    </span>
                  ) : null}
                </div>
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
                if (training.timeAttackMode) {
                  return;
                }
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

          <MoveListPanel
            className={training.inputMode ? 'hidden' : ''}
            darkMode={options.darkMode}
            isMoveMasked={isMoveMasked}
            setIsMoveMasked={setIsMoveMasked}
            onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
            showMoves
            showFix={false}
          />

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

        <NewAlgView
          visible={showAlgEditor}
          algorithmActions={algorithmActions}
          onSave={onAlgEditorSave}
          onCancel={onAlgEditorCancel}
        />

        <div
          id="alg-help-info"
          className={`${scramble.helpTone === 'green' || training.helpTone === 'red' ? 'info-inline' : 'hidden info-inline'}`}
          style={{ color: training.helpTone === 'red' ? '#f87171' : scramble.helpTone === 'green' ? '#34d399' : undefined }}
        >
          <div className="info-inline-row">
            <AlgHelpInfoIcon />
            <p className="info-inline-row-text">Ensure the cube is oriented with WHITE center on top and GREEN center on front.</p>
          </div>
        </div>
        <MoveListPanel
          darkMode={options.darkMode}
          isMoveMasked={isMoveMasked}
          setIsMoveMasked={setIsMoveMasked}
          onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
          showMoves={false}
          showFix
        />
        <div id="alg-scramble" className={`${scramble.scrambleMode ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
          {scramble.scrambleText}
        </div>
      </div>

      <StatsPanel
        visible={practiceVisible}
        showAlgName={options.showAlgName && !training.countdownActive}
        algName={training.currentAlgName}
        stats={training.stats}
      />

      <div id="load-container" className={`load-panel shell-card ${practiceVisible ? '' : 'hidden'}`.trim()}>
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
              <ToggleSwitch
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
              <ToggleSwitch
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
              <ToggleSwitch
                id="select-learned-toggle"
                checked={selectLearnedCases}
                onChange={(checked) => {
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  if (checked) {
                    setMainCubeStickeringDeferred(false);
                  }
                  setSelectLearnedCases(checked);
                }}
                label="Select Learned"
              />
              <ToggleSwitch
                id="random-auf-toggle"
                checked={practiceToggles.randomizeAUF}
                onChange={(checked) => practiceToggles.setRandomizeAUF(checked)}
                label="Random AUF"
              />
              <ToggleSwitch
                id="random-order-toggle"
                checked={practiceToggles.randomOrder}
                onChange={(checked) => practiceToggles.setRandomOrder(checked)}
                label="Random Order"
              />
              <ToggleSwitch
                id="prioritize-slow-toggle"
                checked={practiceToggles.prioritizeSlowCases}
                onChange={(checked) => practiceToggles.setPrioritizeSlowCases(checked)}
                label="Slow Cases First"
              />
              <ToggleSwitch
                id="prioritize-failed-toggle"
                checked={practiceToggles.prioritizeFailedCases}
                onChange={(checked) => practiceToggles.setPrioritizeFailedCases(checked)}
                label="Prioritize Failed Cases"
              />
              <ToggleSwitch
                id="time-attack-toggle"
                checked={practiceToggles.timeAttack}
                onChange={(checked) => practiceToggles.setTimeAttack(checked)}
                label="Time Attack"
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

        <CaseGrid caseCards={caseCards} />

        <div className="delete-mode-container">
          <ToggleSwitch
            id="delete-mode-toggle"
            className="toggle-switch--inline"
            checked={deleteMode}
            onChange={(checked) => {
              setDeleteMode(checked);
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

      {/* Keep this referenced until timer row is extracted into its own component. */}
      <button type="button" className="hidden" onClick={handleTouchTimerActivation} aria-hidden />
    </>
  );
});

