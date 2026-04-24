import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '../../src/hooks/useIsMobile';

function Probe() {
  const isMobile = useIsMobile();
  return <div>{isMobile ? 'mobile' : 'desktop'}</div>;
}

describe('useIsMobile', () => {
  it('subscribes to matchMedia changes and cleans up on unmount', () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (type !== 'change' || typeof listener !== 'function') {
        return;
      }
      changeListener = listener;
    });
    const removeEventListener = vi.fn();

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    } as MediaQueryList));

    const { unmount } = render(<Probe />);

    expect(screen.getByText('desktop')).toBeInTheDocument();
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 639px)');
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    act(() => {
      changeListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(screen.getByText('mobile')).toBeInTheDocument();

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('change', addEventListener.mock.calls[0]?.[1]);
  });
});
