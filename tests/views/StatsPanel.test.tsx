import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsPanel } from '../../src/views/StatsPanel';

describe('StatsPanel', () => {
  it('renders the split time card with execution and recognition averages', () => {
    render(
      <StatsPanel
        visible
        showAlgName
        algName="Aa"
        stats={{
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
        }}
      />,
    );

    expect(screen.getByText('Avgerage Time')).toBeInTheDocument();
    expect(screen.getByText('Exec')).toBeInTheDocument();
    expect(screen.getByText('1.900')).toBeInTheDocument();
    expect(screen.getByText('Recog')).toBeInTheDocument();
    expect(screen.getByText('0.445')).toBeInTheDocument();
    expect(screen.getByText(/1\.234/)).toBeInTheDocument();
  });
});
