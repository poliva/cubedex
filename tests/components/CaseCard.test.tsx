import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCard } from '../../src/components/CaseCard';
import { useCaseCardSlice } from '../../src/state/caseCardStore';

const mockState = vi.hoisted(() => ({
  autoUpdateLearningState: false,
  cycleCaseLearnedState: vi.fn(),
  onBeforeToggleCase: vi.fn(),
  previewProps: null as null | Record<string, unknown>,
  selected: false,
  toggleCaseSelection: vi.fn(),
}));

vi.mock('../../src/components/CaseCardPreview', () => ({
  CaseCardPreview: (props: Record<string, unknown>) => {
    mockState.previewProps = props;
    return <div data-testid="case-card-preview" />;
  },
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
    selected: false,
  })),
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
    mockState.previewProps = null;
    mockState.selected = false;
    mockState.cycleCaseLearnedState.mockReset();
    mockState.onBeforeToggleCase.mockReset();
    mockState.toggleCaseSelection.mockReset();
    vi.mocked(useCaseCardSlice).mockReturnValue({
      practiceCount: 0,
      failedCount: 0,
      bestTime: null,
      ao5: null,
      selected: false,
    });
  });

  it('marks the bookmark aria-disabled when auto learning state is enabled', async () => {
    const user = userEvent.setup();
    mockState.autoUpdateLearningState = true;

    render(<CaseCard card={card} index={0} />);

    const bookmark = screen.getByRole('button');
    expect(bookmark).toHaveAttribute('aria-disabled', 'true');

    await user.click(bookmark);
    expect(mockState.cycleCaseLearnedState).not.toHaveBeenCalled();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
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
    vi.mocked(useCaseCardSlice).mockReturnValue({
      practiceCount: 0,
      failedCount: 0,
      bestTime: null,
      ao5: null,
      selected: true,
    });

    render(<CaseCard card={card} index={0} />);

    await user.click(screen.getByRole('checkbox'));

    expect(mockState.onBeforeToggleCase).toHaveBeenCalledTimes(1);
    expect(mockState.toggleCaseSelection).toHaveBeenCalledWith('case-1', false);
  });

  it('keeps category stickering for previews even when full-stickering is enabled elsewhere', () => {
    render(<CaseCard card={card} index={0} />);

    expect(mockState.previewProps).toMatchObject({
      alg: "R U R'",
      visualization: 'experimental-2D-LL',
      stickering: 'PLL',
      setupAnchor: 'end',
    });
  });

  it.each([
    ['2x2x2:CLL', '2x2x2', 'CLL', 'experimental-2D-LL'],
    ['2x2x2:PBL', '2x2x2', 'PBL', '3D'],
    ['4x4x4:OLL Parity', '4x4x4', 'OLL', 'experimental-2D-LL'],
    ['5x5x5:Last Two Centers', '5x5x5', 'L2C', '3D'],
    ['6x6x6:Parity', '6x6x6', 'full', '3D'],
    ['7x7x7:Parity', '7x7x7', 'full', '3D'],
    ['megaminx:EO', 'megaminx', 'EOLL', 'experimental-2D-LL'],
    ['fto:L3T', 'fto', 'experimental-fto-l3t', '3D'],
  ])('renders %s with its puzzle mask and supported thumbnail', (category, puzzle, stickering, visualization) => {
    render(<CaseCard card={{ ...card, category }} index={0} />);
    expect(mockState.previewProps).toMatchObject({ puzzle, stickering, visualization, setupAnchor: 'end' });
  });

  it.each([
    ['6x6x6:Parity', 'OLL Parity Inner', 'OLL'],
    ['6x6x6:Parity', 'PLL Parity', 'PLL'],
    ['7x7x7:Parity', 'OLL Parity Outer', 'OLL'],
  ])('masks %s case %s individually in 3D', (category, name, stickering) => {
    render(<CaseCard card={{ ...card, category, name }} index={0} />);
    expect(mockState.previewProps).toMatchObject({ stickering, visualization: '3D' });
  });

  it('shows success and fail counts independently (e.g. one stop then one full solve)', () => {
    vi.mocked(useCaseCardSlice).mockReturnValue({
      practiceCount: 1,
      failedCount: 1,
      bestTime: null,
      ao5: null,
      selected: false,
    });

    render(<CaseCard card={card} index={0} />);

    expect(screen.getByText('❌: 1')).toBeInTheDocument();
    expect(screen.getByText('✅: 1')).toBeInTheDocument();
  });
});
