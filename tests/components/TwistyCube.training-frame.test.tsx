import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KPattern } from 'cubing/kpuzzle';
import { solvedPattern } from '../../src/lib/cube-utils';
import { project2x2TrainingPattern } from '../../src/lib/training-visual';
import { TwistyCube } from '../../src/components/TwistyCube';

const drawing = vi.hoisted(() => ({
  solved: null as KPattern | null,
  current: null as KPattern | null,
  moves: [] as string[],
  resets: 0,
}));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: class {
    constructor() {
      const player = document.createElement('div');
      Object.defineProperty(player, 'alg', { set(value: string) {
        drawing.current = drawing.solved!.applyAlg(value);
        drawing.resets++;
      } });
      Object.assign(player, {
        pause: () => {},
        experimentalAddMove: (move: string) => {
          drawing.moves.push(move);
          drawing.current = drawing.current!.applyMove(move);
        },
      });
      return player;
    }
  },
}));

describe('TwistyCube training frame', () => {
  it('renders selected-case rotation and animates state-derived turns without appending raw aliases twice', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    drawing.resets = 0;
    const algorithm = "R U R'";
    const start = solved.applyAlg('R F2 U');
    const initial = project2x2TrainingPattern(algorithm, start, start.applyAlg("y'"));
    const props = {
      puzzle: '2x2x2' as const, alg: "R U' R'", resetToken: 'case-1',
      targetPattern: initial, visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', enableExternalOrientationLoop: false,
      appendMoveKey: 'old', appendMove: 'F', orientationResetAlg: 'U2', orientationResetToken: 1,
    };
    const { rerender } = render(<TwistyCube {...props} />);
    expect(drawing.current?.isIdentical(initial)).toBe(true);
    expect(drawing.moves).toEqual([]);
    const resetsBefore = drawing.resets;

    const after = project2x2TrainingPattern(algorithm, start, start.applyAlg("R y'"));
    rerender(<TwistyCube {...props} targetPattern={after} appendMoveKey="new" appendMove="F" />);
    expect(drawing.current?.isIdentical(after)).toBe(true);
    expect(drawing.moves).toHaveLength(1);
    expect(drawing.resets).toBe(resetsBefore);

    // A report whose frame changes must end at the exact picture, including yaw.
    const reframed = after.applyAlg("y'");
    rerender(<TwistyCube {...props} targetPattern={reframed} appendMoveKey="same-state" />);
    expect(drawing.current?.isIdentical(reframed)).toBe(true);

    // Case transitions replace the base picture and skip the previous raw event.
    const nextAlgorithm = "F U F'";
    const nextStart = start.applyMove('R');
    const next = project2x2TrainingPattern(nextAlgorithm, nextStart, nextStart.applyAlg('y2'));
    const movesBefore = drawing.moves.length;
    rerender(<TwistyCube {...props} alg="F U' F'" resetToken="case-2"
      targetPattern={next} appendMoveKey="same-state" />);
    expect(drawing.current?.isIdentical(next)).toBe(true);
    expect(drawing.moves).toHaveLength(movesBefore);
    rerender(<TwistyCube {...props} alg="F U' F'" resetToken="case-2"
      targetPattern={null} appendMoveKey="same-state" />);
    expect(drawing.moves).toHaveLength(movesBefore);
  });

  it('replaces a multi-turn batch exactly and accepts half turns as two quarter updates', async () => {
    const solved = await solvedPattern(2);
    drawing.solved = solved;
    drawing.moves = [];
    const props = { puzzle: '2x2x2' as const, alg: '', targetPattern: solved,
      visualization: '3D', hintFacelets: 'none', controlPanel: 'none',
      experimentalStickering: 'full', enableExternalOrientationLoop: false };
    const { rerender } = render(<TwistyCube {...props} />);
    const batched = solved.applyAlg("R U F R'");
    rerender(<TwistyCube {...props} targetPattern={batched} />);
    expect(drawing.current?.isIdentical(batched)).toBe(true);
    drawing.moves = [];
    rerender(<TwistyCube {...props} targetPattern={batched.applyMove('R')} />);
    rerender(<TwistyCube {...props} targetPattern={batched.applyMove('R2')} />);
    expect(drawing.current?.isIdentical(batched.applyMove('R2'))).toBe(true);
    expect(drawing.moves).toEqual(['R', 'R']);
  });
});
