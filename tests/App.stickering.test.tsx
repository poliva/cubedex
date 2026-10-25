import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { MainCubeArea } from '../src/views/MainCubeArea';
import type { ComponentProps } from 'react';

const connection = vi.hoisted(() => ({ connected: false }));

vi.mock('../src/lib/storage', async importOriginal => {
  const storage = await importOriginal<typeof import('../src/lib/storage')>();
  const { default: defaults } = await import('../src/data/defaultAlgs.json');
  return {
    ...storage,
    initializeDefaultAlgorithms: vi.fn(async () => ({ alertMessage: null })),
    getSavedAlgorithms: () => ({
      PLL: defaults.PLL,
      '2x2x2:OLL': defaults['2x2x2:OLL'],
      '2x2x2:PBL': defaults['2x2x2:PBL'],
    }),
  };
});

vi.mock('../src/hooks/useSmartcubeConnection', () => ({
  useSmartcubeConnection: () => ({
    connected: connection.connected,
    cubeSize: 2,
    connecting: false,
    disconnectToken: 0,
    connectLabel: 'Connect',
    battery: { level: 100, color: 'green' },
    info: { deviceMAC: 'AA:BB', gyroSupported: 'NO' },
    currentFacelets: null,
    currentPattern: null,
    lastProcessedMove: null,
    showAllBluetoothDevices: false,
    setShowAllBluetoothDevices: vi.fn(),
    connectOrDisconnect: vi.fn(),
    resetState: vi.fn(),
    resetGyro: vi.fn(),
    resetOrientation: vi.fn(),
    gyroSupported: false,
    gyroSupportResolved: true,
    gyroscopeToggleDisabled: true,
    cubeQuaternion: null,
    cubeQuaternionRef: { current: null },
  }),
}));

vi.mock('../src/hooks/useTrainingGraphs', () => ({ useTrainingGraphs: vi.fn() }));
vi.mock('../src/views/CaseGrid', () => ({ CaseGrid: () => <div /> }));
vi.mock('../src/views/MainCubeArea', () => ({
  MainCubeArea: ({ puzzle, experimentalStickering }: ComponentProps<typeof MainCubeArea>) => (
    <div data-testid="main-cube" data-puzzle={puzzle} data-stickering={experimentalStickering} />
  ),
}));

describe('main cube stickering after connecting a 2×2', () => {
  it.each([
    ['default selection', 'Practice'],
    ['default selection', 'Practice Selected'],
    ['All', 'Practice Selected'],
    ['Ortega OLL', 'Practice Selected'],
  ])('masks OLL after confirming %s via %s without switching categories', async (subset, action) => {
    connection.connected = false;
    const user = userEvent.setup();
    const { rerender } = render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading saved data…')).toBeNull());

    connection.connected = true;
    rerender(<App />);
    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-puzzle', '2x2x2');
    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-stickering', 'full');

    expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeEnabled();
    if (subset !== 'default selection') {
      const subsetButton = screen.getAllByRole('button', { name: subset })[0];
      await user.click(subsetButton);
      expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeDisabled();
      await user.click(subsetButton);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: action }));

    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-stickering', 'OLL');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next case' })).toBeEnabled());
  });
});

describe('switching puzzles on the Practice screen', () => {
  it.each(['Options', 'Help'])('keeps Practice empty after visiting %s until Cases has been opened', async tab => {
    connection.connected = false;
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading saved data…')).toBeNull());
    const expectEmptyPractice = () => {
      expect(screen.getByTestId('stats-empty-state')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Next case' })).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument();
    };
    expectEmptyPractice();
    await user.click(screen.getByRole('button', { name: tab }));
    await user.click(screen.getByRole('button', { name: 'Practice' }));
    expectEmptyPractice();
    await user.click(screen.getByRole('button', { name: 'Practice' }));
    expectEmptyPractice();

    await user.click(screen.getByRole('button', { name: 'Cases' }));
    await user.click(screen.getByRole('button', { name: tab }));
    await user.click(screen.getByRole('button', { name: 'Practice' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next case' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: tab }));
    await user.click(screen.getByRole('button', { name: 'Practice' }));
    expect(screen.getByRole('button', { name: 'Next case' })).toBeEnabled();
  });

  it.each([false, true])('shows empty practice for the new puzzle (started practice: %s)', async startedPractice => {
    connection.connected = false;
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading saved data…')).toBeNull());
    if (startedPractice) {
      await user.click(screen.getByRole('button', { name: 'Cases' }));
      await user.click(screen.getByRole('button', { name: 'Practice' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Next case' })).toBeEnabled());
    }

    for (const puzzle of ['2x2x2', '3x3x3']) {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Puzzle' }), puzzle);
      expect(screen.getByTestId('main-cube')).toBeVisible();
      expect(screen.getByTestId('main-cube')).toHaveAttribute('data-puzzle', puzzle);
      expect(screen.getByTestId('main-cube')).toHaveAttribute('data-stickering', 'full');
      expect(screen.getByTestId('stats-empty-state')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Next case' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Practice Selected' })).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Options' }));
      await user.click(screen.getByRole('button', { name: 'Practice' }));
      expect(screen.getByTestId('stats-empty-state')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Next case' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Open case library' }));
      expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Practice Selected' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Next case' })).toBeEnabled());
    }
  });
});
