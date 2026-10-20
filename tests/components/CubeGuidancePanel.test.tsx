import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { KPattern } from 'cubing/kpuzzle';
import { CubeGuidancePanel } from '../../src/components/CubeGuidancePanel';
import { solvedPattern } from '../../src/lib/cube-utils';
import { fixOrientation, get2x2RecoveryMoves } from '../../src/lib/scramble';
import { HOME_ORIENTATION } from '../../src/lib/cube-orientation';
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

describe('gyro grip warnings', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it.each(['setup', 'recovery'] as const)('allows a normal tilt through %s confirmation, guidance, and completion', async mode => {
    const f = await fixture();
    f.smartcube.gyroSupported = true;
    f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 4));
    const { rerender, container } = render(<CubeGuidancePanel {...f} mode={mode} />);
    await act(async () => {});
    const confirm = screen.getByRole('button', { name: 'My cube matches' });
    expect(confirm).toBeEnabled();
    await act(async () => { fireEvent.click(confirm); });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.recovery-picture [data-testid="reference"]')).toHaveAttribute('data-autoplay', 'true');
    f.onRecovered.mockClear();
    f.smartcube = { ...f.smartcube, currentPattern: f.target };
    rerender(<CubeGuidancePanel {...f} mode={mode} />);
    expect(f.onRecovered).toHaveBeenCalledOnce();
    expect(f.onRecovered).toHaveLastReturnedWith(true);
    expect(screen.queryByText('Stickers ready — match the pictured grip')).toBeNull();
  });

  it.each(([2, 3] as const).flatMap(size => [false, true].flatMap(expert =>
    (['setup', 'recovery'] as const).map(mode => ({ size, expert, mode })))))
    ('warns and resumes automatically for $size× $mode (expert $expert)', async ({ size, expert, mode }) => {
      const f = await fixture(size);
      f.smartcube.gyroSupported = true;
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
      const { container, unmount } = render(<CubeGuidancePanel {...f} mode={mode} expertScrambler={expert} />);
      await act(async () => {});
      if (!expert) await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'My cube matches' })); });
      const main = () => container.querySelector('.recovery-picture [data-testid="reference"]')!;
      expect(main()).toHaveAttribute('data-autoplay', String(!expert));
      const setup = main().getAttribute('data-setup');
      f.onRecovered.mockClear();
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2));
      act(() => vi.advanceTimersByTime(700));
      const warning = screen.getByRole('alert', { name: 'Cube orientation warning' });
      expect(warning).toHaveTextContent('Turn the front of the cube to your left.');
      expect(warning).toHaveTextContent('Keep the layers still.');
      expect(warning.querySelector('svg')).toHaveAttribute('data-axis', 'y');
      expect(warning.querySelector('svg')).toHaveAttribute('data-direction', '-1');
      expect(main()).toHaveAttribute('data-autoplay', 'false');
      expect(main()).toHaveAttribute('data-turn', '');
      expect(main().getAttribute('data-setup')).toBe(setup);
      expect(within(warning).getByTestId('reference')).toHaveAttribute('data-gyro', 'true');
      expect(f.onRecovered).not.toHaveBeenCalled();
      if (expert) expect(screen.getByRole('list')).toHaveClass('guidance-sequence--paused');
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
      act(() => vi.advanceTimersByTime(100));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('✓ Grip aligned')).toBeVisible();
      expect(main()).toHaveAttribute('data-autoplay', String(!expert));
      expect(main().getAttribute('data-setup')).toBe(setup);
      if (!expert) expect(main()).toHaveAttribute('data-turn', "F'");
      expect(f.onRecovered).not.toHaveBeenCalled();
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

  it('shows the rotation before confirmation and offers Reset Gyro in the warning', async () => {
    const f = await fixture();
    f.smartcube.gyroSupported = true;
    f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
    f.smartcube.resetGyro = vi.fn(() => { f.smartcube.cubeQuaternionRef.current = null; });
    render(<CubeGuidancePanel {...f} mode="setup" />);
    await act(async () => {});
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole('alert')).toHaveTextContent('Tilt the top of the cube away from you.');
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Gyro' }));
    expect(f.smartcube.resetGyro).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('alert')).toBeNull();
    f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeEnabled();
  });

  it('compares against a rotated case picture rather than always demanding the connection grip', async () => {
    const f = await fixture(3);
    f.target = f.target.applyAlg('y');
    f.smartcube.gyroSupported = true;
    f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
    render(<CubeGuidancePanel {...f} mode="setup" />);
    await act(async () => {});
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole('alert')).toHaveTextContent('Turn the front of the cube to your left.');
    f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'My cube matches' })).toBeEnabled();
  });

  it.each([{ size: 2 as const, mode: 'setup' as const }, { size: 3 as const, mode: 'recovery' as const }])
    ('waits at the end of $size× $mode for a gyro-only grip correction', async ({ size, mode }) => {
      const f = await fixture(size);
      f.smartcube.gyroSupported = true;
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
      const registered = { current: null as ((pattern: KPattern) => boolean) | null };
      const register = vi.fn((check: ((pattern: KPattern) => boolean) | null) => { registered.current = check; });
      const { rerender, container, unmount } = render(<CubeGuidancePanel {...f} mode={mode} expertScrambler onGripCheck={register} />);
      await act(async () => {});
      f.onRecovered.mockClear();
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone()
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2));
      // The last turn arrives before the warning debounce has elapsed.
      f.smartcube = { ...f.smartcube, currentPattern: f.target };
      rerender(<CubeGuidancePanel {...f} mode={mode} expertScrambler onGripCheck={register} />);
      expect(screen.getByText('Stickers ready — match the pictured grip')).toBeVisible();
      expect(f.onRecovered).not.toHaveBeenCalled();
      expect(registered.current?.(f.target)).toBe(false);
      const picture = container.querySelector('.recovery-picture [data-testid="reference"]') as HTMLElement;
      expect(f.solved.applyAlg(picture.dataset.setup!).isIdentical(f.target)).toBe(true);
      act(() => vi.advanceTimersByTime(700));
      expect(screen.getByRole('alert')).toBeVisible();
      f.smartcube.cubeQuaternionRef.current = HOME_ORIENTATION.clone();
      act(() => vi.advanceTimersByTime(100));
      expect(f.onRecovered).toHaveBeenCalledOnce();
      expect(f.onRecovered).toHaveLastReturnedWith(true);
      unmount();
      expect(registered.current).toBeNull();
    });
});
