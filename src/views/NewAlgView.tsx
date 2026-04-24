import { memo } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';

export const NewAlgView = memo(function NewAlgView({
  visible,
  algorithmActions,
  onSave,
  onCancel,
  standalone = false,
  isMobile = false,
  algInput = '',
  setAlgInput,
}: {
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
  const presetCategories = ['PLL', 'OLL', 'F2L', 'Custom'] as const;
  const parsedMoves = algInput.trim() ? algInput.trim().split(/\s+/).filter(Boolean) : [];
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
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: `${isMobile ? 14 : 18}px ${pad}px`,
      paddingBottom: pb,
    }}>
      {!isMobile && (
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--fg)' }}>New Alg</h2>
      )}
      <div style={{ maxWidth: 760, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.15fr) minmax(280px, 0.85fr)', gap: 14 }}>

        <div style={cardStyle}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Algorithm Input</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)' }}>Build a new case</div>
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
                      background: index === parsedMoves.length - 1 ? 'rgba(59,130,246,0.12)' : 'var(--surface)',
                      color: index === parsedMoves.length - 1 ? 'var(--accent)' : 'var(--fg)',
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
              <div style={{ fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5 }}>
                No moves yet. Start typing an algorithm to preview the move tokens here.
              </div>
            )}
          </div>

          <div>
            <label htmlFor="alg-input" style={labelStyle}>Raw Algorithm</label>
            <textarea
              id="alg-input"
              placeholder="Enter alg e.g., (R U R' U) (R U2' R')"
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
                      background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
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
              Subset <span style={{ fontWeight: 400, color: 'var(--fg4)' }}>(optional)</span>
            </label>
            <input
              id="subset-input"
              type="text"
              placeholder="e.g. G, J, T..."
              value={algorithmActions.subsetInput}
              onChange={(e) => algorithmActions.setSubsetInput(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="alg-name-input" style={labelStyle}>
              Name <span style={{ fontWeight: 400, color: 'var(--fg4)' }}>(optional)</span>
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
            Save tip: if the category does not already exist, Cubedex will create it and switch Practice/Cases to that category after saving.
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
