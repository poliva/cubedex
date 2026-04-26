import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('renders a unified empty state and optional Options CTA', async () => {
    const user = userEvent.setup();
    const onOpenOptions = vi.fn();
    const { container } = render(
      <CaseGrid caseCards={[]} onOpenOptions={onOpenOptions} />,
    );

    expect(container.querySelector('#alg-cases')).toBeTruthy();
    expect(screen.getByTestId('case-grid-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open options/i }));
    expect(onOpenOptions).toHaveBeenCalledTimes(1);
  });

  it('renders a non-virtualized grid for a small set of cases', () => {
    render(
      <CaseGrid caseCards={[sampleCard]} />,
    );

    expect(screen.getAllByTestId('case-card').length).toBe(1);
  });
});
