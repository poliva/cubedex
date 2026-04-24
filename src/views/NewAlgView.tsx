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
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Algorithm input card */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <label style={labelStyle}>Algorithm</label>
          <input
            id="alg-input"
            type="text"
            placeholder="Enter alg e.g., (R U R' U) (R U2' R')"
            value={algInput}
            onChange={(e) => setAlgInput?.(e.target.value)}
            style={{
              ...inputStyle,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          />
          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg3)' }}>
            Type or use a connected smartcube to input moves.
          </p>
        </div>

        {/* Metadata card */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div>
            <label style={labelStyle}>Category</label>
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
            <label style={labelStyle}>
              Subset <span style={{ fontWeight: 400, color: 'var(--fg4)' }}>(optional)</span>
            </label>
            <input
              id="subset-input"
              type="text"
              placeholder="e.g. G, J, T…"
              value={algorithmActions.subsetInput}
              onChange={(e) => algorithmActions.setSubsetInput(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
