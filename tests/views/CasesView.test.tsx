import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CasesView } from '../../src/views/CasesView';

vi.mock('../../src/views/CaseGrid', () => ({
  CaseGrid: ({ caseCards }: { caseCards: Array<{ name: string }> }) => (
    <div data-testid="case-grid">{caseCards.map((card) => card.name).join(', ')}</div>
  ),
}));

function makeProps(overrides: Record<string, unknown> = {}) {
  const caseLibrary = {
    isReady: true,
    savedAlgorithms: {},
    categories: ['PLL', 'OLL'],
    selectedCategory: 'PLL',
    subsets: ['A', 'B'],
    selectedSubsets: ['A'],
    caseCards: [
      {
        id: 'case-1',
        name: 'Aa',
        algorithm: "R U R'",
        subset: 'A',
        category: 'PLL',
        bestTime: null,
        ao5: null,
        learned: 1,
        manualLearned: 0,
        reviewCount: 0,
        smartReviewDueAt: null,
        smartReviewDue: true,
        smartReviewUrgency: 0,
      },
    ],
    selectedCaseIds: ['case-1'],
    selectionChangeMode: 'bulk',
    selectAllCases: false,
    selectLearningCases: false,
    selectLearnedCases: false,
    setSelectedCategory: vi.fn(),
    toggleSubset: vi.fn(),
    toggleAllSubsets: vi.fn(),
    toggleCaseSelection: vi.fn(),
    selectVisibleCases: vi.fn(),
    clearSelectedCases: vi.fn(),
    setSelectAllCases: vi.fn(),
    setSelectLearningCases: vi.fn(),
    setSelectLearnedCases: vi.fn(),
    cycleCaseLearnedState: vi.fn(),
    reloadSavedAlgorithms: vi.fn(),
  };

  return {
    caseLibrary,
    training: {
      clearFailedCounts: vi.fn(),
      resetDrill: vi.fn(),
    },
    scramble: {
      clearScramble: vi.fn(),
    },
    smartcube: {
      disconnectToken: 4,
    },
    deleteMode: false,
    setDeleteMode: vi.fn(),
    deleteSuccessMessage: '',
    handleDeleteAlgorithms: vi.fn(),
    handleDeleteTimes: vi.fn(),
    setAcknowledgedDisconnectToken: vi.fn(),
    setMainCubeStickeringDeferred: vi.fn(),
    isMobile: false,
    onPracticeSelected: vi.fn(),
    ...overrides,
  } as any;
}

describe('CasesView', () => {
  it('renders the moved case-selection controls and practice CTA', () => {
    render(<CasesView {...makeProps()} />);

    expect(screen.getByRole('button', { name: 'PLL' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'OLL' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Learning' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Learned' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'A' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Practice Selected' })).toBeVisible();
    expect(screen.getByTestId('case-grid')).toHaveTextContent('Aa');
  });

  it('selects the currently visible cases without resetting the active learning filter', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      caseLibrary: {
        ...makeProps().caseLibrary,
        selectLearningCases: true,
      },
    });

    render(<CasesView {...props} />);

    await user.click(screen.getByRole('button', { name: 'Select All' }));

    expect(props.caseLibrary.selectVisibleCases).toHaveBeenCalledTimes(1);
    expect(props.caseLibrary.setSelectAllCases).not.toHaveBeenCalled();
  });

  it('clears selection through the dedicated clear action', async () => {
    const user = userEvent.setup();
    const props = makeProps();

    render(<CasesView {...props} />);

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));

    expect(props.caseLibrary.clearSelectedCases).toHaveBeenCalledTimes(1);
  });
});
