import { PUZZLES, puzzleIds, type PuzzleId } from '../lib/puzzles';

export function PuzzleSelector({ puzzle, connected, onChange }: {
  puzzle: PuzzleId;
  connected: boolean;
  onChange: (puzzle: PuzzleId) => void;
}) {
  return (
    <div className="puzzle-selector">
      <div className="puzzle-selector-control">
        <label htmlFor="practice-puzzle">Puzzle</label>
        <select id="practice-puzzle" value={puzzle} disabled={connected}
          aria-describedby="puzzle-mode-hint"
          onChange={(event) => onChange(event.target.value as PuzzleId)}>
          {puzzleIds.map((id) => <option key={id} value={id}>{PUZZLES[id].name}</option>)}
        </select>
        <span className={`puzzle-mode-badge ${connected ? 'is-connected' : ''}`}>
          <span aria-hidden="true">{connected ? '●' : '⌨'}</span>
          {connected ? 'Smartcube' : 'Keyboard / touch'}
        </span>
      </div>
      <p id="puzzle-mode-hint">
        {connected
          ? `Showing ${PUZZLES[puzzle].name} alg sets for your connected cube. Disconnect to choose another puzzle.`
          : 'Choose your puzzle, then pick cases to practice. Use Space or tap the timer to time your solves.'}
      </p>
    </div>
  );
}
