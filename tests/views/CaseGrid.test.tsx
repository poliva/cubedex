import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaseCardData } from '../../src/lib/case-cards';
import { CaseGrid } from '../../src/views/CaseGrid';

vi.mock('../../src/components/CaseCard', () => ({
  CaseCard: ({ card }: { card: CaseCardData }) => (
    <div data-testid="case-card" data-case-id={card.id} />
  ),
}));

const sampleCard: CaseCardData = {
  id: '1',
  name: 'Test',
  algorithm: "R U R'",
  subset: 'A',
  category: 'PLL',
  bestTime: null,
  ao5: null,
  learned: 0,
  manualLearned: 0,
  reviewCount: 0,
  smartReviewDueAt: null,
  smartReviewDue: true,
  smartReviewUrgency: 0,
};

describe('CaseGrid', () => {
  it.skip('renders a unified empty state', async () => {
    const { container } = render(
      <CaseGrid caseCards={[]} />,
    );

    expect(container.querySelector('#alg-cases')).toBeTruthy();
    expect(screen.getByTestId('case-grid-empty')).toBeInTheDocument();
  });

  it('renders a non-virtualized grid for a small set of cases', () => {
    render(
      <CaseGrid caseCards={[sampleCard]} />,
    );

    expect(screen.getAllByTestId('case-card').length).toBe(1);
  });

  it('updates the virtualized slice when scrolling an overflow parent (not window)', async () => {
    const nativeGbcr = HTMLElement.prototype.getBoundingClientRect;
    const cards: CaseCardData[] = Array.from({ length: 60 }, (_, i) => ({
      ...sampleCard,
      id: `case-${i}`,
      name: `Case ${i}`,
    }));

    let scrollHost: HTMLDivElement | null = null;

    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const el = this;
      if (el.dataset.testid === 'cases-scroll-host') {
        return new DOMRect(0, 0, 1200, 400);
      }
      if (el.parentElement?.id === 'alg-cases' && el.style.position === 'relative') {
        const st = scrollHost?.scrollTop ?? 0;
        const top = 40 - st;
        return new DOMRect(0, top, 1200, 60_000);
      }
      return nativeGbcr.call(el);
    });

    try {
      render(
        <div
          ref={(n) => {
            scrollHost = n;
          }}
          data-testid="cases-scroll-host"
          style={{ overflow: 'auto', height: 400, width: 1200 }}
        >
          <div style={{ height: 24 }} />
          <CaseGrid caseCards={cards} />
          <div style={{ height: 50_000 }} aria-hidden />
        </div>,
      );

      expect(scrollHost).toBeTruthy();

      const parseIdx = (id: string | undefined) =>
        id == null || !id.startsWith('case-') ? -1 : Number(id.slice('case-'.length));

      const initialIds = screen.getAllByTestId('case-card').map((n) => (n as HTMLElement).dataset.caseId);
      const initialMax = Math.max(...initialIds.map(parseIdx));
      expect(initialIds.length).toBeLessThan(cards.length);

      scrollHost!.scrollTop = 4500;
      fireEvent.scroll(scrollHost!);

      await waitFor(() => {
        const ids = screen.getAllByTestId('case-card').map((n) => (n as HTMLElement).dataset.caseId);
        const maxIdx = Math.max(...ids.map(parseIdx));
        expect(maxIdx).toBeGreaterThan(initialMax);
      });
    } finally {
      spy.mockRestore();
    }
  });
});
