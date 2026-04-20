import { memo } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';

export const NewAlgView = memo(function NewAlgView({
  visible,
  algorithmActions,
  onSave,
  onCancel,
}: {
  visible: boolean;
  algorithmActions: AlgorithmImportExportState;
  onSave: () => void;
  onCancel: () => void;
}) {
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
        <button
          id="confirm-save"
          className="save-panel-button"
          type="button"
          onClick={onSave}
        >
          Save
        </button>
        <button
          id="cancel-save"
          className="save-panel-button"
          type="button"
          onClick={onCancel}
        >
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
});
