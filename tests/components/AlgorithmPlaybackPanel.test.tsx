import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import type { TwistyPlayer, ExperimentalMillisecondTimestamp } from 'cubing/twisty';
import { AlgorithmPlaybackPanel } from '../../src/components/AlgorithmPlaybackPanel';
import { solvedPattern } from '../../src/lib/cube-utils';
import { PUZZLES, puzzleLoader, type PuzzleId } from '../../src/lib/puzzles';

const additionalPuzzles: Array<[PuzzleId, string]> = [
  ['4x4x4', "Rw U2 Rw'"], ['5x5x5', "3Rw U2 3Rw'"],
  ['6x6x6', "3Rw U2 3Rw'"], ['7x7x7', "3Rw U2 3Rw'"],
  ['pyraminx', "R u R'"], ['megaminx', "R BR U2 BR' R'"],
  ['skewb', "R U R'"], ['fto', "R r U r' R'"],
];

const sheets = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (sheets) Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', sheets);
  else Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets');
});

describe('algorithm learning playback with the real player model', () => {
  it.each(additionalPuzzles)('plays puzzle-specific %s turns from the case to the solved state', async (puzzle, algorithm) => {
    const setupAlg = PUZZLES[puzzle].cube ? 'z2' : '';
    const { container } = render(<AlgorithmPlaybackPanel algorithm={algorithm}
      puzzle={puzzle} setupAlg={setupAlg} backView="none" onClose={vi.fn()} />);
    const player = container.querySelector('twisty-player') as TwistyPlayer;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next move' })).toBeEnabled());
    expect(await player.experimentalModel.puzzleID.get()).toBe(puzzle);
    const reference = (await puzzleLoader(puzzle).kpuzzle()).defaultPattern().applyAlg(setupAlg);
    expect((await player.experimentalModel.currentPattern.get())
      .isIdentical(reference.applyAlg(new Alg(algorithm).invert()))).toBe(true);
    act(() => { player.timestamp = 'end'; });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Algorithm complete'));
    expect((await player.experimentalModel.currentPattern.get()).isIdentical(reference)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Restart algorithm' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled());
  });

  it.each([2, 3] as const)('starts at the size %s case and solves it in the selected grip', async size => {
    const algorithm = "R U2 R'";
    const { container } = render(<StrictMode><AlgorithmPlaybackPanel algorithm={algorithm}
      puzzle={size === 2 ? '2x2x2' : '3x3x3'} setupAlg="z2" backView="none" onClose={vi.fn()} /></StrictMode>);
    const player = container.querySelector('twisty-player') as TwistyPlayer;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next move' })).toBeEnabled());
    const reference = (await solvedPattern(size)).applyAlg('z2');
    expect((await player.experimentalModel.currentPattern.get())
      .isIdentical(reference.applyAlg(new Alg(algorithm).invert()))).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to move 1: R' }).parentElement).toHaveAttribute('aria-current', 'step');

    await userEvent.click(screen.getByRole('button', { name: "Go to move 3: R'" }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 of 3 moves complete'));
    expect((await player.experimentalModel.currentPattern.get()).isIdentical(reference.applyAlg('R'))).toBe(true);

    act(() => { player.timestamp = 'end'; });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Algorithm complete'));
    expect((await player.experimentalModel.currentPattern.get()).isIdentical(reference)).toBe(true);
    expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Replay algorithm' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Restart algorithm' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0 of 3 moves complete'));
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled();
  });

  it('expands repeated moves and commutators and follows partial turns without losing rewind', async () => {
    const { container } = render(<AlgorithmPlaybackPanel algorithm="(R U2)2 [F, D]"
      puzzle="3x3x3" setupAlg="" backView="none" onClose={vi.fn()} />);
    const player = container.querySelector('twisty-player') as TwistyPlayer;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next move' })).toBeEnabled());
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['R', 'U2', 'R', 'U2', 'F', 'D', "F'", "D'"]);
    act(() => { player.timestamp = 500 as ExperimentalMillisecondTimestamp; });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous move' })).toBeEnabled());
    expect(screen.getByRole('status')).toHaveTextContent('0 of 8 moves complete');
    await userEvent.click(screen.getByRole('button', { name: 'Next move' }));
    expect(await player.experimentalModel.playingInfo.get()).toMatchObject({ playing: true, direction: 1, untilBoundary: 'move' });
    await userEvent.click(screen.getByRole('button', { name: 'Pause algorithm' }));
    expect((await player.experimentalModel.playingInfo.get()).playing).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Previous move' }));
    expect(await player.experimentalModel.playingInfo.get()).toMatchObject({ playing: true, direction: -1, untilBoundary: 'move' });
  });
});
