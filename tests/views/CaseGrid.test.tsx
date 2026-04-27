import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaseCardData } from '../../src/lib/case-cards';
import { CaseGrid } from '../../src/views/CaseGrid';

vi.mock('../../src/components/CaseCard', () => ({
  CaseCard: () => <div data-testid="case-card" />,
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
});
