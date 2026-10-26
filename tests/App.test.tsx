import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import { App } from '../src/App';
import type { SmartcubeConnectionState } from '../src/hooks/useSmartcubeConnection';

/** Mutable wiring for `alwaysScrambleTo` + scramble-mode regression (see App.tsx lastAutoScrambleKeyRef). */
const alwaysScrambleRegressDyn = vi.hoisted(() => ({
  alwaysScrambleTo: false,
  randomizeAUF: false,
  practiceTimeAttack: true,
  scrambleMode: false,
  setupTarget: null as object | null,
  advanceScramble: vi.fn(async () => false),
  /** Mimics real `useScrambleState` returning a new `startScrambleTo` when scramble state updates. */
  startScrambleToSpyPick: 0 as 0 | 1,
  startScrambleToSpyA: vi.fn(async () => true),
  startScrambleToSpyB: vi.fn(async () => true),
}));

const connectionDyn = vi.hoisted(() => ({ connected: false, cubeSize: 3, disconnectToken: 0,
  lastProcessedMove: null as SmartcubeConnectionState['lastProcessedMove'],
}));

const trainingRegressDyn = vi.hoisted(() => ({
  timerState: 'IDLE' as string,
  visualResetKey: 1,
  inputMode: false,
  statsAlgId: 'time-attack-scope',
  timeAttackMode: true,
  displayAlg: "R U R'",
  caseAlgorithm: '',
}));

const mockState = vi.hoisted(() => {
  const caseCard = {
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
    caseCards: [caseCard],
    selectedCaseIds: ['case-1'],
    practiceCounts: {
      'case-1': 0,
      'time-attack-scope': 0,
    } as Record<string, number>,
  };
});

const mocks = vi.hoisted(() => ({
  getBestTime: vi.fn(() => null),
  averageOfFiveTimeNumber: vi.fn(() => null),
  caseCardStoreSetState: vi.fn(),
  useTrainingGraphs: vi.fn(),
  removeAlgorithmTimesStorage: vi.fn(),
  useCaseLibrary: vi.fn((options?: { reviewRefreshToken?: number }) => ({
    isReady: true,
    savedAlgorithms: {},
    categories: ['PLL'],
    selectedCategory: 'PLL',
    subsets: ['A'],
    selectedSubsets: ['A'],
    caseCards: mockState.caseCards,
    selectedCaseIds: mockState.selectedCaseIds,
    selectionChangeMode: 'manual',
    selectAllCases: false,
    selectLearningCases: false,
    selectLearnedCases: false,
    setSelectedCategory: vi.fn(),
    toggleSubset: vi.fn(),
    toggleAllSubsets: vi.fn(),
    toggleCaseSelection: vi.fn(),
    selectVisibleCases: vi.fn(),
    clearSelectedCases: vi.fn(),
    setSelectAllCases: vi.fn(),
    setSelectLearningCases: vi.fn(),
    setSelectLearnedCases: vi.fn(),
    cycleCaseLearnedState: vi.fn(),
    reloadSavedAlgorithms: vi.fn(),
    _options: options,
  })),
  useTrainingState: vi.fn(() => ({
    inputMode: trainingRegressDyn.inputMode,
    scrambleMode: false,
    timerState: trainingRegressDyn.timerState,
    timerText: '0.000',
    countdownActive: false,
    countdownValue: null,
    visualResetKey: trainingRegressDyn.visualResetKey,
    algInput: '',
    displayAlg: trainingRegressDyn.displayAlg,
    caseAlgorithm: trainingRegressDyn.caseAlgorithm,
    currentCase: mockState.caseCards[0],
    currentAlgName: 'Aa',
    selectedCases: mockState.caseCards,
    stats: {
      best: '-',
      ao5: '-',
      average: '-',
      averageTps: '-',
      singlePb: '-',
      practiceCount: 0,
      hasHistory: false,
      lastFive: [],
    },
    statsAlgId: trainingRegressDyn.statsAlgId,
    displayMoves: [],
    fixText: '',
    fixVisible: false,
    helpTone: 'hidden',
    failedCounts: {},
    practiceCounts: mockState.practiceCounts,
    flashRequest: null,
    timeAttackMode: trainingRegressDyn.timeAttackMode,
    timeAttackActive: true,
    timeAttackCurrentCaseNumber: 1,
    timeAttackTotalCases: 1,
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
  })),
}));

vi.mock('cubing/alg', () => ({
  Alg: {
    fromString: vi.fn(() => ({
      invert: () => ({
        toString: () => '',
      }),
    })),
  },
}));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: class {
    constructor() {
      return document.createElement('div');
    }
  },
}));

vi.mock('cubing/puzzles', () => ({
  cube3x3x3: {},
}));

vi.mock('../src/state/caseCardStore', () => ({
  caseCardStore: {
    setState: mocks.caseCardStoreSetState,
  },
  setCaseCardActions: vi.fn(),
}));

vi.mock('../src/state/trainingViewStore', () => ({
  trainingViewStore: {
    setState: vi.fn(),
  },
}));

vi.mock('../src/hooks/useCaseLibrary', () => ({
  useCaseLibrary: mocks.useCaseLibrary,
}));

vi.mock('../src/hooks/useTrainingState', () => ({
  useTrainingState: mocks.useTrainingState,
}));

vi.mock('../src/hooks/useAppSettings', () => ({
  useAppSettings: vi.fn(() => ({
    fullStickering: false,
    gyroscope: false,
    flashingIndicatorEnabled: true,
    showAlgName: true,
    countdownMode: false,
    alwaysScrambleTo: alwaysScrambleRegressDyn.alwaysScrambleTo,
    allowAlternativeAlgorithms: localStorage.getItem('allowAlternativeAlgorithms') === 'true',
    autoUpdateLearningState: false,
    visualization: 'PG3D',
    backview: 'none',
    hintFacelets: 'none',
    whiteOnBottom: false,
    cubeSizePx: 420,
    showTimesInsteadOfGraph: false,
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
    setFlashingIndicatorEnabled: vi.fn(),
    setCubeSizePx: vi.fn(),
    setShowTimesInsteadOfGraph: vi.fn(),
  })),
}));

vi.mock('../src/hooks/usePracticeToggles', () => ({
  usePracticeToggles: vi.fn(() => ({
    randomizeAUF: alwaysScrambleRegressDyn.randomizeAUF,
    randomOrder: false,
    timeAttack: alwaysScrambleRegressDyn.practiceTimeAttack,
    prioritizeSlowCases: false,
    prioritizeFailedCases: false,
    smartReviewScheduling: false,
    setRandomizeAUF: vi.fn(),
    setRandomOrder: vi.fn(),
    setTimeAttack: vi.fn(),
    setPrioritizeSlowCases: vi.fn(),
    setPrioritizeFailedCases: vi.fn(),
    setSmartReviewScheduling: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useScrambleState', () => ({
  useScrambleState: vi.fn(() => ({
    scrambleMode: alwaysScrambleRegressDyn.scrambleMode,
    scrambleText: '',
    isComputing: false,
    targetAlgorithm: '',
    setupTarget: alwaysScrambleRegressDyn.setupTarget,
    helpTone: 'hidden',
    startScrambleTo: alwaysScrambleRegressDyn.startScrambleToSpyPick === 0
      ? alwaysScrambleRegressDyn.startScrambleToSpyA
      : alwaysScrambleRegressDyn.startScrambleToSpyB,
    advanceScramble: alwaysScrambleRegressDyn.advanceScramble,
    clearScramble: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useSmartcubeConnection', () => ({
  useSmartcubeConnection: vi.fn(() => ({
    connected: connectionDyn.connected,
    cubeSize: connectionDyn.cubeSize,
    connecting: false,
    disconnectToken: connectionDyn.disconnectToken,
    connectLabel: 'Connect',
    battery: { level: 100, color: 'green' },
    info: {
      deviceName: 'Cube',
      deviceMAC: 'AA:BB',
      deviceProtocol: 'GAN',
      hardwareName: 'GAN 12',
      hardwareVersion: '1',
      softwareVersion: '2',
      productDate: '2026-01-01',
      gyroSupported: 'NO',
      batteryLevel: '100%',
      skew: '0ms',
      quaternion: '0,0,0,1',
      velocity: '0',
    },
    currentFacelets: null,
    currentPattern: null,
    lastProcessedMove: connectionDyn.lastProcessedMove,
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
  })),
}));

vi.mock('../src/hooks/useAlgorithmImportExport', () => ({
  useAlgorithmImportExport: vi.fn(() => ({
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
  })),
}));

vi.mock('../src/hooks/useTrainingGraphs', () => ({
  useTrainingGraphs: mocks.useTrainingGraphs,
}));

vi.mock('../src/lib/stickering', () => ({
  getStickeringForCategory: vi.fn(() => 'PLL'),
}));

vi.mock('../src/lib/storage', async () => ({
  ...(await vi.importActual<typeof import('../src/lib/storage')>('../src/lib/storage')),
  deleteAlgorithm: vi.fn(),
  getBestTime: mocks.getBestTime,
  getSavedAlgorithms: vi.fn(() => ({})),
  removeAlgorithmTimesStorage: mocks.removeAlgorithmTimesStorage,
}));

vi.mock('../src/lib/case-cards', async () => ({
  ...(await vi.importActual<typeof import('../src/lib/case-cards')>('../src/lib/case-cards')),
  averageOfFiveTimeNumber: mocks.averageOfFiveTimeNumber,
}));

vi.mock('../src/lib/scramble', async () => ({
  ...(await vi.importActual<typeof import('../src/lib/scramble')>('../src/lib/scramble')),
  patternToPlayerAlg: vi.fn(() => ''),
}));

vi.mock('../src/components/Icons', () => ({
  HamburgerIcon: () => <div data-testid="hamburger-icon" />,
}));

vi.mock('../src/components/ImportFileInput', () => ({
  ImportFileInput: () => <div data-testid="import-file-input" />,
}));

vi.mock('../src/components/MenuNavIcons', () => ({
  MenuHelpIcon: () => <div data-testid="menu-help-icon" />,
  MenuNewAlgIcon: () => <div data-testid="menu-new-alg-icon" />,
  MenuOptionsIcon: () => <div data-testid="menu-options-icon" />,
  MenuPracticeIcon: () => <div data-testid="menu-practice-icon" />,
}));

vi.mock('../src/views/PracticeView', () => ({
  PracticeView: ({ mainCubeAlg }: { mainCubeAlg: string }) => <div data-testid="practice-view" data-alg={mainCubeAlg} />,
}));

vi.mock('../src/views/OptionsView', () => ({
  OptionsView: () => <div data-testid="options-view" />,
}));

vi.mock('../src/views/CasesView', () => ({
  CasesView: ({ handleDeleteTimes, onPracticeSelected }: { handleDeleteTimes: () => void; onPracticeSelected: () => void }) => (
    <div>
      <button type="button" onClick={handleDeleteTimes}>Delete Times</button>
      <button type="button" onClick={onPracticeSelected}>Practice Selected</button>
      <div data-testid="cases-view" />
    </div>
  ),
}));

vi.mock('../src/views/HelpView', () => ({
  HelpView: () => <div data-testid="help-view" />,
}));

describe('App case-card stats refresh', () => {
  it.each([true, false])('passes the alternative algorithm preference (%s) to training', enabled => {
    localStorage.setItem('allowAlternativeAlgorithms', String(enabled));
    render(<App />);
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith(expect.anything(), expect.anything(),
      expect.objectContaining({ allowAlternativeAlgorithms: enabled }));
  });

  it('refreshes per-card best and ao5 when a time-attack solve updates an individual case', () => {
    const { rerender } = render(<App />);

    mocks.getBestTime.mockClear();
    mocks.averageOfFiveTimeNumber.mockClear();
    mocks.caseCardStoreSetState.mockClear();
    mocks.useTrainingGraphs.mockClear();

    mockState.practiceCounts = {
      'case-1': 1,
      'time-attack-scope': 0,
    };

    rerender(<App />);

    expect(mocks.getBestTime).toHaveBeenCalledWith('case-1');
    expect(mocks.averageOfFiveTimeNumber).toHaveBeenCalledWith('case-1');
  });

  it('bumps review refresh after deleting times so learned state can recompute', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    mocks.removeAlgorithmTimesStorage.mockClear();
    mocks.useCaseLibrary.mockClear();
    mocks.useTrainingState.mockClear();

    await user.click(screen.getByRole('button', { name: 'Cases' }));
    await user.click(screen.getByRole('button', { name: 'Practice Selected' }));
    await user.click(screen.getByRole('button', { name: 'Cases' }));
    await user.click(screen.getByRole('button', { name: 'Delete Times' }));

    expect(mocks.removeAlgorithmTimesStorage).toHaveBeenCalledWith('case-1');
    expect(mocks.useCaseLibrary).toHaveBeenLastCalledWith(expect.objectContaining({
      reviewRefreshToken: 1,
    }));
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith(
      mockState.caseCards,
      'PLL',
      expect.objectContaining({
        reviewRefreshToken: 1,
      }),
    );

    confirmSpy.mockRestore();
  });
});

describe('App alwaysScrambleTo auto scramble-to', () => {
  beforeEach(() => {
    alwaysScrambleRegressDyn.alwaysScrambleTo = false;
    alwaysScrambleRegressDyn.randomizeAUF = false;
    alwaysScrambleRegressDyn.practiceTimeAttack = true;
    alwaysScrambleRegressDyn.scrambleMode = false;
    alwaysScrambleRegressDyn.startScrambleToSpyPick = 0;
    alwaysScrambleRegressDyn.startScrambleToSpyA.mockClear();
    alwaysScrambleRegressDyn.startScrambleToSpyB.mockClear();
    trainingRegressDyn.timerState = 'IDLE';
    trainingRegressDyn.statsAlgId = 'time-attack-scope';
    trainingRegressDyn.timeAttackMode = true;
    trainingRegressDyn.displayAlg = "R U R'";
  });

  it('does not call startScrambleTo again after scramble ends when alwaysScrambleTo is on', async () => {
    connectionDyn.connected = true;
    alwaysScrambleRegressDyn.alwaysScrambleTo = true;
    alwaysScrambleRegressDyn.practiceTimeAttack = false;
    trainingRegressDyn.timerState = 'READY';
    trainingRegressDyn.statsAlgId = 'case-1';
    trainingRegressDyn.timeAttackMode = false;

    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    const callsAfterInitial = alwaysScrambleRegressDyn.startScrambleToSpyA.mock.calls.length;

    alwaysScrambleRegressDyn.scrambleMode = true;
    rerender(<App />);

    alwaysScrambleRegressDyn.scrambleMode = false;
    alwaysScrambleRegressDyn.startScrambleToSpyPick = 1;
    rerender(<App />);

    expect(alwaysScrambleRegressDyn.startScrambleToSpyA.mock.calls.length).toBe(callsAfterInitial);
    expect(alwaysScrambleRegressDyn.startScrambleToSpyB).not.toHaveBeenCalled();
  });

  it.each([2, 3])('starts the prepared random-AUF case after one setup on a size %s cube', async cubeSize => {
    connectionDyn.connected = true;
    connectionDyn.cubeSize = cubeSize;
    alwaysScrambleRegressDyn.alwaysScrambleTo = true;
    alwaysScrambleRegressDyn.randomizeAUF = true;
    alwaysScrambleRegressDyn.practiceTimeAttack = false;
    trainingRegressDyn.timerState = 'READY';
    trainingRegressDyn.statsAlgId = 'case-1';
    trainingRegressDyn.timeAttackMode = false;
    trainingRegressDyn.displayAlg = "U R U R' U2";
    const preparedAlgorithm = trainingRegressDyn.displayAlg;
    let setupAlgorithm = '';
    alwaysScrambleRegressDyn.startScrambleToSpyA.mockImplementation(async (...args: unknown[]) => {
      const [algorithm, , , randomizeAUF] = args;
      // Model setup adding another AUF only if the caller requests it.
      setupAlgorithm = randomizeAUF ? `U ${algorithm} U` : String(algorithm);
      return true;
    });
    try {
      const { rerender } = render(<App />);
      await waitFor(() => expect(setupAlgorithm).not.toBe(''));
      alwaysScrambleRegressDyn.scrambleMode = true;
      rerender(<App />);

      // Guided setup preserves its target algorithm when it starts training.
      alwaysScrambleRegressDyn.scrambleMode = false;
      trainingRegressDyn.displayAlg = setupAlgorithm;
      trainingRegressDyn.visualResetKey += 1;
      rerender(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledTimes(1);
      expect(trainingRegressDyn.displayAlg).toBe(preparedAlgorithm);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenLastCalledWith(
        preparedAlgorithm, mockState.caseCards[0], null, false, undefined,
      );

      trainingRegressDyn.displayAlg = "U2 R U R' U'";
      rerender(<App />);
      await waitFor(() => expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledTimes(2));
    } finally {
      alwaysScrambleRegressDyn.randomizeAUF = false;
      alwaysScrambleRegressDyn.startScrambleToSpyA.mockReset().mockResolvedValue(true);
    }
  });
});


describe('App puzzle context', () => {
  beforeEach(() => {
    connectionDyn.connected = false;
    connectionDyn.cubeSize = 3;
    connectionDyn.disconnectToken = 0;
    alwaysScrambleRegressDyn.alwaysScrambleTo = false;
  });

  it.each([2, 3].flatMap(cubeSize => [
    { tab: 'Practice', title: 'Practice' },
    { tab: 'Cases', title: 'Case Library' },
    { tab: 'New', title: 'New Alg' },
    { tab: 'Options', title: 'Options' },
    { tab: 'Help', title: 'Help' },
  ].map(view => ({ ...view, cubeSize }))))
    ('stays on $tab when a size $cubeSize cube disconnects', async ({ tab, title, cubeSize }) => {
      connectionDyn.connected = true;
      connectionDyn.cubeSize = cubeSize;
      const { rerender } = render(<App />);
      await userEvent.click(screen.getByRole('button', { name: tab }));
      const expectCurrentTab = () => expect(screen.getAllByText(title)
        .find(element => !element.closest('button'))).toBeVisible();
      expectCurrentTab();
      connectionDyn.connected = false;
      connectionDyn.disconnectToken += 1;
      rerender(<App />);
      expectCurrentTab();
      expect(mocks.useCaseLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ puzzle: '3x3x3' }));
      // A later disconnect notification must not navigate either.
      connectionDyn.disconnectToken += 1;
      rerender(<App />);
      expectCurrentTab();
      connectionDyn.disconnectToken = 0;
    });

  it.each(['pyraminx', '4x4x4', '5x5x5', 'megaminx', '6x6x6', '7x7x7', 'skewb', 'fto'])('remembers %s, follows a connected 2×2 and restores the manual choice on disconnect', async (manualPuzzle) => {
    const { rerender } = render(<App />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Puzzle' }), manualPuzzle);
    expect(window.localStorage.getItem('practicePuzzle')).toBe(manualPuzzle);
    expect(mocks.useCaseLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ puzzle: manualPuzzle }));
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ puzzle: manualPuzzle, randomizeAUF: false }));
    connectionDyn.connected = true;
    connectionDyn.cubeSize = 2;
    rerender(<App />);
    expect(screen.queryByRole('combobox', { name: 'Puzzle' })).not.toBeInTheDocument();
    expect(mocks.useCaseLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ puzzle: '2x2x2' }));
    connectionDyn.connected = false;
    rerender(<App />);
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toHaveValue(manualPuzzle);
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toBeEnabled();
  });
});


describe('App manual setup follows displayed cases', () => {
  beforeEach(() => {
    connectionDyn.connected = false;
    alwaysScrambleRegressDyn.alwaysScrambleTo = false;
    alwaysScrambleRegressDyn.practiceTimeAttack = false;
    alwaysScrambleRegressDyn.scrambleMode = false;
    alwaysScrambleRegressDyn.startScrambleToSpyPick = 0;
    alwaysScrambleRegressDyn.startScrambleToSpyA.mockClear();
    trainingRegressDyn.displayAlg = "R U R'";
    trainingRegressDyn.visualResetKey = 1;
    trainingRegressDyn.inputMode = false;
    trainingRegressDyn.timerState = 'READY';
  });

  it.each(['3x3x3', '4x4x4', '5x5x5', 'pyraminx', 'megaminx', '6x6x6', '7x7x7', 'skewb', 'fto'])(
    'refreshes a requested setup on the next case and repeat attempt for %s', (puzzle) => {
      window.localStorage.setItem('practicePuzzle', puzzle);
      const { rerender } = render(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).not.toHaveBeenCalled();
      // The wand has been used, then Train dismisses its current setup.
      alwaysScrambleRegressDyn.scrambleMode = true;
      rerender(<App />);
      alwaysScrambleRegressDyn.scrambleMode = false;
      rerender(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).not.toHaveBeenCalled();

      trainingRegressDyn.displayAlg = "F R U R' U' F'";
      trainingRegressDyn.visualResetKey += 1;
      rerender(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenLastCalledWith(
        trainingRegressDyn.displayAlg, mockState.caseCards[0], null, false,
      );
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledTimes(1);
      rerender(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledTimes(1);

      // A repeat case still needs its setup restored after the timer advances.
      trainingRegressDyn.visualResetKey += 1;
      trainingRegressDyn.timerState = 'RUNNING';
      rerender(<App />);
      expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledTimes(2);
    },
  );

  it('leaves manual setups off until requested', () => {
    const { rerender } = render(<App />);
    trainingRegressDyn.displayAlg = "F R U R' U' F'";
    trainingRegressDyn.visualResetKey += 1;
    rerender(<App />);
    expect(alwaysScrambleRegressDyn.startScrambleToSpyA).not.toHaveBeenCalled();
  });

  it('refreshes setups in manual time attack when Always Scramble To is enabled', () => {
    window.localStorage.setItem('practicePuzzle', 'megaminx');
    alwaysScrambleRegressDyn.alwaysScrambleTo = true;
    alwaysScrambleRegressDyn.practiceTimeAttack = true;
    render(<App />);
    expect(alwaysScrambleRegressDyn.startScrambleToSpyA).toHaveBeenCalledWith(
      trainingRegressDyn.displayAlg, mockState.caseCards[0], null, false,
    );
  });
});

it.each([false, true])('lets guided 2×2 setup consume turns without replaying them as input or training (input mode %s)', inputMode => {
  const previousInputMode = trainingRegressDyn.inputMode;
  trainingRegressDyn.inputMode = inputMode;
  connectionDyn.lastProcessedMove = { key: 'setup-final-turn', move: 'U', rawMoves: [], visualMove: 'U', currentPattern: null, isBugged: false };
  alwaysScrambleRegressDyn.scrambleMode = true;
  alwaysScrambleRegressDyn.setupTarget = {};
  alwaysScrambleRegressDyn.advanceScramble.mockClear();
  const initialCalls = mocks.useTrainingState.mock.results.length;
  try {
    const { rerender } = render(<App />);
    alwaysScrambleRegressDyn.scrambleMode = false;
    alwaysScrambleRegressDyn.setupTarget = null;
    rerender(<App />);
    expect(alwaysScrambleRegressDyn.advanceScramble).not.toHaveBeenCalled();
    for (const result of mocks.useTrainingState.mock.results.slice(initialCalls)) {
      expect(result.value.setAlgInput).not.toHaveBeenCalled();
      expect(result.value.handleSmartcubeMove).not.toHaveBeenCalled();
    }
  } finally {
    connectionDyn.lastProcessedMove = null;
    alwaysScrambleRegressDyn.scrambleMode = false;
    alwaysScrambleRegressDyn.setupTarget = null;
    trainingRegressDyn.inputMode = previousInputMode;
  }
});


describe('App practice selection confirmation', () => {
  beforeEach(() => {
    connectionDyn.connected = false;
    connectionDyn.cubeSize = 3;
    alwaysScrambleRegressDyn.alwaysScrambleTo = false;
  });

  async function confirmSelection(action: 'Practice' | 'Practice Selected') {
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith([], expect.anything(), expect.anything());
    if (!screen.queryByTestId('cases-view')) {
      await userEvent.click(screen.getByRole('button', { name: 'Cases' }));
    }
    await userEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.queryByTestId('cases-view')).not.toBeInTheDocument();
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith(mockState.caseCards, expect.anything(), expect.anything());
  }

  it.each([
    [2, 'Practice'], [3, 'Practice'],
    [2, 'Practice Selected'], [3, 'Practice Selected'],
  ] as const)('starts selected cases after connecting a size %s cube and reconnecting via %s', async (cubeSize, action) => {
    const { rerender } = render(<App />);
    await confirmSelection(action);
    connectionDyn.connected = true;
    connectionDyn.cubeSize = cubeSize;
    rerender(<App />);
    expect(screen.getByTestId('cases-view')).toBeInTheDocument();
    await confirmSelection(action);
    connectionDyn.connected = false;
    rerender(<App />);
    expect(screen.queryByTestId('cases-view')).not.toBeInTheDocument();
    expect(mocks.useTrainingState).toHaveBeenLastCalledWith([], expect.anything(), expect.anything());
    connectionDyn.connected = true;
    rerender(<App />);
    await confirmSelection(action);
  });

  it.each(['Practice', 'Practice Selected'] as const)('starts selected cases via %s after manual puzzle changes, including switching back', async action => {
    render(<App />);
    await confirmSelection(action);
    for (const puzzle of ['2x2x2', '3x3x3']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Puzzle' }), puzzle);
      expect(screen.queryByTestId('cases-view')).not.toBeInTheDocument();
      expect(mocks.useTrainingState).toHaveBeenLastCalledWith([], expect.anything(), expect.objectContaining({ puzzle }));
      await confirmSelection(action);
    }
  });
});

it('keeps the cube animation seed when equivalent AUF guidance changes, and refreshes it for the next case', async () => {
  const { Alg: RealAlg } = await vi.importActual<typeof import('cubing/alg')>('cubing/alg');
  vi.mocked(Alg.fromString).mockImplementation(algorithm => RealAlg.fromString(algorithm));
  connectionDyn.connected = true;
  connectionDyn.cubeSize = 3;
  alwaysScrambleRegressDyn.alwaysScrambleTo = false;
  alwaysScrambleRegressDyn.scrambleMode = false;
  trainingRegressDyn.inputMode = false;
  trainingRegressDyn.timerState = 'RUNNING';
  const original = "U' M2 U' M2 U2 M2 U' M2";
  trainingRegressDyn.caseAlgorithm = original;
  trainingRegressDyn.displayAlg = original;
  const { rerender } = render(<App />);
  const seed = RealAlg.fromString(original).invert().toString();
  expect(screen.getByTestId('practice-view')).toHaveAttribute('data-alg', seed);

  trainingRegressDyn.displayAlg = "M2 U' M2 U2 M2 U' M2 U'";
  rerender(<App />);
  expect(screen.getByTestId('practice-view')).toHaveAttribute('data-alg', seed);

  const next = "R U R'";
  trainingRegressDyn.caseAlgorithm = next;
  trainingRegressDyn.displayAlg = next;
  trainingRegressDyn.visualResetKey += 1;
  rerender(<App />);
  expect(screen.getByTestId('practice-view')).toHaveAttribute('data-alg', RealAlg.fromString(next).invert().toString());
  trainingRegressDyn.caseAlgorithm = '';
});
