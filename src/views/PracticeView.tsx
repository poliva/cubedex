import { Fragment, memo, useState } from 'react';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { PracticeTogglesState } from '../hooks/usePracticeToggles';
import type { TrainingState } from '../hooks/useTrainingState';
import type { ScrambleState } from '../hooks/useScrambleState';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import { averageOfFiveTimeNumber, historyTimeString } from '../lib/case-cards';
import { getBestTime, getLastTimes } from '../lib/storage';
import { patternToPlayerAlg } from '../lib/scramble';
import { MainCubeArea } from './MainCubeArea';
import { MoveListPanel } from './MoveListPanel';
import { StatsPanel } from './StatsPanel';
import { NewAlgView } from './NewAlgView';
import { Icon, IC } from '../components/ui/Icon';

function MiniGraph({ times, width = 180 }: { times: number[]; width?: number }) {
  if (times.length < 2) return null;
  const h = 52, pad = 4;
  const w = width;
  const min = Math.min(...times), max = Math.max(...times), range = max - min || 1;
  const pts = times.map((t, i) => {
    const x = pad + (i / (times.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (t - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const lastX = pad + ((times.length - 1) / (times.length - 1)) * (w - pad * 2);
  const lastY = pad + (1 - (times[times.length - 1] - min) / range) * (h - pad * 2);
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${pts} ${w - pad},${h}`} fill="url(#mg)" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--accent)" />
    </svg>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      padding: '7px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--raised)',
      minWidth: 70,
      flex: '0 0 auto',
    }}>
      <span style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 15,
        fontWeight: 600,
        color: highlight ? 'var(--accent)' : 'var(--fg)',
      }}>{value}</span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const w = 30, h = 17, dot = 13;
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none',
      minHeight: 44,
      opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{
        position: 'relative',
        width: w,
        height: h,
        flexShrink: 0,
        background: checked ? 'var(--accent)' : 'var(--border)',
        borderRadius: 99,
        transition: 'background 0.2s',
        display: 'block',
      }}>
        <span style={{
          position: 'absolute',
          top: (h - dot) / 2,
          left: checked ? w - dot - 2 : 2,
          width: dot,
          height: dot,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 4px oklch(0% 0 0/0.3)',
          transition: 'left 0.2s',
        }} />
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
      </span>
      {label && <span style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.3 }}>{label}</span>}
    </label>
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
}) {
  const [orientationResetState, setOrientationResetState] = useState<{ token: number; alg: string | null }>({
    token: 0,
    alg: null,
  });

  const statsAlgId = training.statsAlgId;
  const recentTimes = getLastTimes(statsAlgId);
  const bestTime = getBestTime(statsAlgId);
  const ao5 = averageOfFiveTimeNumber(statsAlgId);
  const lastTime = training.stats.lastFive.at(-1);

  const timerColor =
    training.timerState === 'READY'
      ? 'var(--ok)'
      : training.timerState === 'RUNNING'
        ? 'var(--fg3)'
        : 'var(--fg)';

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
        width: `min(100%, ${options.cubeSizePx}px)`,
        aspectRatio: '1',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'visible',
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
  );

  const algBar = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      maxWidth: isMobile ? undefined : 900,
    }}>
      <button
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
          background: training.timerState === 'RUNNING' ? 'var(--danger)' : 'var(--accent)',
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

      <input
        id="alg-input"
        type="text"
        placeholder="Enter alg e.g., (R U R' U) (R U2' R')"
        className={`alg-input ${training.inputMode ? '' : 'hidden'}`.trim()}
        value={training.algInput}
        onChange={(event) => training.setAlgInput(event.target.value)}
      />

      {/* Alg display in non-input mode */}
      <div style={{
        flex: 1,
        borderRadius: isMobile ? 12 : 8,
        border: '1px solid var(--border)',
        background: isMobile ? 'var(--surface)' : 'var(--raised)',
        padding: '10px 12px',
        display: training.inputMode ? 'none' : 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        minWidth: 0,
      }}>
        <MoveListPanel
          darkMode={options.darkMode}
          isMoveMasked={isMoveMasked}
          setIsMoveMasked={setIsMoveMasked}
          onEditCurrentAlgorithm={handleEditCurrentAlgorithm}
          showMoves
          showFix={false}
          inlineStyle
        />
        <button
          type="button"
          onClick={() => setIsMoveMasked((v) => !v)}
          style={{
            border: 'none',
            background: 'transparent',
            color: isMoveMasked ? 'var(--accent)' : 'var(--fg3)',
            cursor: 'pointer',
            padding: 4,
            flexShrink: 0,
            display: 'flex',
          }}
        >
          <Icon d={IC.mask} size={isMobile ? 18 : 16} />
        </button>
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
        {scramble.isComputing ? '…' : <Icon d={IC.scatter} size={isMobile ? 20 : 18} />}
      </button>
    </div>
  );

  const statusBar = showStatus ? (
    <div style={{
      width: '100%',
      maxWidth: isMobile ? undefined : 900,
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
      maxWidth: isMobile ? undefined : 900,
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
        {/* Flashing indicator */}
        {isFlashingIndicatorVisible && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: flashingIndicatorColor,
            opacity: 0.75,
            zIndex: 50,
            animation: 'flash 1s infinite',
            pointerEvents: 'none',
          }} />
        )}

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
            display: 'inline-flex',
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
            boxShadow: '0 4px 16px oklch(0% 0 0/0.2)',
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
          }}>
            <div style={{
              fontSize: 10,
              color: 'var(--fg3)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              {options.showAlgName && !training.countdownActive ? training.currentAlgName : 'Recent times'}
            </div>
            <MiniGraph times={recentTimes.slice(-10)} width={280} />
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
      {/* Flashing indicator */}
      {isFlashingIndicatorVisible && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: flashingIndicatorColor,
          opacity: 0.75,
          zIndex: 50,
          animation: 'flash 1s infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* 3-col top area */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 14,
        alignItems: 'stretch',
      }}>
        {/* LEFT: stats card */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {training.stats.hasHistory ? (
            <div style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}>
              <div style={{
                fontSize: 10,
                color: 'var(--fg3)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}>
                {options.showAlgName && !training.countdownActive ? training.currentAlgName : 'Recent times'}
              </div>
              <MiniGraph times={recentTimes.slice(-10)} width={180} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <StatChip label="Best" value={historyTimeString(bestTime)} />
                <StatChip label="Ao5" value={historyTimeString(ao5)} highlight />
              </div>
            </div>
          ) : (
            <div style={{
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minWidth: 210,
        }}>
          <div style={{
            position: 'relative',
            padding: 14,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'inline-flex',
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
      <div style={{ width: '100%', maxWidth: 900 }}>
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
      <div style={{ width: '100%', maxWidth: 900 }}>
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
