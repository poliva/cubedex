import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import { TwistyPlayer } from 'cubing/twisty';
import { TwistyCube } from '../../src/components/TwistyCube';
import { solvedPattern } from '../../src/lib/cube-utils';

const adoptedStyleSheetsDescriptor = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');

beforeEach(() => {
  // Exercise the real player model without starting its WebGL view in jsdom.
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
    configurable: true, writable: true, value: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (adoptedStyleSheetsDescriptor) {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', adoptedStyleSheetsDescriptor);
  } else Reflect.deleteProperty(ShadowRoot.prototype, 'adoptedStyleSheets');
});

describe('TwistyCube initial playback position', () => {
  it.each([2, 3].flatMap(size => [false, true].map(prepared => ({ size: size as 2 | 3, prepared }))))
    ('shows the first and next $size×$size case before any turn (prepared $prepared)', async ({ size, prepared }) => {
      const solved = await solvedPattern(size);
      const inverse = new Alg("R U R' U'").invert().toString();
      const props = {
        puzzle: size === 2 ? '2x2x2' as const : '3x3x3' as const,
        alg: inverse, setupAlg: 'z2', visualization: '3D', hintFacelets: 'none',
        controlPanel: 'none', experimentalStickering: 'full', enableExternalOrientationLoop: false,
        targetPattern: prepared ? solved.applyAlg(inverse) : null,
      };
      const { container, rerender } = render(<StrictMode><TwistyCube {...props} /></StrictMode>);
      const player = container.querySelector('twisty-player') as TwistyPlayer;
      const reference = solved.applyAlg('z2');
      expect((await player.experimentalModel.currentPattern.get())
        .isIdentical(reference.applyAlg(inverse))).toBe(true);

      // The physical cube has just been solved; no new move is available yet.
      if (prepared) {
        rerender(<StrictMode><TwistyCube {...props} targetPattern={solved} /></StrictMode>);
        expect((await player.experimentalModel.currentPattern.get()).isIdentical(reference)).toBe(true);
      }
      const nextInverse = new Alg("F R U R' U' F'").invert().toString();
      rerender(<StrictMode><TwistyCube {...props} alg={nextInverse} targetPattern={null} resetToken="next-case" /></StrictMode>);
      expect((await player.experimentalModel.currentPattern.get())
        .isIdentical(reference.applyAlg(nextInverse))).toBe(true);
    });

  it('starts an animated guidance turn at the pictured setup', async () => {
    // Freeze playback so the first animation frame can be checked exactly.
    const play = vi.spyOn(TwistyPlayer.prototype, 'play').mockImplementation(() => {});
    const solved = await solvedPattern(3);
    const { container } = render(<StrictMode><TwistyCube
      alg="R" setupAlg="F U" autoplay visualization="3D" hintFacelets="none"
      controlPanel="none" experimentalStickering="full" enableExternalOrientationLoop={false}
    /></StrictMode>);
    const player = container.querySelector('twisty-player') as TwistyPlayer;
    expect(play).toHaveBeenCalled();
    expect((await player.experimentalModel.currentPattern.get()).isIdentical(solved.applyAlg('F U'))).toBe(true);
    expect((await player.experimentalModel.detailedTimelineInfo.get()).atStart).toBe(true);
  });
});
