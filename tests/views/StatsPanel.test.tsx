import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatsPanel } from '../../src/views/StatsPanel';

const baseStats = {
  best: '1.234',
  ao5: '1.567',
  average: '2.345',
  avgExec: '1.900',
  avgRecog: '0.445',
  averageTps: '8.50',
  singlePb: '1.234',
  practiceCount: 8,
  hasHistory: true,
  lastFive: [{ value: 1234, label: 'Time 8: 1.234', isPb: true }],
};

describe('StatsPanel', () => {
  it('renders the split time card with execution and recognition averages', () => {
    render(
      <StatsPanel
        visible
        showAlgName
        algName="Aa"
        stats={baseStats}
      />,
    );

    expect(screen.getByText('Average Time')).toBeInTheDocument();
    expect(screen.getByText('Exec')).toBeInTheDocument();
    expect(screen.getByText('1.900')).toBeInTheDocument();
    expect(screen.getByText('Recog')).toBeInTheDocument();
    expect(screen.getByText('0.445')).toBeInTheDocument();
  });

  it('shows the unified empty state and calls the case-library action', async () => {
    const user = userEvent.setup();
    const onOpenCaseLibrary = vi.fn();
    render(
      <StatsPanel
        visible
        showAlgName
        algName="Aa"
        onOpenCaseLibrary={onOpenCaseLibrary}
        stats={{ ...baseStats, hasHistory: false, lastFive: [] }}
      />,
    );

    expect(screen.getByTestId('stats-empty-state')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open case library/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open case library/i }));
    expect(onOpenCaseLibrary).toHaveBeenCalledTimes(1);
  });
});
