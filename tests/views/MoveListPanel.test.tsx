import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MoveListPanel } from '../../src/views/MoveListPanel';
import { trainingViewStore } from '../../src/state/trainingViewStore';

const noop = () => {};
const identityMask = (fn: (v: boolean) => boolean) => fn(false);

describe('MoveListPanel', () => {
  beforeEach(() => {
    trainingViewStore.setState({
      displayMoves: [],
      fixText: "U R'",
      fixVisible: true,
      helpTone: 'red',
    });
  });

  it('omits the fix strip when suppressFixErrorStrip is true', () => {
    render(
      <MoveListPanel
        darkMode={false}
        isMoveMasked={false}
        setIsMoveMasked={identityMask}
        onEditCurrentAlgorithm={noop}
        showMoves={false}
        showFix
        suppressFixErrorStrip
      />,
    );

    expect(document.getElementById('alg-fix')).toBeNull();
    expect(screen.queryByText("U R'")).not.toBeInTheDocument();
  });

  it('renders the fix strip when suppressFixErrorStrip is false', () => {
    render(
      <MoveListPanel
        darkMode={false}
        isMoveMasked={false}
        setIsMoveMasked={identityMask}
        onEditCurrentAlgorithm={noop}
        showMoves={false}
        showFix
        suppressFixErrorStrip={false}
      />,
    );

    expect(document.getElementById('alg-fix')).toBeInTheDocument();
    expect(screen.getByText("U R'")).toBeInTheDocument();
  });
});
