import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

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
    inputMode: false,
    scrambleMode: false,
    timerState: 'IDLE',
    timerText: '0.000',
    countdownActive: false,
    countdownValue: null,
    visualResetKey: 1,
    algInput: '',
    displayAlg: "R U R'",
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
    statsAlgId: 'time-attack-scope',
    displayMoves: [],
    fixText: '',
    fixVisible: false,
    helpTone: 'hidden',
    failedCounts: {},
    practiceCounts: mockState.practiceCounts,
    flashRequest: null,
    timeAttackMode: true,
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
    alwaysScrambleTo: false,
    autoUpdateLearningState: false,
    visualization: 'PG3D',
    backview: 'none',
    hintFacelets: 'none',
    whiteOnBottom: false,
    controlPanel: 'none',
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
  })),
}));

vi.mock('../src/hooks/usePracticeToggles', () => ({
  usePracticeToggles: vi.fn(() => ({
    randomizeAUF: false,
    randomOrder: false,
    timeAttack: true,
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
    scrambleMode: false,
    scrambleText: '',
    isComputing: false,
    targetAlgorithm: '',
    helpTone: 'hidden',
    startScrambleTo: vi.fn(async () => true),
    advanceScramble: vi.fn(async () => false),
    clearScramble: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useSmartcubeConnection', () => ({
  useSmartcubeConnection: vi.fn(() => ({
    connected: false,
    connecting: false,
    disconnectToken: 0,
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
  PracticeView: () => <div data-testid="practice-view" />,
}));

vi.mock('../src/views/OptionsView', () => ({
  OptionsView: () => <div data-testid="options-view" />,
}));

vi.mock('../src/views/CasesView', () => ({
  CasesView: ({ handleDeleteTimes }: { handleDeleteTimes: () => void }) => (
    <div>
      <button type="button" onClick={handleDeleteTimes}>Delete Times</button>
      <div data-testid="cases-view" />
    </div>
  ),
}));

vi.mock('../src/views/HelpView', () => ({
  HelpView: () => <div data-testid="help-view" />,
}));

describe('App case-card stats refresh', () => {
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
