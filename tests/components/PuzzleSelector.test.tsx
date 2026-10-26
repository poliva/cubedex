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
    for (const name of ['2×2', '3×3', '4×4', '5×5', '6×6', '7×7', 'Pyraminx', 'Megaminx', 'Skewb', 'FTO']) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('option', { name: 'Square-1' })).not.toBeInTheDocument();
    expect(screen.getByText(/Use Space or tap/)).toBeInTheDocument();
  });

  it('hides on connection and reappears on disconnection', () => {
    const onChange = vi.fn();
    const { rerender, container } = render(<PuzzleSelector puzzle="2x2x2" connected={false} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toBeEnabled();

    rerender(<PuzzleSelector puzzle="2x2x2" connected onChange={onChange} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<PuzzleSelector puzzle="2x2x2" connected={false} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Puzzle' })).toHaveValue('2x2x2');
  });
});
