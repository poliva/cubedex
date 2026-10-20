import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { KPattern } from 'cubing/kpuzzle';
import { CubeGuidancePanel } from '../../src/components/CubeGuidancePanel';
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

async function fixture(size: 2 | 3 = 2) {
  const solved = await solvedPattern(size);
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
  it('requires grip confirmation for an already prepared setup, including refreshes', async () => {
    const f = await fixture();
    f.smartcube = { ...f.smartcube, currentPattern: f.target.applyAlg('x y'),
      refreshPattern: vi.fn(async () => f.target.applyAlg('x y')) };
    const user = userEvent.setup();
    render(<CubeGuidancePanel {...f} mode="setup" />);
    await screen.findByRole('button', { name: 'My cube matches' });
    expect(f.onRecovered).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Picture doesn’t match? Refresh' }));
    await screen.findByRole('button', { name: 'My cube matches' });
    expect(f.onRecovered).not.toHaveBeenCalled();
    const picture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(picture.isIdentical(f.target)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'My cube matches' }));
    await waitFor(() => expect(f.onRecovered).toHaveBeenCalledOnce());
    expect(f.onRecovered.mock.calls[0][0].isIdentical(f.target)).toBe(true);
  });

  it.each([
    { targetAlg: 'F U R', error: 'D', sensorRotation: 'x y' },
    { targetAlg: 'L U B R', error: 'F R', sensorRotation: 'y' },
    { targetAlg: 'R F2 x y', error: 'L B', sensorRotation: 'z x' },
  ])('keeps the continuation grip after recovering $error with sensor rotation $sensorRotation', async ({ targetAlg, error, sensorRotation }) => {
    const f = await fixture();
    f.target = f.solved.applyAlg(targetAlg);
    f.current = f.target.applyAlg(`${error} ${sensorRotation}`);
    f.smartcube = { ...f.smartcube, currentPattern: f.current, refreshPattern: vi.fn(async () => f.current) };
    f.onRecovered = vi.fn((pattern: KPattern) => equivalent(pattern, f.target));
    const user = userEvent.setup();
    const { rerender } = render(<CubeGuidancePanel {...f} />);
    await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    expect(screen.getByText(/continue the algorithm without rotating the cube/)).toBeVisible();
    let physical = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(equivalent(physical, f.current)).toBe(true);
    for (let i = 0; i < 40; i++) {
      const ref = screen.getByTestId('reference');
      expect(f.solved.applyAlg(ref.dataset.setup!).isIdentical(physical)).toBe(true);
      physical = physical.applyMove(ref.dataset.turn!);
      f.smartcube = { ...f.smartcube, currentPattern: physical.applyAlg(sensorRotation), lastProcessedMove: { key: `${i}` } as never };
      rerender(<CubeGuidancePanel {...f} />);
      if (equivalent(physical, f.target)) break;
      expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
    }
    // Exact equality matters: an equivalent rotated cube changes the next
    // algorithm turn's physical face even though recovery would accept it.
    expect(physical.isIdentical(f.target)).toBe(true);
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it('shows exact current stickers in a stationary, fully colored frame before confirmation', async () => {
    const f = await fixture();
    const { rerender } = render(<CubeGuidancePanel {...f} />);
    await screen.findByRole('button', { name: 'My cube matches' });
    const reference = screen.getByTestId('reference');
    expect(f.solved.applyAlg(reference.dataset.setup!).isIdentical(f.current)).toBe(true);
    expect(reference).toHaveAttribute('data-turn', '');
    expect(reference).toHaveAttribute('data-gyro', 'false');
    expect(reference).toHaveAttribute('data-loop', 'false');
    expect(reference).toHaveAttribute('data-drag', 'none');
    expect(reference).toHaveAttribute('data-stickers', 'full');
    f.smartcube = { ...f.smartcube, cubeQuaternionRef: { current: { x: 0, y: 1, z: 0, w: 0 } } };
    rerender(<CubeGuidancePanel {...f} />);
    expect(screen.getByTestId('reference').dataset.setup).toBe(reference.dataset.setup);
    expect(screen.getByText(/Rotate the whole cube/)).toBeVisible();
  });

  it('animates only U/R/F in the pictured frame and advances from physical state, including quarter packets for a half turn', async () => {
    const f = await fixture();
    const user = userEvent.setup();
    const { rerender } = render(<CubeGuidancePanel {...f} />);
    await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    expect(screen.getByTestId('reference').dataset.turn).toBe("F'");
    let completed = false;
    let turnCount = 0;
    for (let i = 0; i < 40; i++) {
      const ref = screen.getByTestId('reference');
      const move = ref.dataset.turn!;
      expect(move).toMatch(/^[URF]'?$/);
      expect(ref.dataset.autoplay).toBe('true');
      const before = f.solved.applyAlg(ref.dataset.setup!);
      expect(equivalent(before, f.smartcube.currentPattern!)).toBe(true);
      const actual = before.applyMove(move).applyAlg('x y');
      turnCount++;
      f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: `${i}` } as never };
      rerender(<CubeGuidancePanel {...f} />);
      if (equivalent(actual, f.target)) { completed = true; break; }
      expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
    }
    expect(completed).toBe(true);
    expect(turnCount).toBe(3); // Undo F, then R2 as two quarter-turn packets.
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it('requires alignment again after a layer turn or an additional guided mistake', async () => {
    const f = await fixture();
    const user = userEvent.setup();
    const { rerender } = render(<CubeGuidancePanel {...f} />);
    await screen.findByRole('button', { name: 'My cube matches' });
    const actual = f.current.applyAlg('D x y');
    f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: 'new' } as never };
    rerender(<CubeGuidancePanel {...f} />);
    expect(screen.getByText(/The cube changed/)).toBeVisible();
    const picture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(equivalent(picture, actual)).toBe(true);
    expect(picture.applyAlg((await get2x2RecoveryMoves(picture, f.target)).join(' ')).isIdentical(f.target)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    const wrong = actual.applyAlg('U F');
    f.smartcube = { ...f.smartcube, currentPattern: wrong, lastProcessedMove: { key: 'wrong' } as never };
    rerender(<CubeGuidancePanel {...f} />);
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeVisible();
    expect(screen.getByTestId('reference')).toHaveAttribute('data-turn', '');
    const updatedPicture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(equivalent(updatedPicture, wrong)).toBe(true);
    expect(updatedPicture.applyAlg((await get2x2RecoveryMoves(updatedPicture, f.target)).join(' ')).isIdentical(f.target)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Back to undo help' }));
    expect(f.onCancel).toHaveBeenCalledOnce();
  });

  it('offers read retry, recognizes an already recovered snapshot, and cancels pending work on unmount', async () => {
    const f = await fixture();
    f.smartcube.refreshPattern = vi.fn().mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue(f.target);
    const user = userEvent.setup();
    const { unmount } = render(<CubeGuidancePanel {...f} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Read failed');
    await user.click(screen.getByRole('button', { name: 'Retry reading cube' }));
    await waitFor(() => expect(f.onRecovered).toHaveLastReturnedWith(true));
    unmount();
    let resolve!: (pattern: KPattern) => void;
    let signal: AbortSignal | undefined;
    f.smartcube.refreshPattern = vi.fn(s => { signal = s; return new Promise<KPattern>(yes => { resolve = yes; }); });
    const pending = render(<CubeGuidancePanel {...f} />);
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
  const { rerender } = render(<CubeGuidancePanel {...f} />);
  await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
  await screen.findByRole('button', { name: 'Show turn again' });
  const before = screen.getByTestId('reference').dataset.turn;
  // An unrelated telemetry token with unchanged stickers cannot advance a step.
  f.smartcube = { ...f.smartcube, currentPattern: f.current };
  rerender(<CubeGuidancePanel {...f} />);
  expect(screen.getByTestId('reference').dataset.turn).toBe(before);
  const actual = f.current.applyAlg(quarters.slice(0, 2).join(' ')).applyAlg('z');
  f.smartcube = { ...f.smartcube, currentPattern: actual, lastProcessedMove: { key: 'batch' } as never };
  rerender(<CubeGuidancePanel {...f} />);
  if (quarters.length > 2) {
    const picture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(equivalent(picture, actual)).toBe(true);
    expect(screen.getByTestId('reference').dataset.turn).toBe(quarters[2]);
  } else expect(f.onRecovered).toHaveLastReturnedWith(true);
});

it('stops the demonstration after a failed device read and offers retry', async () => {
  const f = await fixture();
  const user = userEvent.setup();
  const { rerender } = render(<CubeGuidancePanel {...f} />);
  await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
  await screen.findByRole('button', { name: 'Show turn again' });
  f.smartcube = { ...f.smartcube, stateSyncError: 'Could not read the cube.' };
  rerender(<CubeGuidancePanel {...f} />);
  expect(screen.queryByTestId('reference')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not read the cube.');
  expect(screen.getByRole('button', { name: 'Retry reading cube' })).toBeVisible();
});

describe.each([2, 3] as const)('%i× cube shared guidance', size => {
  it.each(['setup', 'recovery'] as const)('guides %s with the exact target grip', async mode => {
    const f = await fixture(size);
    f.target = f.target.applyAlg('x y');
    f.current = f.target.applyAlg("R2 F z");
    f.smartcube = { ...f.smartcube, currentPattern: f.current, refreshPattern: vi.fn(async () => f.current) };
    f.onRecovered = vi.fn(pattern => equivalent(pattern, f.target));
    const user = userEvent.setup();
    const { rerender } = render(<CubeGuidancePanel {...f} mode={mode} />);
    await user.click(await screen.findByRole('button', { name: 'My cube matches' }));
    await screen.findByRole('button', { name: 'Show turn again' });
    let physical = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    for (let i = 0; i < 40; i++) {
      const picture = screen.getByTestId('reference');
      expect(f.solved.applyAlg(picture.dataset.setup!).isIdentical(physical)).toBe(true);
      physical = physical.applyMove(picture.dataset.turn!);
      f.smartcube = { ...f.smartcube, currentPattern: physical.applyAlg('z x'), lastProcessedMove: { key: `${i}` } as never };
      rerender(<CubeGuidancePanel {...f} mode={mode} />);
      if (equivalent(physical, f.target)) break;
    }
    expect(physical.isIdentical(f.target)).toBe(true);
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it.each(['setup', 'recovery'] as const)('shows the full %s sequence immediately and tracks fast batches', async mode => {
    const f = await fixture(size);
    const { rerender } = render(<CubeGuidancePanel {...f} mode={mode} expertScrambler />);
    const list = await screen.findByRole('list', { name: mode === 'setup' ? 'Setup algorithm' : 'Recovery algorithm' });
    expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
    expect(screen.getByTestId('reference')).toHaveAttribute('data-autoplay', 'false');
    expect(screen.getByTestId('reference')).toHaveAttribute('data-turn', '');
    const moves = Array.from(list.children).map(item => item.textContent!);
    expect(moves).toEqual(["F'", 'R2']);
    // A new device event with unchanged stickers cannot advance or replan.
    f.smartcube = { ...f.smartcube, lastProcessedMove: { key: 'token-only' } as never };
    rerender(<CubeGuidancePanel {...f} mode={mode} expertScrambler />);
    expect(screen.getByRole('list')).toHaveTextContent("F'R2");
    expect(screen.getByText('0 of 2 moves complete')).toBeVisible();
    let physical = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    physical = physical.applyAlg("F' R");
    f.smartcube = { ...f.smartcube, currentPattern: physical.applyAlg('y') };
    rerender(<CubeGuidancePanel {...f} mode={mode} expertScrambler />);
    expect(screen.getByText('1 of 2 moves complete')).toBeVisible();
    expect(list.children[0]).toHaveClass('guidance-sequence__done');
    expect(list.children[1]).toHaveAttribute('aria-current', 'step');
    physical = physical.applyMove('R');
    f.smartcube = { ...f.smartcube, currentPattern: physical.applyAlg('x y') };
    rerender(<CubeGuidancePanel {...f} mode={mode} expertScrambler />);
    expect(physical.isIdentical(f.target)).toBe(true);
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it('accepts an expert half turn in either direction', async () => {
    const f = await fixture(size);
    f.current = f.target.applyMove('R2');
    f.smartcube = { ...f.smartcube, currentPattern: f.current, refreshPattern: vi.fn(async () => f.current) };
    const { rerender } = render(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    await screen.findByRole('list');
    let physical = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!).applyMove("R'");
    f.smartcube = { ...f.smartcube, currentPattern: physical };
    rerender(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    expect(screen.getByRole('list')).toHaveTextContent('R2');
    expect(screen.queryByText(/cube changed/)).toBeNull();
    expect(f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!).isIdentical(physical)).toBe(true);
    physical = physical.applyMove("R'");
    f.smartcube = { ...f.smartcube, currentPattern: physical };
    rerender(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    expect(physical.isIdentical(f.target)).toBe(true);
    expect(f.onRecovered).toHaveLastReturnedWith(true);
  });

  it('replans expert mistakes automatically and can switch guidance styles during setup', async () => {
    const f = await fixture(size);
    const user = userEvent.setup();
    const { rerender } = render(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    await screen.findByRole('list');
    const wrong = f.current.applyMove('U');
    f.smartcube = { ...f.smartcube, currentPattern: wrong };
    rerender(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    await screen.findByRole('list');
    expect(screen.getByText(/cube changed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
    const moves = Array.from(screen.getByRole('list').children).map(item => item.textContent!).join(' ');
    const picture = f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!);
    expect(picture.applyAlg(moves).isIdentical(f.target)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Guide one turn at a time' }));
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show full sequence' }));
    await screen.findByRole('list');
    expect(screen.queryByRole('button', { name: 'My cube matches' })).toBeNull();
  });

  it('requires a grip confirmation when an expert setup needs no turns', async () => {
    const f = await fixture(size);
    f.smartcube = { ...f.smartcube, currentPattern: f.target.applyAlg('x y'),
      refreshPattern: vi.fn(async () => f.target.applyAlg('x y')) };
    render(<CubeGuidancePanel {...f} mode="setup" expertScrambler />);
    await screen.findByRole('button', { name: 'Start algorithm' });
    expect(f.onRecovered).not.toHaveBeenCalled();
    expect(f.solved.applyAlg(screen.getByTestId('reference').dataset.setup!).isIdentical(f.target)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Start algorithm' }));
    await waitFor(() => expect(f.onRecovered).toHaveBeenCalledOnce());
  });
});
