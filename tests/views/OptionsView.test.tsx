import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionsView } from '../../src/views/OptionsView';
import type { AlgorithmImportExportState } from '../../src/hooks/useAlgorithmImportExport';
import type { AppSettingsState } from '../../src/hooks/useAppSettings';
import type { SmartcubeConnectionState } from '../../src/hooks/useSmartcubeConnection';

function createOptions(overrides: Partial<AppSettingsState> = {}): AppSettingsState {
  return {
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
    gyroscope: true,
    controlPanel: 'none',
    flashingIndicatorEnabled: true,
    cubeSizePx: 400,
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
    setControlPanel: vi.fn(),
    setFlashingIndicatorEnabled: vi.fn(),
    setCubeSizePx: vi.fn(),
    setShowTimesInsteadOfGraph: vi.fn(),
    ...overrides,
  };
}

function createSmartcube(overrides: Partial<SmartcubeConnectionState> = {}): SmartcubeConnectionState {
  return {
    connected: false,
    connecting: false,
    disconnectToken: 0,
    connectLabel: 'Connect',
    battery: { level: null, color: 'default' },
    info: {
      deviceName: 'Cube',
      deviceMAC: 'AA:BB',
      deviceProtocol: 'GAN',
      hardwareName: 'GAN 12',
      hardwareVersion: '1',
      softwareVersion: '2',
      productDate: '2026-01-01',
      gyroSupported: 'YES',
      batteryLevel: '88%',
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
    gyroSupported: true,
    gyroSupportResolved: true,
    gyroscopeToggleDisabled: false,
    cubeQuaternion: null,
    cubeQuaternionRef: { current: null },
    ...overrides,
  };
}

function createAlgorithmActions(overrides: Partial<AlgorithmImportExportState> = {}): AlgorithmImportExportState {
  return {
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
    ...overrides,
  };
}

describe('OptionsView', () => {
  it('shows the white-on-bottom dependency and forwards toggle changes', async () => {
    const user = userEvent.setup();
    const options = createOptions();

    render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={vi.fn()}
        options={options}
        smartcube={createSmartcube()}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    const whiteOnBottom = screen.getByLabelText('Virtual Cube White on Bottom');
    expect(whiteOnBottom).toBeDisabled();
    expect(screen.getByText('Requires "Always Show Full Stickers"')).toBeVisible();

    await user.click(screen.getByLabelText('Always Show Full Stickers'));
    expect(options.setFullStickering).toHaveBeenCalledWith(true);
  });

  it('disables gyro controls for non-gyro smartcubes and enables device info when connected', async () => {
    const user = userEvent.setup();
    const options = createOptions({ gyroscope: true });
    const smartcube = createSmartcube({
      connected: true,
      gyroSupported: false,
      gyroscopeToggleDisabled: true,
    });

    render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={vi.fn()}
        options={options}
        smartcube={smartcube}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    expect(screen.getByLabelText('Animate Virtual Cube Using Gyroscope')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Reset Gyro' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Device Info' })).toBeEnabled();

    await user.click(screen.getByLabelText('Show all Bluetooth devices when connecting'));
    expect(smartcube.setShowAllBluetoothDevices).toHaveBeenCalledWith(true);
  });

  it('opens device info with setInfoVisible(true) and hides other option sections when info is shown', async () => {
    const user = userEvent.setup();
    const setInfoVisible = vi.fn();
    const smartcube = createSmartcube({ connected: true });

    const { rerender } = render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={setInfoVisible}
        options={createOptions()}
        smartcube={smartcube}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Device Info' }));
    expect(setInfoVisible).toHaveBeenCalledWith(true);

    rerender(
      <OptionsView
        visible
        infoVisible
        setInfoVisible={setInfoVisible}
        options={createOptions()}
        smartcube={smartcube}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    expect(screen.getByText('Device Name')).toBeVisible();
    expect(screen.getByText('Cube')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.queryByLabelText('Countdown Mode')).toBeNull();
  });

  it('forwards non-default visualization settings and cube size changes', async () => {
    const options = createOptions({
      visualization: '2D',
      backview: 'side-by-side',
      hintFacelets: 'floating',
      controlPanel: 'bottom-row',
      fullStickering: true,
      whiteOnBottom: true,
    });

    render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={vi.fn()}
        options={options}
        smartcube={createSmartcube()}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    expect(screen.getByDisplayValue('2D')).toBeVisible();
    expect(screen.getByDisplayValue('Side-by-side')).toBeVisible();
    expect(screen.getByLabelText('Virtual Cube White on Bottom')).toBeEnabled();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '480' } });
    expect(options.setCubeSizePx).toHaveBeenCalledWith(480);
  });

  it('forwards countdown mode toggle changes', async () => {
    const user = userEvent.setup();
    const options = createOptions({ countdownMode: false });

    render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={vi.fn()}
        options={options}
        smartcube={createSmartcube()}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    await user.click(screen.getByLabelText('Countdown Mode'));
    expect(options.setCountdownMode).toHaveBeenCalledWith(true);
  });

  it('forwards auto learning state toggle changes', async () => {
    const user = userEvent.setup();
    const options = createOptions({ autoUpdateLearningState: false });

    render(
      <OptionsView
        visible
        infoVisible={false}
        setInfoVisible={vi.fn()}
        options={options}
        smartcube={createSmartcube()}
        algorithmActions={createAlgorithmActions()}
      />,
    );

    await user.click(screen.getByLabelText('Auto-update learning state'));
    expect(options.setAutoUpdateLearningState).toHaveBeenCalledWith(true);
  });
});
