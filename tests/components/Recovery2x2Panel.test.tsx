import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { KPattern } from 'cubing/kpuzzle';
import { Recovery2x2Panel } from '../../src/components/Recovery2x2Panel';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation, get2x2RecoveryMoves } from '../../src/lib/scramble';
import type { SmartcubeConnectionState } from '../../src/hooks/useSmartcubeConnection';
import type { TwistyCubeProps } from '../../src/components/TwistyCube';

vi.mock('../../src/components/TwistyCube', () => ({
  TwistyCube: (props: TwistyCubeProps) => <div data-testid="reference" data-setup={props.setupAlg}
    data-turn={props.alg} data-gyro={String(props.gyroscopeEnabled)} data-loop={String(props.enableExternalOrientationLoop)}
    data-drag={props.dragInput} data-stickers={props.experimentalStickering} data-autoplay={String(props.autoplay)} />,
}));
const equivalent = (a: KPattern, b: KPattern) => fixOrientation(a).isIdentical(fixOrientation(b));

async function fixture() {
  const solved = await solvedPattern(2);
  const target = solved.applyAlg('F U R');
  const current = target.applyAlg('R2 F');
  const onRecovered = vi.fn((pattern: KPattern) => equivalent(pattern, target));
  const onCancel = vi.fn();
  const smartcube = { connected: true, currentPattern: current,
    lastProcessedMove: null, refreshPattern: vi.fn(async () => current),
    cubeQuaternionRef: { current: { x: 1, y: 0, z: 0, w: 0 } },
  } as unknown as SmartcubeConnectionState;
  return { solved, current, target, onRecovered, onCancel, smartcube };
}

describe('guided visual recovery', () => {
  it('shows exact current stickers in a stationary, fully colored frame before confirmation', async () => {
    const f = await fixture();
    const { rerender } = render(<Recovery2x2Panel {...f} />);
    await screen.findByRole('button', { name: 'My cube matches' });
    const reference = screen.getByTestId('reference');
    expect(f.solved.applyAlg(reference.dataset.setup!).isIdentical(f.current)).toBe(true);
    expect(reference).toHaveAttribute('data-turn', '');
    expect(reference).toHaveAttribute('data-gyro', 'false');
    expect(reference).toHaveAttribute('data-loop', 'false');
    expect(reference).toHaveAttribute('data-drag', 'none');
    expect(reference).toHaveAttribute('data-stickers', 'full');
    f.smartcube = { ...f.smartcube, cubeQuaternionRef: { current: { x: 0, y: 1, z: 0, w: 0 } } };
    rerender(<Recovery2x2Panel {...f} />);
    expect(screen.getByTestId('reference').dataset.setup).toBe(reference.dataset.setup);
    expect(screen.getByText(/Rotate the whole cube/)).toBeVisible();
  });

  it('animates only U/R/F in the pictured frame and advances from physical state, including quarter packets for a half turn', async () => {
    const f = await fixture();
    const user = userEvent.setup();
    const { rerender } = render(<Recovery2x2Panel {...f} />);
    await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    let completed = false;
    for (let i = 0; i < 40; i++) {
      const ref = screen.getByTestId('reference');
      const move = ref.dataset.turn!;
      expect(move).toMatch(/^[URF]'?$/);
      expect(ref.dataset.autoplay).toBe('true');
      const before = f.solved.applyAlg(ref.dataset.setup!);
      expect(equivalent(before, f.smartcube.currentPattern!)).toBe(true);
      const actual = before.applyMove(move).applyAlg('x y');
      f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: `${i}` } as never };
      rerender(<Recovery2x2Panel {...f} />);
      if (equivalent(actual, f.target)) { completed = true; break; }
      expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
    }
    expect(completed).toBe(true);
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it('requires alignment again after a layer turn or an additional guided mistake', async () => {
    const f = await fixture();
    const user = userEvent.setup();
    const { rerender } = render(<Recovery2x2Panel {...f} />);
    await screen.findByRole('button', { name: 'My cube matches' });
    const actual = f.current.applyMove('U');
    f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: 'new' } as never };
    rerender(<Recovery2x2Panel {...f} />);
    expect(screen.getByText(/The cube changed/)).toBeVisible();
    expect(f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!).isIdentical(actual)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    const wrong = actual.applyAlg('U F');
    f.smartcube = { ...f.smartcube, currentPattern: wrong, lastProcessedMove: { key: 'wrong' } as never };
    rerender(<Recovery2x2Panel {...f} />);
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeVisible();
    expect(screen.getByTestId('reference')).toHaveAttribute('data-turn', '');
    await user.click(screen.getByRole('button', { name: 'Back to undo help' }));
    expect(f.onCancel).toHaveBeenCalledOnce();
  });

  it('offers read retry, recognizes an already recovered snapshot, and cancels pending work on unmount', async () => {
    const f = await fixture();
    f.smartcube.refreshPattern = vi.fn().mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue(f.target);
    const user = userEvent.setup();
    const { unmount } = render(<Recovery2x2Panel {...f} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Read failed');
    await user.click(screen.getByRole('button', { name: 'Retry reading cube' }));
    await waitFor(() => expect(f.onRecovered).toHaveLastReturnedWith(true));
    unmount();
    let resolve!: (pattern: KPattern) => void;
    let signal: AbortSignal | undefined;
    f.smartcube.refreshPattern = vi.fn(s => { signal = s; return new Promise<KPattern>(yes => { resolve = yes; }); });
    const pending = render(<Recovery2x2Panel {...f} />);
    pending.unmount();
    expect(signal?.aborted).toBe(true);
    f.onRecovered.mockClear();
    await act(async () => { resolve(f.target); });
    expect(f.onRecovered).not.toHaveBeenCalled();
  });
});


it('accepts a snapshot spanning consecutive corrections without advancing from tokens alone', async () => {
  const f = await fixture();
  const corrections = await get2x2RecoveryMoves(f.current, f.target);
  const quarters = corrections.flatMap(move => move.endsWith('2') ? [move[0], move[0]] : [move]);
  expect(quarters.length).toBeGreaterThanOrEqual(2);
  const user = userEvent.setup();
  const { rerender } = render(<Recovery2x2Panel {...f} />);
  await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
  await screen.findByRole('button', { name: 'Show turn again' });
  const before = screen.getByTestId('reference').dataset.turn;
  // An unrelated telemetry token with unchanged stickers cannot advance a step.
  f.smartcube = { ...f.smartcube, currentPattern: f.current };
  rerender(<Recovery2x2Panel {...f} />);
  expect(screen.getByTestId('reference').dataset.turn).toBe(before);
  const actual = f.current.applyAlg(quarters.slice(0, 2).join(' ')).applyAlg('z');
  f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: 'batch' } as never };
  rerender(<Recovery2x2Panel {...f} />);
  if (quarters.length > 2) {
    const picture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(equivalent(picture, actual)).toBe(true);
    expect(screen.getByTestId('reference').dataset.turn).toBe(quarters[2]);
  } else expect(f.onRecovered).toHaveLastReturnedWith(true);
});

it('stops the demonstration after a failed device read and offers retry', async () => {
  const f = await fixture();
  const user = userEvent.setup();
  const { rerender } = render(<Recovery2x2Panel {...f} />);
  await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
  await screen.findByRole('button', { name: 'Show turn again' });
  f.smartcube = { ...f.smartcube, stateSyncError: 'Could not read the cube.' };
  rerender(<Recovery2x2Panel {...f} />);
  expect(screen.queryByTestId('reference')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not read the cube.');
  expect(screen.getByRole('button', { name: 'Retry reading cube' })).toBeVisible();
});
