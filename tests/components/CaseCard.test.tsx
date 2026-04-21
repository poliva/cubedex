import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCard } from '../../src/components/CaseCard';

const mockState = vi.hoisted(() => ({
  autoUpdateLearningState: false,
  cycleCaseLearnedState: vi.fn(),
  onBeforeToggleCase: vi.fn(),
  selected: false,
  toggleCaseSelection: vi.fn(),
}));

vi.mock('../../src/components/CaseCardPreview', () => ({
  CaseCardPreview: () => <div data-testid="case-card-preview" />,
}));

vi.mock('../../src/lib/stickering', () => ({
  getStickeringForCategory: vi.fn(() => 'PLL'),
}));

vi.mock('../../src/state/caseCardStore', () => ({
  stableActions: {
    cycleCaseLearnedState: (id: string) => mockState.cycleCaseLearnedState(id),
    toggleCaseSelection: (id: string, checked: boolean) => mockState.toggleCaseSelection(id, checked),
    onBeforeToggleCase: () => mockState.onBeforeToggleCase(),
  },
  useCaseCardSlice: vi.fn(() => ({
    practiceCount: 0,
    failedCount: 0,
    bestTime: null,
    ao5: null,
    selected: mockState.selected,
  })),
  useFullStickering: vi.fn(() => false),
  useAutoUpdateLearningState: vi.fn(() => mockState.autoUpdateLearningState),
}));

const card = {
  id: 'case-1',
  name: 'Aa',
  algorithm: "R U R'",
  subset: 'A',
  category: 'PLL',
  bestTime: null,
  ao5: null,
  learned: 1,
  manualLearned: 0,
  reviewCount: 6,
  smartReviewDueAt: null,
  smartReviewDue: true,
  smartReviewUrgency: 0,
};

describe('CaseCard', () => {
  beforeEach(() => {
    mockState.autoUpdateLearningState = false;
    mockState.selected = false;
    mockState.cycleCaseLearnedState.mockReset();
    mockState.onBeforeToggleCase.mockReset();
    mockState.toggleCaseSelection.mockReset();
  });

  it('marks the bookmark aria-disabled when auto learning state is enabled', async () => {
    const user = userEvent.setup();
    mockState.autoUpdateLearningState = true;

    render(<CaseCard card={card} index={0} />);

    const bookmark = screen.getByRole('button');
    expect(bookmark).toHaveAttribute('aria-disabled', 'true');
    expect(bookmark).toHaveAttribute('title', 'Learning status is managed automatically');

    await user.click(bookmark);
    expect(mockState.cycleCaseLearnedState).not.toHaveBeenCalled();
  });

  it('keeps manual bookmarking enabled when auto learning state is off', async () => {
    const user = userEvent.setup();

    render(<CaseCard card={card} index={0} />);

    const bookmark = screen.getByRole('button');
    expect(bookmark).toHaveAttribute('aria-disabled', 'false');

    await user.click(bookmark);
    expect(mockState.cycleCaseLearnedState).toHaveBeenCalledWith('case-1');
  });

  it('forwards checkbox selection changes to the case selection actions', async () => {
    const user = userEvent.setup();

    render(<CaseCard card={card} index={0} />);

    await user.click(screen.getByRole('checkbox'));

    expect(mockState.onBeforeToggleCase).toHaveBeenCalledTimes(1);
    expect(mockState.toggleCaseSelection).toHaveBeenCalledWith('case-1', true);
  });

  it('forwards checkbox deselection changes to the case selection actions', async () => {
    const user = userEvent.setup();
    mockState.selected = true;

    render(<CaseCard card={card} index={0} />);

    await user.click(screen.getByRole('checkbox'));

    expect(mockState.onBeforeToggleCase).toHaveBeenCalledTimes(1);
    expect(mockState.toggleCaseSelection).toHaveBeenCalledWith('case-1', false);
  });
});
