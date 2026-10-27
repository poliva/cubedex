import { PUZZLES, type PuzzleId } from '../lib/puzzles';
import { memo } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import { EmptyState } from '../components/ui/EmptyState';
import { expandNotation } from '../lib/storage';
import { algorithmDisplayTokens } from '../lib/square1';

const PRESET_CATEGORIES: Partial<Record<PuzzleId, string[]>> = {
  '3x3x3': ['PLL', 'OLL', 'F2L', 'Custom'],
  '2x2x2': ['OLL', 'PBL', 'CLL', 'Custom'],
  '4x4x4': ['OLL Parity', 'PLL Parity', 'Custom'],
  '5x5x5': ['Last Two Edges', 'Last Two Centers', 'Custom'],
  '6x6x6': ['Parity', 'Custom'],
  '7x7x7': ['Parity', 'Custom'],
  pyraminx: ['Last Layer', 'Custom'],
  megaminx: ['EO', 'CO', 'EP', 'CP', 'Custom'],
  skewb: ["Sarah's Beginner", "Sarah's Intermediate", "Sarah's Advanced", 'Custom'],
  fto: ['TCP', 'L6X', 'L3C', '1LP', 'Custom'],
  square1: ['Cube Shape', 'Parity'],
};

export const NewAlgView = memo(function NewAlgView({
  puzzle = '3x3x3',
  visible,
  algorithmActions,
  onSave,
  onCancel,
  standalone = false,
  isMobile = false,
  algInput = '',
  setAlgInput,
}: {
  puzzle?: PuzzleId;
  visible: boolean;
  algorithmActions: AlgorithmImportExportState;
  onSave: () => void;
  onCancel: () => void;
  standalone?: boolean;
  isMobile?: boolean;
  algInput?: string;
  setAlgInput?: (v: string) => void;
}) {
  if (!visible && standalone) return null;

  if (!standalone) {
    // Legacy inline use inside PracticeView
    return (
      <div id="save-container" className={`save-panel ${visible ? '' : 'hidden'}`.trim()}>
        <div id="save-wrapper" className="form-grid">
          <label htmlFor="category-input" className="form-label">Category:</label>
          <input
            id="category-input"
            type="text"
            placeholder="Category name"
            className="text-input"
            value={algorithmActions.categoryInput}
            onChange={(event) => algorithmActions.setCategoryInput(event.target.value)}
          />
          <label htmlFor="subset-input" className="form-label">Subset:</label>
          <input
            id="subset-input"
            type="text"
            placeholder="Subset name"
            className="text-input"
            value={algorithmActions.subsetInput}
            onChange={(event) => algorithmActions.setSubsetInput(event.target.value)}
          />
          <label htmlFor="alg-name-input" className="form-label">Name:</label>
          <input
            id="alg-name-input"
            type="text"
            placeholder="Case name"
            className="text-input"
            value={algorithmActions.algNameInput}
            onChange={(event) => algorithmActions.setAlgNameInput(event.target.value)}
          />
        </div>
        <div className="save-panel-actions">
          <button id="confirm-save" className="save-panel-button" type="button" onClick={onSave}>
            Save
          </button>
          <button id="cancel-save" className="save-panel-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div id="save-error" className={`${algorithmActions.saveError ? 'status-panel status-error' : 'hidden status-panel status-error'}`}>
          {algorithmActions.saveError}
        </div>
        <div id="save-success" className={`${algorithmActions.saveSuccess ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
          {algorithmActions.saveSuccess}
        </div>
      </div>
    );
  }

  // Standalone view (new design)
  const pad = isMobile ? 12 : 20;
  const pb = isMobile ? 'calc(var(--tab-h) + 12px)' : 16;
  const presetCategories = PRESET_CATEGORIES[puzzle] ?? ['Custom'];
  const expandedAlg = algInput.trim() ? expandNotation(algInput.trim(), puzzle) : '';
  const parsedMoves = algorithmDisplayTokens(expandedAlg);
  const algorithmExample = puzzle === 'megaminx' ? "e.g. R' BR' R BR R' F' R BR' R' BR F R"
    : puzzle === '6x6x6' || puzzle === '7x7x7' ? "e.g. 3Rw U2 3Rw' U2"
    : puzzle === '4x4x4' || puzzle === '5x5x5' ? "e.g. Rw U2 Rw' U2"
    : puzzle === 'fto' ? "e.g. R U R' U' r U r'"
    : puzzle === 'skewb' ? "e.g. R' L R L'"
    : puzzle === 'pyraminx' ? "e.g. R U R' U R U R'"
    : puzzle === 'square1' ? 'e.g. (1, 0) / (-1, -1) / (0, 1)'
    : "e.g. (R U R' U) (R U2 R')";
  const activeCategory = algorithmActions.categoryInput.trim();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--raised)',
    color: 'var(--fg)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--fg3)',
    marginBottom: 4,
    display: 'block',
  };

  const cardStyle: React.CSSProperties = {
    padding: isMobile ? '14px 16px' : '18px 20px',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 8px 24px oklch(0% 0 0 / 0.16)',
  };

  return (
    <div
      className="app-view-fade-in"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${isMobile ? 14 : 18}px ${pad}px`,
        paddingBottom: pb,
      }}
    >
        <div style={{ maxWidth: 760, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.15fr) minmax(280px, 0.85fr)', gap: 14 }}>

        <div style={cardStyle}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Algorithm Input</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)' }}>Build a new {PUZZLES[puzzle].name} case</div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5 }}>
              Type moves manually or use a connected smartcube. The raw algorithm is saved exactly as entered.
            </p>
          </div>

          <div style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--raised)',
            padding: '12px 14px',
            minHeight: 92,
          }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Move Preview</div>
            {parsedMoves.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {parsedMoves.map((move, index) => (
                  <span
                    key={`${move}-${index}`}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--fg)',
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {move}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                showIcon={false}
                title="No moves yet"
                description="Start typing an algorithm to preview the move tokens here."
              />
            )}
          </div>

          <div>
            <label htmlFor="alg-input" style={labelStyle}>Raw Algorithm</label>
            <textarea
              id="alg-input"
              placeholder={algorithmExample}
              value={algInput}
              onChange={(e) => setAlgInput?.(e.target.value)}
              rows={isMobile ? 4 : 5}
              style={{
                ...inputStyle,
                minHeight: isMobile ? 108 : 128,
                resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--fg3)' }}>
                Smartcube input appends moves into this field in real time.
              </p>
              <span style={{ fontSize: 11, color: 'var(--fg4)', fontFamily: 'var(--mono)' }}>
                {parsedMoves.length} move{parsedMoves.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Metadata</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>Describe the case</div>
          </div>

          <div>
            <label style={labelStyle}>Quick Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {presetCategories.map((category) => {
                const isActive = activeCategory.toLowerCase() === category.toLowerCase();
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => algorithmActions.setCategoryInput(category)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      background: isActive ? 'var(--accent-tint)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--fg2)',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="category-input" style={labelStyle}>Category</label>
            <input
              id="category-input"
              type="text"
              placeholder="Category name (e.g. PLL, OLL)"
              value={algorithmActions.categoryInput}
              onChange={(e) => algorithmActions.setCategoryInput(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="subset-input" style={labelStyle}>
              Subset
            </label>
            <input
              id="subset-input"
              type="text"
              placeholder="e.g. Dot Cases, Free Pairs, etc..."
              value={algorithmActions.subsetInput}
              onChange={(e) => algorithmActions.setSubsetInput(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="alg-name-input" style={labelStyle}>
              Name
            </label>
            <input
              id="alg-name-input"
              type="text"
              placeholder="e.g. T-Perm"
              value={algorithmActions.algNameInput}
              onChange={(e) => algorithmActions.setAlgNameInput(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--raised)',
            padding: '12px 14px',
            fontSize: 12,
            color: 'var(--fg3)',
            lineHeight: 1.5,
          }}>
            Saved to {PUZZLES[puzzle].name}. New categories and subsets are created automatically.
          </div>
        </div>

        {/* Messages */}
        {algorithmActions.saveError && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--danger)',
            fontSize: 12,
          }}>
            {algorithmActions.saveError}
          </div>
        )}
        {algorithmActions.saveSuccess && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(34,197,94,0.4)',
            background: 'rgba(34,197,94,0.08)',
            color: 'var(--ok)',
            fontSize: 12,
          }}>
            ✓ {algorithmActions.saveSuccess}
          </div>
        )}

        {/* Actions */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onSave}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(59,130,246,0.35)',
            }}
          >
            Save Algorithm
          </button>
          <button
            type="button"
            onClick={() => {
              algorithmActions.clearForm();
              algorithmActions.clearMessages();
              setAlgInput?.('');
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--raised)',
              color: 'var(--fg2)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg2)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});
