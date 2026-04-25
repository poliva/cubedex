import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PracticeView } from '../../src/views/PracticeView';

vi.mock('../../src/views/CaseGrid', () => ({ CaseGrid: () => <div data-testid="case-grid" /> }));
vi.mock('../../src/views/MainCubeArea', () => ({ MainCubeArea: () => <div data-testid="main-cube-area" /> }));
vi.mock('../../src/views/MoveListPanel', () => ({ MoveListPanel: () => <div data-testid="move-list-panel" /> }));
vi.mock('../../src/views/StatsPanel', () => ({ StatsPanel: () => <div data-testid="stats-panel" /> }));
vi.mock('../../src/views/NewAlgView', () => ({ NewAlgView: () => <div data-testid="new-alg-view" /> }));
vi.mock('../../src/lib/case-cards', async () => ({
  ...(await vi.importActual<typeof import('../../src/lib/case-cards')>('../../src/lib/case-cards')),
  averageOfFiveTimeNumber: vi.fn(() => 1234),
}));
vi.mock('../../src/lib/storage', async () => ({
  ...(await vi.importActual<typeof import('../../src/lib/storage')>('../../src/lib/storage')),
  getBestTime: vi.fn(() => 987),
}));
vi.mock('../../src/lib/scramble', async () => ({
  ...(await vi.importActual<typeof import('../../src/lib/scramble')>('../../src/lib/scramble')),
  patternToPlayerAlg: vi.fn(() => "U R U'"),
}));

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    visible: true,
    options: {
      darkMode: false,
      showAlgName: true,
      countdownMode: false,
      alwaysScrambleTo: false,
      autoUpdateLearningState: false,
      visualization: 'PG3D',
      backview: 'none',
      hintFacelets: 'none',
      fullStickering: false,
      whiteOnBottom: false,
      gyroscope: false,
      controlPanel: 'none',
      flashingIndicatorEnabled: true,
      cubeSizePx: 420,
      setDarkMode: vi.fn(),
      setShowAlgName: vi.fn(),
      setCountdownMode: vi.fn(),
      setAlwaysScrambleTo: vi.fn(),
      setAutoUpdateLearningState: vi.fn(),
      setVisualization: vi.fn(),
      setBackview: vi.fn(),
      setHintFacelets: vi.fn(),
      setFullStickering: vi.fn(),
      setWhiteOnBottom: vi.fn(),
      setGyroscope: vi.fn(),
      setControlPanel: vi.fn(),
      setFlashingIndicatorEnabled: vi.fn(),
      setCubeSizePx: vi.fn(),
    },
    practiceToggles: {
      randomizeAUF: false,
      randomOrder: false,
      timeAttack: false,
      prioritizeSlowCases: false,
      prioritizeFailedCases: false,
      smartReviewScheduling: false,
      setRandomizeAUF: vi.fn(),
      setRandomOrder: vi.fn(),
      setTimeAttack: vi.fn(),
      setPrioritizeSlowCases: vi.fn(),
      setPrioritizeFailedCases: vi.fn(),
      setSmartReviewScheduling: vi.fn(),
    },
    caseLibrary: {
      isReady: true,
      savedAlgorithms: {},
      categories: ['PLL'],
      selectedCategory: 'PLL',
      subsets: ['A'],
      selectedSubsets: ['A'],
      caseCards: [],
      selectedCaseIds: [],
      selectionChangeMode: 'manual',
      selectAllCases: false,
      selectLearningCases: false,
      selectLearnedCases: false,
      setSelectedCategory: vi.fn(),
      toggleSubset: vi.fn(),
      toggleAllSubsets: vi.fn(),
      toggleCaseSelection: vi.fn(),
      setSelectAllCases: vi.fn(),
      setSelectLearningCases: vi.fn(),
      setSelectLearnedCases: vi.fn(),
      cycleCaseLearnedState: vi.fn(),
      reloadSavedAlgorithms: vi.fn(),
    },
    training: {
      inputMode: false,
      scrambleMode: false,
      timerState: 'IDLE',
      timerText: '0.000',
      countdownActive: false,
      countdownValue: null,
      visualResetKey: 1,
      algInput: '',
      displayAlg: "R U R'",
      currentCase: {
        id: 'case-1',
        name: 'Aa',
        algorithm: "R U R'",
        subset: 'A',
        category: 'PLL',
        bestTime: null,
        ao5: null,
        learned: 0,
        manualLearned: 0,
        reviewCount: 0,
        smartReviewDueAt: null,
        smartReviewDue: true,
        smartReviewUrgency: 0,
      },
      currentAlgName: 'Aa',
      selectedCases: [],
      stats: {
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
      },
      statsAlgId: 'case-1',
      displayMoves: [],
      fixText: '',
      fixVisible: false,
      helpTone: 'hidden',
      failedCounts: {},
      practiceCounts: {},
      flashRequest: null,
      timeAttackMode: false,
      timeAttackActive: false,
      timeAttackCurrentCaseNumber: 0,
      timeAttackTotalCases: 0,
      setAlgInput: vi.fn(),
      clearFailedCounts: vi.fn(),
      enterInputMode: vi.fn(),
      trainCurrent: vi.fn(async () => undefined),
      setTimerState: vi.fn(),
      activateTimer: vi.fn(),
      handleSpaceKeyDown: vi.fn(),
      handleSpaceKeyUp: vi.fn(),
      handleSmartcubeMove: vi.fn(() => false),
      stopAndRecordSolve: vi.fn(),
      abortRunningAttempt: vi.fn(),
      resetDrill: vi.fn(),
      prepareForScramble: vi.fn(),
      clearFix: vi.fn(),
      clearDisplayMoves: vi.fn(),
      setDisplayAlg: vi.fn(),
      setCurrentCase: vi.fn(),
      setCurrentAlgName: vi.fn(),
      setScrambleMode: vi.fn(),
      setHelpTone: vi.fn(),
    },
    scramble: {
      scrambleMode: false,
      scrambleText: '',
      isComputing: false,
      targetAlgorithm: '',
      helpTone: 'hidden',
      startScrambleTo: vi.fn(async () => true),
      advanceScramble: vi.fn(async () => false),
      clearScramble: vi.fn(),
    },
    smartcube: {
      connected: true,
      connecting: false,
      disconnectToken: 4,
      connectLabel: 'Disconnect',
      battery: { level: 80, color: 'green' },
      info: {
        deviceName: 'Cube',
        deviceMAC: 'AA:BB',
        deviceProtocol: 'GAN',
        hardwareName: 'GAN 12',
        hardwareVersion: '1',
        softwareVersion: '2',
        productDate: '2026-01-01',
        gyroSupported: 'YES',
        batteryLevel: '80%',
        skew: '0ms',
        quaternion: '0,0,0,1',
        velocity: '0',
      },
      currentFacelets: null,
      currentPattern: {} as never,
      lastProcessedMove: null,
      showAllBluetoothDevices: false,
      setShowAllBluetoothDevices: vi.fn(),
      connectOrDisconnect: vi.fn(async () => undefined),
      resetState: vi.fn(async () => undefined),
      resetGyro: vi.fn(),
      resetOrientation: vi.fn(),
      gyroSupported: false,
      gyroSupportResolved: true,
      gyroscopeToggleDisabled: false,
      cubeQuaternion: null,
      cubeQuaternionRef: { current: null },
    },
    algorithmActions: {
      categoryInput: '',
      subsetInput: '',
      algNameInput: '',
      saveError: '',
      saveSuccess: '',
      clearForm: vi.fn(),
      setCategoryInput: vi.fn(),
      setSubsetInput: vi.fn(),
      setAlgNameInput: vi.fn(),
      clearMessages: vi.fn(),
      submitSave: vi.fn(async () => true),
      exportAll: vi.fn(async () => undefined),
      importFromFile: vi.fn(async () => true),
      exportBackup: vi.fn(async () => undefined),
      importBackupFromFile: vi.fn(async () => true),
    },
    showAlgEditor: false,
    onAlgEditorSave: vi.fn(),
    onAlgEditorCancel: vi.fn(),
    mainCubeAlg: "R U R'",
    selectedStickering: 'PLL',
    setAcknowledgedDisconnectToken: vi.fn(),
    setMainCubeStickeringDeferred: vi.fn(),
    lastProcessedScrambleMoveRef: { current: 'old-move' },
    setScrambleStartAlg: vi.fn(),
    orientationResetToken: 0,
    orientationResetAlg: null as string | null,
    setDeleteMode: vi.fn(),
    deleteMode: false,
    deleteSuccessMessage: '',
    handleDeleteAlgorithms: vi.fn(),
    handleDeleteTimes: vi.fn(),
    showTimesInsteadOfGraph: false,
    setShowTimesInsteadOfGraph: vi.fn(),
    isMoveMasked: false,
    setIsMoveMasked: vi.fn(),
    handleEditCurrentAlgorithm: vi.fn(),
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: vi.fn(),
    handleTouchTimerActivation: vi.fn(),
    isFlashingIndicatorVisible: false,
    flashingIndicatorColor: 'gray',
    isMobile: false,
    ...overrides,
  } as any;
}

describe('PracticeView', () => {
  it('applies responsive cube guardrails and shows orientation reset in non-gyro mode', () => {
    render(<PracticeView {...makeProps()} />);

    const cubeFrame = screen.getByTestId('main-cube-area').parentElement?.parentElement;

    expect(screen.getByTestId('main-cube-area')).toBeInTheDocument();
    expect(cubeFrame).toHaveStyle({
      width: '420px',
      maxWidth: '100%',
    });
    expect(screen.getByText('White top · Green front')).toBeInTheDocument();
  });

  it('shows recent-times graph canvas and mode toggle when solve history exists', () => {
    const base = makeProps();
    render(
      <PracticeView
        {...makeProps({
          training: {
            ...base.training,
            stats: {
              ...base.training.stats,
              hasHistory: true,
              lastFive: [{ value: 1000, label: 'Time 1: 1.00s', isPb: false }],
            },
          },
        })}
      />,
    );

    expect(document.getElementById('timeGraph')).toBeTruthy();
    expect(screen.getByTitle('Show times list')).toBeInTheDocument();
  });

  it('keeps desktop practice rows constrained and the top side cards in layout columns', () => {
    render(<PracticeView {...makeProps()} />);

    const topGrid = document.querySelector('.practice-top-grid');

    expect(topGrid).toBeTruthy();
    expect(document.querySelector('.practice-side-column--left')).toBeTruthy();
    expect(document.querySelector('.practice-side-column--right')).toBeTruthy();
    expect(document.querySelector('.practice-timer-value')).toBeTruthy();
    expect(document.getElementById('alg-bar')).toHaveStyle({
      maxWidth: 'var(--practice-alg-track-max)',
    });
  });

  it('shows a countdown overlay and hides the cube content while countdown mode is active', () => {
    const base = makeProps();
    const props = makeProps({
      training: {
        ...base.training,
        countdownActive: true,
        countdownValue: 3,
      },
    });

    render(<PracticeView {...props} />);

    expect(screen.getByLabelText('Countdown 3')).toHaveTextContent('3');
    expect(screen.getByTestId('main-cube-area').parentElement).toHaveClass('cube-area-content--hidden');
    expect(screen.queryByText('Aa')).not.toBeInTheDocument();
  });

  it('clears scramble mode on Train when alwaysScrambleTo is disabled', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      scramble: { ...makeProps().scramble, scrambleMode: true, scrambleText: 'R U' },
    });

    render(<PracticeView {...props} />);
    await user.click(screen.getByTitle('Train'));

    expect(props.setAcknowledgedDisconnectToken).toHaveBeenCalledWith(4);
    expect(props.scramble.clearScramble).toHaveBeenCalled();
    expect(props.lastProcessedScrambleMoveRef.current).toBe('');
    expect(props.training.trainCurrent).toHaveBeenCalledWith(props.smartcube.currentPattern);
  });

  it('preserves scramble mode on Train when alwaysScrambleTo is enabled', async () => {
    const user = userEvent.setup();
    const base = makeProps();
    const props = makeProps({
      options: { ...base.options, alwaysScrambleTo: true },
      scramble: { ...base.scramble, scrambleMode: true, scrambleText: 'R U' },
    });

    render(<PracticeView {...props} />);
    await user.click(screen.getByTitle('Train'));

    expect(props.scramble.clearScramble).not.toHaveBeenCalled();
    expect(props.training.trainCurrent).toHaveBeenCalled();
  });

  it('stops time attack without retraining the interrupted case', async () => {
    const user = userEvent.setup();
    const base = makeProps();
    const props = makeProps({
      training: {
        ...base.training,
        timerState: 'RUNNING',
        timeAttackMode: true,
      },
    });

    render(<PracticeView {...props} />);
    await user.click(screen.getByTitle('Train'));

    expect(props.training.abortRunningAttempt).toHaveBeenCalled();
    expect(props.training.trainCurrent).not.toHaveBeenCalled();
  });

  it('starts scramble flow and prepares training after Scramble To succeeds', async () => {
    const user = userEvent.setup();
    const base = makeProps();
    const props = makeProps({
      training: { ...base.training, displayAlg: "R U2 R'" },
      practiceToggles: { ...base.practiceToggles, randomizeAUF: true },
      scramble: { ...base.scramble, startScrambleTo: vi.fn(async () => true) },
    });

    render(<PracticeView {...props} />);
    await user.click(screen.getByTitle('Scramble To...'));

    await waitFor(() => {
      expect(props.scramble.startScrambleTo).toHaveBeenCalledWith(
        "R U2 R'",
        props.training.currentCase,
        props.smartcube.currentPattern,
        false,
      );
    });
    await waitFor(() => {
      expect(props.training.prepareForScramble).toHaveBeenCalled();
    });

    expect(props.setAcknowledgedDisconnectToken).toHaveBeenCalledWith(4);
    expect(props.setScrambleStartAlg).toHaveBeenCalledWith("U R U'");
    expect(props.lastProcessedScrambleMoveRef.current).toBe('');
  });

  it('shows the time attack banner and progress when the mode is active', () => {
    const base = makeProps();
    const props = makeProps({
      practiceToggles: { ...base.practiceToggles, timeAttack: true },
      training: {
        ...base.training,
        timeAttackMode: true,
        timeAttackActive: true,
        timeAttackCurrentCaseNumber: 3,
        timeAttackTotalCases: 12,
      },
    });

    render(<PracticeView {...props} />);

    expect(screen.getByText('Time Attack — Case 3 of 12')).toBeInTheDocument();
  });

  it('disables conflicting order toggles when smart order or time attack is active', async () => {
    const user = userEvent.setup();
    const base = makeProps();
    const props = makeProps({
      practiceToggles: {
        ...base.practiceToggles,
        smartReviewScheduling: true,
        timeAttack: false,
      },
    });

    const { rerender } = render(<PracticeView {...props} />);

    expect(screen.getByLabelText('Random Order')).toBeDisabled();
    expect(screen.getByLabelText('Slow Cases First')).toBeDisabled();

    await user.click(screen.getByLabelText('Smart Order'));
    expect(props.practiceToggles.setSmartReviewScheduling).toHaveBeenCalledWith(false);

    rerender(<PracticeView {...makeProps({
      practiceToggles: {
        ...base.practiceToggles,
        smartReviewScheduling: false,
        timeAttack: true,
      },
    })} />);

    expect(screen.getByLabelText('Smart Order')).toBeDisabled();
  });

  it('keeps the practice toggle order with Time Attack last', () => {
    render(<PracticeView {...makeProps()} />);

    const smartOrder = screen.getByLabelText('Smart Order');
    const randomAuf = screen.getByLabelText('Random AUF');
    const prioritizeFailed = screen.getByLabelText('Prioritize Failed');
    const timeAttack = screen.getByLabelText('Time Attack');

    expect(smartOrder.compareDocumentPosition(randomAuf)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(prioritizeFailed.compareDocumentPosition(timeAttack)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
