import type { LegacyManagementState } from '../hooks/useLegacyManagement';
import type { TrainingState } from '../hooks/useTrainingState';

export function NewAlgView({
  visible,
  management,
  training,
  onSave,
  onCancel,
}: {
  visible: boolean;
  management: LegacyManagementState;
  training: TrainingState;
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
          value={management.categoryInput}
          onChange={(event) => management.setCategoryInput(event.target.value)}
        />
        <label htmlFor="subset-input" className="form-label">Subset:</label>
        <input
          id="subset-input"
          type="text"
          placeholder="Subset name"
          className="text-input"
          value={management.subsetInput}
          onChange={(event) => management.setSubsetInput(event.target.value)}
        />
        <label htmlFor="alg-name-input" className="form-label">Name:</label>
        <input
          id="alg-name-input"
          type="text"
          placeholder="Case name"
          className="text-input"
          value={management.algNameInput}
          onChange={(event) => management.setAlgNameInput(event.target.value)}
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
      <div id="save-error" className={`${management.saveError ? 'status-panel status-error' : 'hidden status-panel status-error'}`}>
        {management.saveError}
      </div>
      <div id="save-success" className={`${management.saveSuccess ? 'status-panel status-success' : 'hidden status-panel status-success'}`}>
        {management.saveSuccess}
      </div>
      {/* Keep `training` referenced to preserve identical behavior expectations (input mode lives in App). */}
      <span className="hidden" aria-hidden>{training.inputMode ? '' : ''}</span>
    </div>
  );
}
