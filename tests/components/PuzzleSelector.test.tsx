import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PuzzleSelector } from '../../src/components/PuzzleSelector';

describe('PuzzleSelector', () => {
  it('offers cubes and keyboard-only puzzles when disconnected', async () => {
    const onChange = vi.fn();
    render(<PuzzleSelector puzzle="3x3x3" connected={false} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Puzzle' }), 'megaminx');
    expect(onChange).toHaveBeenCalledWith('megaminx');
    for (const name of ['2×2', '3×3', '4×4', '5×5', 'Pyraminx', 'Megaminx']) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('option', { name: 'Square-1' })).not.toBeInTheDocument();
    expect(screen.getByText(/Use Space or tap/)).toBeInTheDocument();
  });

  it('locks the connected puzzle and explains how to change it', () => {
    render(<PuzzleSelector puzzle="2x2x2" connected onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toHaveValue('2x2x2');
    expect(screen.getByText(/Showing 2×2 alg sets/)).toHaveTextContent('Disconnect to choose another puzzle.');
  });
});
