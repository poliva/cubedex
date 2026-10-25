import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import { KPattern } from 'cubing/kpuzzle';
import { Quaternion } from 'three';
import type { ComponentProps } from 'react';
import { patternToFacelets, solvedPattern } from '../../src/lib/cube-utils';
import { alignForGuidance, fixOrientation, patternToPlayerAlg } from '../../src/lib/scramble';
import { useScrambleState } from '../../src/hooks/useScrambleState';
import { useTrainingState, type TrainingState } from '../../src/hooks/useTrainingState';
import { PracticeView } from '../../src/views/PracticeView';
import { getTrainingVisualDelta } from '../../src/lib/training-visual';
import { guidanceFrameRotation, HOME_ORIENTATION } from '../../src/lib/cube-orientation';
import { getStickeringForCategory } from '../../src/lib/stickering';

vi.mock('../../src/components/TwistyCube', () => ({
  TwistyCube: (props: ComponentProps<typeof import('../../src/components/TwistyCube').TwistyCube>) =>
    <div data-testid="recovery-cube" data-setup={props.setupAlg} data-turn={props.alg} />,
}));
vi.mock('../../src/views/CaseGrid', () => ({ CaseGrid: () => <div data-testid="case-grid" /> }));
vi.mock('../../src/views/MainCubeArea', () => ({
  MainCubeArea: ({ puzzle, experimentalStickering, alg, appendMoveKey, appendMove, targetPattern, gyroscopeEnabled, gyroFrameQuaternion, trainingViewRef }: ComponentProps<typeof import('../../src/views/MainCubeArea').MainCubeArea>) => (
    <div data-testid="main-cube-area" data-puzzle={puzzle} data-stickering={experimentalStickering}
      data-alg={alg} data-append-key={appendMoveKey} data-append-move={appendMove} data-target={targetPattern ? JSON.stringify(targetPattern.patternData) : undefined}
      data-stable-view={String(Boolean(trainingViewRef))} data-gyro={String(gyroscopeEnabled)} data-gyro-frame={gyroFrameQuaternion ? JSON.stringify({
        x: gyroFrameQuaternion.x, y: gyroFrameQuaternion.y, z: gyroFrameQuaternion.z, w: gyroFrameQuaternion.w,
      }) : undefined} />
  ),
}));
vi.mock('../../src/views/MoveListPanel', () => ({ MoveListPanel: () => <div data-testid="move-list-panel" /> }));
vi.mock('../../src/views/StatsPanel', () => ({
  StatsPanel: ({ visible = true }: { visible?: boolean }) => (
    <div data-testid="stats-panel" data-stats-panel-visible={String(visible)} />
  ),
}));
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
  const defaultPracticeCase = {
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
  };

  return {
    visible: true,
    options: {
      darkMode: false,
      showAlgName: true,
      countdownMode: false,
      alwaysScrambleTo: false,
      autoUpdateLearningState: false,
      expertScrambler: false,
      matchVirtualCubeOnRecovery: true,
      allowAlternativeAlgorithms: false,
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
      setExpertScrambler: vi.fn(),
      setMatchVirtualCubeOnRecovery: vi.fn(),
      setAllowAlternativeAlgorithms: vi.fn(),
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
      currentCase: defaultPracticeCase,
      canGoToPreviousCase: false,
      navigateCase: vi.fn(async () => undefined),
      currentAlgName: 'Aa',
      selectedCases: [defaultPracticeCase],
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
      beginRecovery: vi.fn(),
      stopAndRecordSolve: vi.fn(),
      abortRunningAttempt: vi.fn(),
      resetDrill: vi.fn(),
      prepareForScramble: vi.fn(),
      setKeepInitialState: vi.fn(),
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
      setupTarget: null,
      helpTone: 'hidden',
      startScrambleTo: vi.fn(async () => true),
      advanceScramble: vi.fn(async () => false),
      clearScramble: vi.fn(),
    },
    smartcube: {
      cubeSize: 3,
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
      handleGyroTrainingEvent: vi.fn(),
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
    onOpenCaseLibrary: vi.fn(),
    ...overrides,
  } as any;
}

describe('PracticeView', () => {
  it('gates training stabilization behind drift correction while keeping live gyro tracking', () => {
    const props = makeProps();
    props.options = { ...props.options, gyroscope: true, autoCorrectGyroDrift: true };
    props.smartcube = { ...props.smartcube, connected: true,
      trainingViewRef: { current: { phase: 'ready', anchor: null } } };
    const { rerender } = render(<PracticeView {...props} />);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stable-view', 'true');
    props.options = { ...props.options, autoCorrectGyroDrift: false };
    rerender(<PracticeView {...props} />);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stable-view', 'false');
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-gyro', 'true');
    props.options = { ...props.options, autoCorrectGyroDrift: true };
    rerender(<PracticeView {...props} />);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stable-view', 'true');
  });

  it.each([false, true])('navigates a multi-case selection without adding a control row (mobile %s)', async isMobile => {
    const props = makeProps({ isMobile });
    props.training.selectedCases = [props.training.currentCase, { ...props.training.currentCase, id: 'case-2' }];
    const user = userEvent.setup();
    const { rerender } = render(<PracticeView {...props} />);
    const previous = screen.getByRole('button', { name: 'Previous case' });
    const next = screen.getByRole('button', { name: 'Next case' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Case navigation' }).parentElement)
      .toBe(screen.getByTestId('main-cube-area').parentElement?.parentElement);
    await user.click(next);
    expect(props.training.navigateCase).toHaveBeenCalledWith(1);
    props.training = { ...props.training, canGoToPreviousCase: true };
    rerender(<PracticeView {...props} />);
    await user.click(previous);
    expect(props.training.navigateCase).toHaveBeenCalledWith(-1);
    next.focus();
    await user.keyboard(' ');
    expect(props.training.navigateCase).toHaveBeenLastCalledWith(1);
  });

  it('hides navigation for a single case and disables it during a timed run', () => {
    const props = makeProps();
    const { rerender } = render(<PracticeView {...props} />);
    expect(screen.queryByRole('group', { name: 'Case navigation' })).toBeNull();
    props.training = { ...props.training, canGoToPreviousCase: true, timeAttackActive: true,
      selectedCases: [props.training.currentCase, { ...props.training.currentCase, id: 'case-2' }] };
    rerender(<PracticeView {...props} />);
    expect(screen.getByRole('button', { name: 'Next case' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous case' })).toBeDisabled();
  });

  it('can skip a case while its guided scramble is open', async () => {
    const props = makeProps();
    const solved = await solvedPattern(3);
    props.smartcube.currentPattern = solved.applyMove('R');
    props.smartcube.refreshPattern = vi.fn(async () => props.smartcube.currentPattern);
    props.scramble = { ...props.scramble, scrambleMode: true, setupTarget: solved.applyMove('F'), targetAlgorithm: "F'" };
    props.training.selectedCases = [props.training.currentCase, { ...props.training.currentCase, id: 'case-2' }];
    render(<PracticeView {...props} />);
    const next = await screen.findByRole('button', { name: 'Next case' });
    expect(next.closest('.recovery-picture')).not.toBeNull();
    await userEvent.click(next);
    expect(props.scramble.clearScramble).toHaveBeenCalled();
    expect(props.training.navigateCase).toHaveBeenCalledWith(1);
  });

  it('applies responsive cube guardrails and shows idle practice chrome', () => {
    render(<PracticeView {...makeProps()} />);

    const cubeFrame = screen.getByTestId('main-cube-area').parentElement?.parentElement;

    expect(screen.getByTestId('main-cube-area')).toBeInTheDocument();
    expect(cubeFrame).toHaveStyle({
      width: 'min(100%, 420px)',
      aspectRatio: '1',
      maxWidth: '100%',
    });
    expect(screen.getByText('Train to begin')).toBeInTheDocument();
  });

  it('uses the selected puzzle for keyboard practice as well as smartcube practice', () => {
    const props = makeProps();
    const { rerender } = render(<PracticeView {...props} />);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-puzzle', '3x3x3');
    rerender(<PracticeView {...makeProps({ puzzle: '2x2x2', selectedStickering: 'full' })} />);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-puzzle', '2x2x2');
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', 'full');
  });

  it.each([false, true])('applies 2×2 Ortega OLL masking and full-sticker changes (connected %s)', connected => {
    const props = makeProps({
      puzzle: '2x2x2',
      selectedStickering: getStickeringForCategory('2x2x2:OLL', false, '2x2x2'),
    });
    props.smartcube = { ...props.smartcube, connected, cubeSize: 2, currentPattern: null };
    const { rerender } = render(<PracticeView {...props} />);

    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', 'OLL');

    props.options = { ...props.options, fullStickering: true };
    props.selectedStickering = getStickeringForCategory('2x2x2:OLL', true, '2x2x2');
    rerender(<PracticeView {...props} />);

    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', 'full');
  });

  it('hides the Last/Best/Ao5 stat chips when there is no solve history', () => {
    render(<PracticeView {...makeProps()} />);

    expect(screen.queryByText('Last')).toBeNull();
    expect(screen.queryByText('Best')).toBeNull();
    expect(screen.queryByText('Ao5')).toBeNull();
  });

  it('hides desktop and mobile timer cards when no cases are selected', () => {
    const base = makeProps();
    const emptyTraining = {
      ...base.training,
      currentCase: null,
      currentAlgName: '',
      selectedCases: [] as typeof base.training.selectedCases,
    };

    const { rerender } = render(
      <PracticeView
        {...makeProps({
          training: emptyTraining,
          isMobile: false,
        })}
      />,
    );

    expect(document.querySelector('.practice-timer-card')).toBeNull();
    expect(document.querySelector('.mobile-timer-card')).toBeNull();

    rerender(
      <PracticeView
        {...makeProps({
          training: emptyTraining,
          isMobile: true,
        })}
      />,
    );

    expect(document.querySelector('.practice-timer-card')).toBeNull();
    expect(document.querySelector('.mobile-timer-card')).toBeNull();
  });

  it('hides practice options and alg stats while the inline algorithm editor is open', () => {
    const { rerender } = render(
      <PracticeView
        {...makeProps({
          showAlgEditor: true,
        })}
      />,
    );

    expect(screen.getByTestId('stats-panel')).toHaveAttribute('data-stats-panel-visible', 'false');
    expect(screen.queryByText('Practice options')).toBeNull();

    rerender(
      <PracticeView
        {...makeProps({
          showAlgEditor: true,
          isMobile: true,
        })}
      />,
    );
    expect(screen.queryByLabelText(/smart order/i)).toBeNull();
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

  it('uses the collapsible practice toggles strip on narrow desktop widths', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(max-width: 1080px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<PracticeView {...makeProps()} />);

    expect(screen.getByText('Practice options')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /smart order/i })).toBeNull();
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

  it('shows orientation reminder in green with remaining scramble when scramble-to grows', () => {
    const base = makeProps();
    const props = makeProps({
      scramble: {
        ...base.scramble,
        scrambleMode: true,
        scrambleText: 'U',
        helpTone: 'green',
      },
    });

    render(<PracticeView {...props} />);

    const bar = screen.getByTestId('practice-status-bar');
    expect(bar).toHaveTextContent(/WHITE on top/);
    expect(bar).toHaveTextContent('U');
    const body = screen.getByTestId('practice-status-bar-body');
    expect(body.textContent?.indexOf('U')).toBeLessThan(body.textContent?.indexOf('WHITE') ?? -1);
  });

  it.each([true, false])('uses the virtual cube recovery preference (%s) for 3×3 mistakes', async matchVirtualCubeOnRecovery => {
    const base = makeProps();
    const props = makeProps({
      options: { ...base.options, matchVirtualCubeOnRecovery },
      training: {
        ...base.training,
        helpTone: 'red',
        fixVisible: true,
        fixText: "U R' D'",
      },
    });

    render(<PracticeView {...props} />);

    expect(screen.getByRole('button', { name: 'Help me recover' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Help me recover' }));
    expect(props.training.beginRecovery).toHaveBeenCalledWith(matchVirtualCubeOnRecovery);
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
        null,
      );
    });
    await waitFor(() => {
      expect(props.training.prepareForScramble).toHaveBeenCalled();
    });

    expect(props.setAcknowledgedDisconnectToken).toHaveBeenCalledWith(4);
    expect(props.setScrambleStartAlg).toHaveBeenCalledWith("U R U'");
    expect(props.lastProcessedScrambleMoveRef.current).toBe('');
  });

  it.each(['4x4x4', '5x5x5', 'pyraminx', 'megaminx'])(
    'offers an inverse setup and lets Train dismiss it for %s', async (puzzle) => {
      const user = userEvent.setup();
      const base = makeProps();
      const props = makeProps({
        puzzle,
        options: { ...base.options, alwaysScrambleTo: true },
        scramble: { ...base.scramble, startScrambleTo: vi.fn(async () => true) },
      });
      const { rerender } = render(<PracticeView {...props} />);
      await user.click(screen.getByTitle('Scramble To...'));
      await waitFor(() => expect(props.training.prepareForScramble).toHaveBeenCalled());
      expect(props.scramble.startScrambleTo).toHaveBeenCalledWith(
        props.training.displayAlg || props.training.algInput,
        props.training.currentCase,
        null,
        false,
        null,
      );
      expect(props.setScrambleStartAlg).toHaveBeenCalledWith('');

      rerender(<PracticeView {...props} scramble={{ ...props.scramble, scrambleMode: true, scrambleText: "U R'" }} />);
      expect(screen.getByText('Apply from solved, then press Train.')).toBeInTheDocument();
      await user.click(screen.getByTitle('Train'));
      expect(props.scramble.clearScramble).toHaveBeenCalled();
      expect(props.training.trainCurrent).toHaveBeenCalled();
    },
  );

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

  it('wires timer activation to mobile timer card and stat chip row on mobile, not cube', () => {
    const base = makeProps();
    const props = makeProps({
      isMobile: true,
      training: {
        ...base.training,
        stats: {
          ...base.training.stats,
          hasHistory: true,
          lastFive: [{ value: 1000, label: 'Time 1: 1.00s', isPb: false }],
        },
      },
    });

    render(<PracticeView {...props} />);

    // Mobile timer card triggers handleTouchEnd via native touchend
    const mobileTimerCard = document.querySelector('.mobile-timer-card');
    expect(mobileTimerCard).toBeInTheDocument();
    mobileTimerCard!.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(props.handleTouchEnd).toHaveBeenCalled();

    // Stat chip row triggers handleTouchEnd via native touchend
    props.handleTouchEnd.mockClear();
    const statChipRow = document.querySelector('.mobile-stat-chip-row');
    expect(statChipRow).toBeInTheDocument();
    statChipRow!.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(props.handleTouchEnd).toHaveBeenCalled();

    // Cube should NOT trigger handleTouchEnd
    props.handleTouchEnd.mockClear();
    const cubeFrame = screen.getByTestId('main-cube-area').parentElement!;
    cubeFrame.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(props.handleTouchEnd).not.toHaveBeenCalled();
  });

  it('wires timer activation to desktop right column, not cube', () => {
    const props = makeProps({ isMobile: false });

    render(<PracticeView {...props} />);

    // Desktop right column triggers handleTouchEnd via native touchend
    const rightColumn = document.querySelector('.practice-side-column--right');
    expect(rightColumn).toBeInTheDocument();
    rightColumn!.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(props.handleTouchEnd).toHaveBeenCalled();

    // Cube should NOT trigger handleTouchEnd
    props.handleTouchEnd.mockClear();
    const cubeFrame = screen.getByTestId('main-cube-area').parentElement!;
    cubeFrame.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(props.handleTouchEnd).not.toHaveBeenCalled();
  });

  it.skip('disables conflicting order toggles when smart order or time attack is active', async () => {
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

    // Expand the toggle strip first
    await user.click(screen.getByText('Practice options'));

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

  it.skip('keeps the practice toggle order with Time Attack last', async () => {
    // Click to expand the toggles strip
    // void screen.getByText('Practice options');

    const smartOrder = screen.getByLabelText('Smart Order');
    const randomAuf = screen.getByLabelText('Random AUF');
    const prioritizeFailed = screen.getByLabelText('Prioritize Failed');
    const timeAttack = screen.getByLabelText('Time Attack');

    expect(smartOrder.compareDocumentPosition(randomAuf)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(prioritizeFailed.compareDocumentPosition(timeAttack)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

it('keeps the actual 3×3 stickers after recovering an attempt that started without wand setup', async () => {
  const solved = await solvedPattern(3);
  const physical = solved.applyAlg('D R U y');
  const props = makeProps({ puzzle: '3x3x3' });
  props.smartcube.currentPattern = physical.applyAlg('x');
  props.training.caseStartPattern = solved.applyAlg('D R y');
  props.training.caseCurrentPattern = physical;
  props.training.casePicturePattern = null;
  props.training.recoveredAt = 1;
  render(<PracticeView {...props} />);
  expect(JSON.parse(screen.getByTestId('main-cube-area').dataset.target!)).toEqual(physical.patternData);
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', 'PLL');
});

it.each([
  { gyro: true, supported: true },
  { gyro: false, supported: true },
  { gyro: true, supported: false },
])('keeps OLL-4 wide turns in the gyro frame after wand setup (gyro $gyro, supported $supported)', async ({ gyro, supported }) => {
  const { default: defaults } = await import('../../src/data/defaultAlgs.json');
  const oll4 = defaults.OLL.flatMap(subset => subset.algorithms).find(card => card.name.startsWith('OLL-4 '))!;
  const algorithm = new Alg(oll4.algorithm).expand().toString();
  const moves = algorithm.split(/\s+/);
  expect(moves[0]).toBe('f');
  const solved = await solvedPattern(3);
  const current = solved.applyAlg('F R U y');
  const props = makeProps({ puzzle: '3x3x3', selectedStickering: 'OLL' });
  props.options.expertScrambler = true;
  props.options.gyroscope = gyro;
  props.smartcube.gyroSupported = supported;
  props.smartcube.currentPattern = current;
  props.smartcube.refreshPattern = vi.fn(async () => props.smartcube.currentPattern);
  let trainingState!: TrainingState;
  function SetupPractice() {
    const scramble = useScrambleState('3x3x3');
    const training = useTrainingState([], 'OLL', {
      puzzle: '3x3x3', selectionChangeMode: 'manual', countdownMode: false,
      randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
      currentPattern: props.smartcube.currentPattern,
    });
    trainingState = training;
    return <PracticeView {...props} training={training} scramble={scramble} />;
  }
  const { rerender } = render(<SetupPractice />);
  await act(async () => { await trainingState.trainCurrent(current, { algorithm }); });
  await userEvent.click(screen.getByTitle('Scramble To...'));
  const list = await screen.findByRole('list', { name: 'Setup algorithm' });
  const setup = solved.applyAlg(screen.getByTestId('recovery-cube').dataset.setup!);
  const start = setup.applyAlg(Array.from(list.children).map(item => item.textContent!).join(' '));
  props.smartcube = { ...props.smartcube, currentPattern: start };
  rerender(<SetupPractice />);
  await waitFor(() => expect(screen.queryByRole('region', { name: '3×3 guided setup' })).toBeNull());
  let physical = start;
  for (const move of moves.slice(0, -1)) {
    physical = physical.applyMove(move);
    await act(async () => { trainingState.handleSmartcubeMove(fixOrientation(physical), move); });
    // The logical algorithm frame still includes the rotation from wide turns.
    expect(trainingState.caseCurrentPattern?.isIdentical(physical)).toBe(true);
    const displayed = gyro && supported ? alignForGuidance(physical, start) : physical;
    expect(JSON.parse(screen.getByTestId('main-cube-area').dataset.target!)).toEqual(displayed.patternData);
    expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', 'OLL');
  }
});

it.each([false, true].flatMap(prepared => [false, true].map(matchVirtualCube => ({ prepared, matchVirtualCube }))))
  ('keeps the confirmed V perm grip after recovery past f\' (prepared $prepared, match virtual $matchVirtualCube)', async ({ prepared, matchVirtualCube }) => {
    const { default: defaults } = await import('../../src/data/defaultAlgs.json');
    const algorithm = defaults.PLL.flatMap(subset => subset.algorithms).find(card => card.name === 'V Perm')!.algorithm;
    const moves = new Alg(algorithm).expand().toString().split(/\s+/);
    const solved = await solvedPattern(3);
    const start = prepared ? solved.applyAlg(new Alg(algorithm).invert()) : solved.applyAlg('D R B y');
    let physical = start;
    const props = makeProps({ puzzle: '3x3x3', selectedStickering: 'PLL' });
    props.options.expertScrambler = true;
    props.options.matchVirtualCubeOnRecovery = matchVirtualCube;
    props.options.gyroscope = true;
    props.smartcube.gyroSupported = true;
    props.smartcube.currentPattern = fixOrientation(physical);
    props.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
    props.smartcube.refreshPattern = vi.fn(async () => props.smartcube.currentPattern);
    let training!: TrainingState;
    function VPermPractice() {
      training = useTrainingState([], 'PLL', {
        puzzle: '3x3x3', selectionChangeMode: 'manual', countdownMode: false,
        randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
        prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
      });
      const scramble = useScrambleState('3x3x3');
      return <PracticeView {...props} training={training} scramble={scramble} />;
    }
    const { rerender } = render(<VPermPractice />);
    await act(async () => { await training.trainCurrent(start, { algorithm, preserveDisplayedAlgorithm: true }); });
    let packet = 0;
    async function report(move: string) {
      const sensor = fixOrientation(physical);
      props.smartcube = { ...props.smartcube, currentPattern: sensor,
        lastProcessedMove: { key: `v-perm-${++packet}`, move } };
      props.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
        .multiply(guidanceFrameRotation(sensor, physical)!);
      await act(async () => {
        training.handleSmartcubeMove(sensor, move);
        rerender(<VPermPractice />);
      });
    }
    const shown = () => new KPattern(solved.kpuzzle,
      JSON.parse(screen.getByTestId('main-cube-area').dataset.target!));
    let confirmedGrip = start;
    for (const [index, move] of moves.entries()) {
      physical = physical.applyMove(move);
      await report(move);
      if (index === moves.indexOf("f'") || index === moves.indexOf('U2')) {
        const anchor = physical;
        physical = physical.applyMove('F');
        await report('F');
        await userEvent.click(await screen.findByRole('button', { name: 'Help me recover' }));
        const sequence = await screen.findByRole('list', { name: 'Recovery algorithm' });
        const reference = solved.applyAlg(screen.getByTestId('recovery-cube').dataset.setup!);
        physical = reference.applyAlg(Array.from(sequence.children).map(item => item.textContent!).join(' '));
        expect(physical.isIdentical(training.recoveryTarget!)).toBe(true);
        if (prepared || !matchVirtualCube) expect(physical.isIdentical(anchor)).toBe(true);
        await report('F');
        await waitFor(() => expect(screen.queryByRole('region', { name: '3×3 visual recovery' })).toBeNull());
        expect(training.fixText).toBe('');
        confirmedGrip = physical;
        // Use only the pictured centers as a frame. The hand pose must not
        // become a new gyro zero when recovery closes.
        expect(shown().isIdentical(confirmedGrip)).toBe(true);
        const frame = JSON.parse(screen.getByTestId('main-cube-area').dataset.gyroFrame!);
        expect(new Quaternion(frame.x, frame.y, frame.z, frame.w)
          .angleTo(guidanceFrameRotation(confirmedGrip, fixOrientation(confirmedGrip))!)).toBeLessThan(1e-6);
      } else if (training.casePicturePattern || training.recoveredAt) {
        expect(shown().isIdentical(alignForGuidance(physical, confirmedGrip))).toBe(true);
      }
    }
    expect(training.timerState).toBe('STOPPED');
    await act(async () => { await training.trainCurrent(physical, { algorithm, preserveDisplayedAlgorithm: true }); });
    expect(training.caseGripPattern?.isIdentical(physical)).toBe(true);
  });

it.each(['OLL', 'PLL', 'full'])('completes the expert 3×3 wand and restores %s training stickers without extra clicks', async stickering => {
  const solved = await solvedPattern(3);
  const algorithm = "R U R' U'";
  const target = solved.applyAlg(new Alg(algorithm).invert());
  const current = solved.applyAlg('F R U y');
  const props = makeProps({ puzzle: '3x3x3', selectedStickering: stickering });
  props.options.fullStickering = stickering === 'full';
  props.options.expertScrambler = true;
  props.options.gyroscope = true;
  props.options.visualization = 'LL';
  props.smartcube.currentPattern = current;
  props.smartcube.refreshPattern = vi.fn(async () => props.smartcube.currentPattern);
  let trainingState!: TrainingState;
  function SetupPractice() {
    const scramble = useScrambleState('3x3x3');
    const training = useTrainingState([], 'Custom', {
      puzzle: '3x3x3', selectionChangeMode: 'manual', countdownMode: false,
      randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
      currentPattern: props.smartcube.currentPattern,
    });
    trainingState = training;
    return <PracticeView {...props} training={training} scramble={scramble} />;
  }
  const { rerender } = render(<SetupPractice />);
  await act(async () => { await trainingState.trainCurrent(current, { algorithm }); });
  await userEvent.click(screen.getByTitle('Scramble To...'));
  const list = await screen.findByRole('list', { name: 'Setup algorithm' });
  expect(screen.getByRole('region', { name: '3×3 guided setup' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
  const shownStart = solved.applyAlg(screen.getByTestId('recovery-cube').dataset.setup!);
  const sequence = Array.from(list.children).map(item => item.textContent!).join(' ');
  const physical = shownStart.applyAlg(sequence);
  expect(physical.isIdentical(target)).toBe(true);
  props.smartcube = { ...props.smartcube, currentPattern: physical.applyAlg('x y') };
  rerender(<SetupPractice />);
  await waitFor(() => expect(screen.queryByRole('region', { name: '3×3 guided setup' })).toBeNull());
  expect(trainingState.casePicturePattern?.isIdentical(physical)).toBe(true);
  expect(JSON.parse(screen.getByTestId('main-cube-area').dataset.target!)).toEqual(physical.patternData);
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', stickering);
  await act(async () => { trainingState.handleSmartcubeMove(physical.applyMove('R').applyAlg('z'), 'R'); });
  expect(JSON.parse(screen.getByTestId('main-cube-area').dataset.target!)).toEqual(physical.applyMove('R').patternData);
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-stickering', stickering);
});


describe('puzzle-specific mistake guidance', () => {
  it.each([false, true])('offers immediate 2×2 undo and visual help (mobile %s)', async isMobile => {
    const props = makeProps();
    props.puzzle = '2x2x2';
    props.isMobile = isMobile;
    props.training.recoveryTarget = await solvedPattern(2);
    props.training.recoveryMoveCount = 1;
    render(<PracticeView {...props} />);
    expect(screen.getByText('Turned the wrong way? Undo your last turn.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Help me recover' })).toBeVisible();
    expect(screen.queryByText(/WHITE on top/)).toBeNull();
  });

  it('explains multiple errors consistently for both cube sizes', async () => {
    const props = makeProps();
    props.puzzle = '2x2x2';
    props.training.recoveryTarget = await solvedPattern(2);
    props.training.recoveryMoveCount = 3;
    const { rerender } = render(<PracticeView {...props} />);
    expect(screen.getByText(/Undo your recent turns/)).toBeVisible();
    props.puzzle = '3x3x3';
    props.training.recoveryTarget = await solvedPattern(3);
    props.training.helpTone = 'red';
    rerender(<PracticeView {...props} training={{ ...props.training }} />);
    expect(screen.getByText(/Undo your recent turns/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Help me recover' })).toBeVisible();
  });
});


it.each(['disconnect', 'case', 'puzzle', 'editor', 'reset', 'cancel'])('cleans up visual recovery on %s', async reason => {
  const props = makeProps();
  const target = await solvedPattern(2);
  const current = target.applyAlg('R F');
  props.puzzle = '2x2x2';
  props.training.recoveryTarget = target;
  props.training.recoveryMoveCount = 2;
  props.training.checkRecovery = vi.fn(() => false);
  props.smartcube.currentPattern = current;
  props.smartcube.refreshPattern = vi.fn(async () => current);
  const user = userEvent.setup();
  const { rerender } = render(<PracticeView {...props} />);
  await user.click(screen.getByRole('button', { name: 'Help me recover' }));
  await screen.findByRole('button', { name: 'My cube matches' });
  if (reason === 'cancel') {
    await user.click(screen.getByRole('button', { name: 'Back to undo help' }));
    expect(screen.getByRole('button', { name: 'Help me recover' })).toBeVisible();
  } else {
    if (reason === 'disconnect') props.smartcube = { ...props.smartcube, connected: false };
    if (reason === 'case') props.training = { ...props.training, currentCase: { ...props.training.currentCase, id: 'new-case' } };
    if (reason === 'puzzle') props.puzzle = '3x3x3';
    if (reason === 'editor') props.showAlgEditor = true;
    if (reason === 'reset') props.training = { ...props.training, visualResetKey: 2, recoveryTarget: null };
    rerender(<PracticeView {...props} />);
  }
  expect(screen.queryByRole('region', { name: '2×2 visual recovery' })).toBeNull();
});


it.each([false, true])('keeps the selected 2×2 case preview when sensor stickers change (mobile %s)', async isMobile => {
  const solved = await solvedPattern(2);
  const algorithm = "R U R'";
  const setup = new Alg(algorithm).invert().toString();
  const props = makeProps({ puzzle: '2x2x2', isMobile, mainCubeAlg: setup });
  props.smartcube.currentPattern = solved.applyAlg('R2 F');
  const { rerender } = render(<PracticeView {...props} />);
  const shownPattern = () => solved.applyAlg(screen.getByTestId('main-cube-area').dataset.alg!);

  expect(shownPattern().isIdentical(solved.applyAlg(setup))).toBe(true);
  expect(shownPattern().isIdentical(props.smartcube.currentPattern)).toBe(false);

  props.smartcube = { ...props.smartcube, currentPattern: solved.applyAlg('F U2') };
  props.smartcubeAppendMoveKey = 'received-turn';
  props.smartcubeAppendMove = 'U';
  rerender(<PracticeView {...props} />);
  expect(shownPattern().isIdentical(solved.applyAlg(setup))).toBe(true);
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-append-key', 'received-turn');
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-append-move', 'U');

  const nextAlgorithm = "F R U R' F'";
  const nextSetup = new Alg(nextAlgorithm).invert().toString();
  props.mainCubeAlg = nextSetup;
  props.training = { ...props.training, displayAlg: nextAlgorithm, visualResetKey: 2,
    currentCase: { ...props.training.currentCase, id: 'next-case', algorithm: nextAlgorithm } };
  rerender(<PracticeView {...props} />);
  expect(shownPattern().isIdentical(solved.applyAlg(nextSetup))).toBe(true);
  expect(shownPattern().isIdentical(props.smartcube.currentPattern)).toBe(false);
});


it.each([false, true])('renders the selected case in the carried frame with gyro %s', async gyroscope => {
  const solved = await solvedPattern(2);
  const algorithm = "R U R'";
  const selectedCase = solved.applyAlg(new Alg(algorithm).invert());
  const start = solved.applyAlg('R2 F U');
  const props = makeProps({ puzzle: '2x2x2', mainCubeAlg: new Alg(algorithm).invert().toString() });
  props.training.caseStartPattern = start;
  props.training.displayAlg = algorithm;
  props.options.gyroscope = gyroscope;
  props.smartcube = { ...props.smartcube, currentPattern: start.applyAlg("y'") };
  const { rerender } = render(<PracticeView {...props} />);
  const shownData = () => JSON.parse(screen.getByTestId('main-cube-area').dataset.target!);
  expect(shownData()).toEqual(selectedCase.applyAlg("y'").patternData);
  expect(shownData()).not.toEqual(props.smartcube.currentPattern.patternData);
  expect(screen.getByTestId('main-cube-area')).toHaveAttribute('data-gyro', String(gyroscope));

  props.smartcube = { ...props.smartcube, currentPattern: start.applyAlg("R y'") };
  props.smartcubeAppendMoveKey = 'turn';
  props.smartcubeAppendMove = 'F';
  rerender(<PracticeView {...props} />);
  expect(shownData()).toEqual(selectedCase.applyAlg("R y'").patternData);

  props.scramble = { ...props.scramble, scrambleMode: true };
  rerender(<PracticeView {...props} />);
  expect(screen.getByTestId('main-cube-area')).not.toHaveAttribute('data-target');
});


it('shows the verified physical setup frame after Always Scramble To, then restores ordinary case previews', async () => {
  const solved = await solvedPattern(2);
  const algorithm = "R U R' U'";
  const target = solved.applyAlg(new Alg(algorithm).invert());
  const setup = solved.applyAlg("y'").applyAlg(new Alg(algorithm).invert());
  const props = makeProps({ puzzle: '2x2x2' });
  props.options.alwaysScrambleTo = true;
  props.training.displayAlg = algorithm;
  props.training.caseStartPattern = setup;
  props.training.casePicturePattern = setup;
  props.smartcube.currentPattern = setup;
  const { rerender } = render(<PracticeView {...props} />);
  const shownData = () => JSON.parse(screen.getByTestId('main-cube-area').dataset.target!);
  expect(shownData()).toEqual(setup.patternData);
  expect(shownData()).not.toEqual(target.patternData);
  props.smartcube = { ...props.smartcube, currentPattern: setup.applyMove('R') };
  rerender(<PracticeView {...props} />);
  expect(shownData()).toEqual(props.smartcube.currentPattern.patternData);

  const other = solved.applyAlg('R F U2');
  props.training = { ...props.training, caseStartPattern: other, casePicturePattern: null, visualResetKey: 2 };
  props.smartcube = { ...props.smartcube, currentPattern: other };
  rerender(<PracticeView {...props} />);
  expect(shownData()).toEqual(target.patternData);
  expect(shownData()).not.toEqual(other.patternData);
});

it.each([false, true])('preserves the next PBL view and R turn after Adj Adj with changing 2×2 reports (gyro %s)', async gyroscope => {
  const { default: defaults } = await import('../../src/data/defaultAlgs.json');
  const { getCaseCards } = await import('../../src/lib/case-cards');
  const cards = getCaseCards(defaults, '2x2x2:PBL', ['Ortega PBL'])
    .map(card => ({ ...card, id: `pbl-view-${gyroscope}-${card.id}` }));
  let physical = await solvedPattern(2);
  const props = makeProps({ puzzle: '2x2x2' });
  props.options.gyroscope = gyroscope;
  props.smartcube.gyroSupported = gyroscope;
  props.smartcube.currentPattern = fixOrientation(physical);
  props.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
  let trainingState!: TrainingState;
  function PblPractice() {
    const training = useTrainingState(cards, '2x2x2:PBL', {
      puzzle: '2x2x2', selectionChangeMode: 'bulk', countdownMode: false,
      randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
      currentPattern: props.smartcube.currentPattern,
    });
    const scramble = useScrambleState('2x2x2');
    trainingState = training;
    return <PracticeView {...props} training={training} scramble={scramble} />;
  }
  const { rerender } = render(<PblPractice />);
  await act(async () => { await trainingState.trainCurrent(physical, { algorithm: cards[0].algorithm }); });
  let event = 0;
  async function turn(move: string) {
    physical = physical.applyMove(move);
    props.smartcube = { ...props.smartcube, currentPattern: fixOrientation(physical),
      lastProcessedMove: { key: `pbl-${++event}`, move: 'F' } };
    // A normalized report and its gyro describe the sensor's frame together.
    const sensorFrame = guidanceFrameRotation(physical, props.smartcube.currentPattern)!;
    props.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone().multiply(sensorFrame.clone().invert());
    await act(async () => {
      trainingState.handleSmartcubeMove(props.smartcube.currentPattern, 'F');
      rerender(<PblPractice />);
    });
    expect(trainingState.recoveryTarget).toBeNull();
  }
  for (const card of cards.slice(0, 4)) {
    expect(trainingState.currentCase?.id).toBe(card.id);
    const moves = new Alg(card.algorithm).expand().toString().split(/\s+/)
      .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
    for (const move of moves) await turn(move);
  }
  expect(cards[3].name).toBe('Adj Adj - 2 bars');
  expect(trainingState.currentCase?.name).toBe('Adj Opp - Bar on top');
  const shown = () => new KPattern(physical.kpuzzle,
    JSON.parse(screen.getByTestId('main-cube-area').dataset.target!));
  const assertViewingAngle = () => {
    if (!gyroscope) return;
    const frame = JSON.parse(screen.getByTestId('main-cube-area').dataset.gyroFrame ?? 'null');
    const displayed = props.smartcube.cubeQuaternionRef.current.clone()
      .multiply(frame ? new Quaternion(frame.x, frame.y, frame.z, frame.w) : new Quaternion());
    expect(displayed.angleTo(HOME_ORIENTATION)).toBeLessThan(1e-6);
  };
  const before = shown();
  assertViewingAngle();
  await turn('R');
  assertViewingAngle();
  expect(getTrainingVisualDelta(before, shown())).toBe('R');
  expect(shown().isIdentical(before.applyMove('R'))).toBe(true);
});

it.each([false, true])('guides the 2×2 wand into the algorithm grip with rotated device reports (already prepared %s)', async prepared => {
  const actualScramble = await vi.importActual<typeof import('../../src/lib/scramble')>('../../src/lib/scramble');
  vi.mocked(patternToPlayerAlg).mockImplementation(actualScramble.patternToPlayerAlg);
  const solved = await solvedPattern(2);
  const algorithm = "R2 U' B2 U2 R2 U' R2";
  const current = prepared
    ? solved.applyAlg('x y').applyAlg(new Alg(algorithm).invert())
    : solved.applyAlg('x y R U');
  const props = makeProps({ puzzle: '2x2x2' });
  props.training.displayAlg = algorithm;
  props.smartcube.currentPattern = current;
  props.smartcube.refreshPattern = vi.fn(async () => props.smartcube.currentPattern);
  const cards = [{ ...props.training.currentCase, id: `wand-handoff-${prepared}`, algorithm }];
  let trainingState!: TrainingState;
  function SetupPractice() {
    const scramble = useScrambleState('2x2x2');
    const training = useTrainingState(cards, '2x2x2:PBL', {
      puzzle: '2x2x2', selectionChangeMode: 'manual', countdownMode: false,
      randomizeAUF: false, randomOrder: false, timeAttack: false, prioritizeSlowCases: false,
      prioritizeFailedCases: false, smartReviewScheduling: false, smartcubeConnected: true,
      currentPattern: props.smartcube.currentPattern,
    });
    trainingState = training;
    return <PracticeView {...props} training={training} scramble={scramble} />;
  }
  const user = userEvent.setup();
  const { rerender } = render(<SetupPractice />);
  await act(async () => { await trainingState.trainCurrent(current, { algorithm }); });
  const previewBeforeSetup = JSON.parse(screen.getByTestId('main-cube-area').dataset.target!);
  await user.click(screen.getByTitle('Scramble To...'));
  await screen.findByRole('region', { name: '2×2 guided setup' });
  expect(props.smartcube.handleGyroTrainingEvent).toHaveBeenCalledWith({ phase: 'guided-setup-start' });
  await screen.findByRole('button', { name: 'My cube matches' });
  expect(screen.getByText(/Keep this grip through the setup and into the algorithm/)).toBeVisible();
  let physical = solved.applyAlg(screen.getByTestId('recovery-cube').dataset.setup!);
  expect(fixOrientation(physical).isIdentical(fixOrientation(current))).toBe(true);
  await user.click(screen.getByRole('button', { name: 'My cube matches' }));
  for (let i = 0; i < 40 && screen.queryByRole('region', { name: '2×2 guided setup' }); i++) {
    await screen.findByRole('button', { name: 'Show turn again' });
    const picture = screen.getByTestId('recovery-cube');
    expect(solved.applyAlg(picture.dataset.setup!).isIdentical(physical)).toBe(true);
    physical = physical.applyMove(picture.dataset.turn!);
    // The firmware's frame and move code do not define the user's grip.
    props.smartcube = { ...props.smartcube, currentPattern: physical.applyAlg("z y'"), lastProcessedMove: { key: `${i}`, move: 'U' } };
    rerender(<SetupPractice />);
  }
  await waitFor(() => expect(screen.queryByRole('region', { name: '2×2 guided setup' })).toBeNull());
  expect(props.smartcube.handleGyroTrainingEvent).toHaveBeenCalledWith({ phase: 'guided-setup-complete', pattern: physical });
  expect(props.smartcube.handleGyroTrainingEvent).not.toHaveBeenCalledWith({ phase: 'guided-setup-cancel' });
  expect(fixOrientation(physical.applyAlg(algorithm)).isIdentical(solved)).toBe(true);
  expect(physical.patternData).toEqual(previewBeforeSetup);
  expect(patternToFacelets(physical).slice(8, 12)).toBe('FFFF');
  expect(trainingState.caseStartPattern?.isIdentical(physical)).toBe(true);
  expect(trainingState.casePicturePattern?.isIdentical(physical)).toBe(true);
  const shown = () => JSON.parse(screen.getByTestId('main-cube-area').dataset.target!);
  expect(shown()).toEqual(physical.patternData);
  const turns = new Alg(algorithm).expand().toString().split(/\s+/)
    .flatMap(move => /2'?$/.test(move) ? [move[0], move[0]] : [move]);
  for (let i = 0; i < turns.length - 1; i++) {
    physical = physical.applyMove(turns[i]);
    props.smartcube = { ...props.smartcube, currentPattern: fixOrientation(physical), lastProcessedMove: { key: `algorithm-${i}`, move: 'F' } };
    await act(async () => {
      trainingState.handleSmartcubeMove(props.smartcube.currentPattern, 'F');
      rerender(<SetupPractice />);
    });
    expect(trainingState.recoveryTarget).toBeNull();
    expect(shown()).toEqual(physical.patternData);
  }
});
