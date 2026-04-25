import { Fragment, memo } from 'react';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { PracticeTogglesState } from '../hooks/usePracticeToggles';
import type { TrainingState } from '../hooks/useTrainingState';
import type { ScrambleState } from '../hooks/useScrambleState';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import { averageOfFiveTimeNumber, historyTimeString } from '../lib/case-cards';
import { getBestTime } from '../lib/storage';
import { patternToPlayerAlg } from '../lib/scramble';
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

export const PracticeView = memo(function PracticeView({
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
}: {
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
}) {

  const statsAlgId = training.statsAlgId;
  const bestTime = getBestTime(statsAlgId);
  const ao5 = averageOfFiveTimeNumber(statsAlgId);
  const lastTime = training.stats.lastFive.at(-1);

  const timerColor =
    training.timerState === 'READY'
      ? 'var(--ok)'
      : training.timerState === 'RUNNING'
        ? 'var(--fg3)'
        : 'var(--fg)';
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
    : training.timerState === 'IDLE'
      ? (smartcube.connected ? 'Train to begin' : 'Hold Space')
      : training.timerState === 'READY'
        ? 'Release!'
        : training.timerState === 'RUNNING'
          ? 'Solving…'
          : 'Time';

  const showStatus = scramble.helpTone === 'green' || training.helpTone === 'red' || scramble.scrambleMode;
  const statusColor =
    training.helpTone === 'red' ? 'var(--danger)' :
    scramble.helpTone === 'green' ? 'var(--ok)' :
    scramble.scrambleMode ? 'var(--ok)' : undefined;
  const statusText =
    training.helpTone === 'red'
      ? 'Ensure the cube is oriented with WHITE center on top and GREEN center on front.'
      : scramble.scrambleMode
        ? scramble.scrambleText
        : scramble.helpTone === 'green'
          ? 'Scramble complete — cube is ready. Press space to start timer.'
          : '';

  const cubeNode = (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: options.cubeSizePx,
        height: options.cubeSizePx,
        maxWidth: '100%',
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      <div className={training.countdownActive ? 'cube-area-content cube-area-content--hidden' : 'cube-area-content'}
        aria-hidden={training.countdownActive}>
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
          orientationResetToken={orientationResetToken}
          orientationResetAlg={orientationResetAlg}
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
  );

  const algBar = (
    <div
      id="alg-bar"
      className="alg-bar"
      style={{
        gap: 8,
        width: '100%',
        maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
      }}
    >
      <button
        id="train-alg"
        type="button"
        title="Train"
        onClick={() => {
          setAcknowledgedDisconnectToken(smartcube.disconnectToken);
          if (scramble.scrambleMode && !options.alwaysScrambleTo) {
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
          width: isMobile ? 48 : 44,
          height: isMobile ? 48 : 44,
          borderRadius: 12,
          border: 'none',
          flexShrink: 0,
          background: 'var(--accent)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
        }}
      >
        <Icon d={training.timerState === 'RUNNING' ? IC.stop : IC.play} size={isMobile ? 20 : 18} />
      </button>

      <div
        className="alg-track"
        style={{
          borderRadius: isMobile ? 12 : 8,
          border: '1px solid var(--border)',
          background: isMobile ? 'var(--surface)' : 'var(--raised)',
          padding: '10px 12px',
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
                ? <EyeSlashIcon size={isMobile ? 18 : 16} />
                : <EyeIcon size={isMobile ? 18 : 16} />
              }
            </button>
          </>
        ) : null}
      </div>

      {!isMobile && (
        <button
          type="button"
          title="Edit algorithm"
          onClick={handleEditCurrentAlgorithm}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            border: '1px solid var(--border)',
            flexShrink: 0,
            background: 'var(--raised)',
            color: 'var(--fg2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={IC.edit} size={16} />
        </button>
      )}

      <button
        id="scramble-to"
        type="button"
        title="Scramble To..."
        onClick={() => {
          const alreadyPreparedAlg = training.displayAlg;
          void scramble.startScrambleTo(
            alreadyPreparedAlg || training.algInput,
            training.currentCase,
            smartcube.currentPattern,
            !alreadyPreparedAlg && practiceToggles.randomizeAUF,
          ).then((started) => {
            if (!started) return;
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setScrambleStartAlg(smartcube.currentPattern ? patternToPlayerAlg(smartcube.currentPattern) : '');
            lastProcessedScrambleMoveRef.current = '';
            training.prepareForScramble();
          });
        }}
        style={{
          width: isMobile ? 48 : 44,
          height: isMobile ? 48 : 44,
          borderRadius: isMobile ? 12 : 8,
          border: isMobile ? 'none' : '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--accent)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
        }}
      >
        {scramble.isComputing ? '…' : <Icon d={IC.wand} size={isMobile ? 20 : 18} />}
      </button>
    </div>
  );

  const statusBar = showStatus ? (
    <div style={{
      width: '100%',
      maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
      padding: '9px 14px',
      borderRadius: 10,
      background: statusColor === 'var(--danger)' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
      border: `1px solid ${statusColor === 'var(--danger)' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
      color: statusColor,
      fontSize: 12,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        {statusColor === 'var(--danger)'
          ? <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
        }
      </svg>
      {statusText}
    </div>
  ) : null;

  const fixPanel = (
    <MoveListPanel
      darkMode={options.darkMode}
      isMoveMasked={isMoveMasked}
      setIsMoveMasked={setIsMoveMasked}
      onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
      showMoves={false}
      showFix
    />
  );

  const practiceTogglesStrip = (
    <div style={{
      width: '100%',
      maxWidth: isMobile ? undefined : 'var(--practice-alg-track-max)',
      padding: '10px 14px',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0px 20px',
      alignItems: 'center',
    }}>
      {training.timeAttackMode && !training.inputMode ? (
        <div style={{
          width: '100%',
          padding: '4px 0',
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 600,
        }}>
          Time Attack — Case {training.timeAttackCurrentCaseNumber} of {training.timeAttackTotalCases}
        </div>
      ) : null}
      <Toggle
        checked={practiceToggles.smartReviewScheduling}
        disabled={practiceToggles.timeAttack}
        onChange={(checked) => practiceToggles.setSmartReviewScheduling(checked)}
        label="Smart Order"
      />
      <Toggle
        checked={practiceToggles.randomizeAUF}
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
        label="Slow Cases First"
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
    </div>
  );

  if (isMobile) {
    return (
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 'calc(var(--tab-h) + 12px)',
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        position: 'relative',
      }}>
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
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 12,
            flexShrink: 0,
            boxShadow: '0 8px 24px oklch(0% 0 0/0.25)',
          }}>
            {training.timerState === 'RUNNING' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                border: '2px solid var(--ok)',
                animation: 'pulse 1s infinite',
                pointerEvents: 'none',
              }} />
            )}
            {cubeNode}
          </div>
          <span style={{ fontSize: 11, color: 'var(--fg3)' }}>White top · Green front</span>
        </div>

        {/* Timer hero */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            margin: '0 12px 10px',
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '20px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            minHeight: 130,
            boxShadow: '0 4px 16px oklch(0% 0 0/0.2)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
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
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 56,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: timerColor,
            transition: 'color 0.2s',
          }}>
            {training.timerState === 'IDLE' ? '0.00' : training.timerText}
          </div>
          {training.stats.lastFive.at(-1)?.isPb ? (
            <span style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 700 }}>New PB!</span>
          ) : null}
          <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
            {lastTime && <StatChip label="Last" value={historyTimeString(lastTime.value)} />}
            <StatChip label="Best" value={historyTimeString(bestTime)} />
            <StatChip label="Ao5" value={historyTimeString(ao5)} highlight />
          </div>
        </div>

        {/* Alg bar */}
        <div style={{ margin: '0 12px 10px' }}>
          {algBar}
        </div>

        {/* Fix panel */}
        {fixPanel}

        {/* Status */}
        {statusBar && <div style={{ margin: '0 12px 10px' }}>{statusBar}</div>}

        {/* New alg editor */}
        <div style={{ margin: '0 12px 10px' }}>
          <NewAlgView
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
              className={`${showTimesInsteadOfGraph ? 'times-display' : 'hidden times-display'}`.trim()}
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
                <div className="times-grid-value times-grid-emphasis">{historyTimeString(averageOfFiveTimeNumber(statsAlgId))}</div>
                <div className="times-grid-label">Best:</div>
                <div className="times-grid-value">{historyTimeString(getBestTime(statsAlgId))}</div>
              </div>
            </div>
            <div
              id="graph-display"
              className={`${showTimesInsteadOfGraph ? 'hidden graph-display' : 'graph-display'}`.trim()}
            >
              <canvas id="timeGraph" />
            </div>
          </div>
        )}

        {/* Practice toggles */}
        <div style={{ margin: '0 12px 10px' }}>
          <div style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0 16px',
          }}>
            <Toggle
              checked={practiceToggles.smartReviewScheduling}
              disabled={practiceToggles.timeAttack}
              onChange={(checked) => practiceToggles.setSmartReviewScheduling(checked)}
              label="Smart Order"
            />
            <Toggle
              checked={practiceToggles.randomizeAUF}
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
          </div>
        </div>

        {/* Stats graph */}
        <div style={{ margin: '0 12px 10px' }}>
          <StatsPanel
            visible
            showAlgName={options.showAlgName && !training.countdownActive}
            algName={training.currentAlgName}
            stats={training.stats}
          />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '18px 20px',
      display: visible ? 'flex' : 'none',
      flexDirection: 'column',
      gap: 14,
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* 3-col top area */}
      <div className="practice-top-grid">
        {/* LEFT: stats card */}
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
                  <div className="times-grid-label times-grid-emphasis">Ao5:</div>
                  <div className="times-grid-value times-grid-emphasis">{historyTimeString(averageOfFiveTimeNumber(statsAlgId))}</div>
                  <div className="times-grid-label">Best:</div>
                  <div className="times-grid-value">{historyTimeString(getBestTime(statsAlgId))}</div>
                </div>
              </div>
              <div
                id="graph-display"
                className={`${showTimesInsteadOfGraph ? 'hidden graph-display' : 'graph-display'}`.trim()}
              >
                <canvas id="timeGraph" />
              </div>
            </div>
          ) : (
            <div className="practice-recent-card" style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--fg3)',
              fontSize: 12,
              textAlign: 'center',
            }}>
              No solve history yet
            </div>
          )}
        </div>

        {/* CENTER: cube */}
        <div className="practice-cube-column">
          <div style={{
            position: 'relative',
            padding: 14,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}>
            {training.timerState === 'RUNNING' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                border: '2px solid var(--ok)',
                animation: 'pulse 1s infinite',
                pointerEvents: 'none',
              }} />
            )}
            {cubeNode}
          </div>
          <span style={{ fontSize: 11, color: 'var(--fg3)' }}>White top · Green front</span>
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
          <div style={{
            padding: '18px 22px',
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            width: '100%',
            minHeight: 140,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            ...timerCardFlashStyle,
          }}>
            {timerLabel ? (
              <span style={{
                fontSize: 10,
                color: 'var(--fg3)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>{timerLabel}</span>
            ) : null}
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 60,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: timerColor,
              transition: 'color 0.2s',
            }}>
              {training.timerState === 'IDLE' ? '0.00' : training.timerText}
            </div>
            {training.stats.lastFive.at(-1)?.isPb ? (
              <span style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 700 }}>New PB!</span>
            ) : null}
          </div>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            {lastTime && <StatChip label="Last" value={historyTimeString(lastTime.value)} />}
            <StatChip label="Best" value={historyTimeString(bestTime)} />
            <StatChip label="Ao5" value={historyTimeString(ao5)} highlight />
          </div>
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
          visible={showAlgEditor}
          algorithmActions={algorithmActions}
          onSave={onAlgEditorSave}
          onCancel={onAlgEditorCancel}
        />
      </div>

      {/* Practice toggles strip */}
      {practiceTogglesStrip}

      {/* Big stats graph */}
      <div style={{ width: '100%', maxWidth: 'var(--practice-alg-track-max)' }}>
        <StatsPanel
          visible
          showAlgName={options.showAlgName && !training.countdownActive}
          algName={training.currentAlgName}
          stats={training.stats}
        />
      </div>

      {/* Keep this referenced until timer row is extracted into its own component. */}
      <button type="button" className="hidden" onClick={handleTouchTimerActivation} aria-hidden />
    </div>
  );
});
