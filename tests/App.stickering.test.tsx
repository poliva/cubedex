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
  it.each(['All', 'Ortega OLL'])('masks OLL after selecting the %s subset control without switching categories', async subset => {
    connection.connected = false;
    const user = userEvent.setup();
    const { rerender } = render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading saved data…')).toBeNull());

    connection.connected = true;
    rerender(<App />);
    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-puzzle', '2x2x2');
    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-stickering', 'full');

    await user.click(screen.getByRole('button', { name: 'Cases' }));
    await user.click(screen.getAllByRole('button', { name: subset })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Practice Selected' }));

    expect(screen.getByTestId('main-cube')).toHaveAttribute('data-stickering', 'OLL');
  });
});
