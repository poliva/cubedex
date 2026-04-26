import { memo, useEffect, useRef, useState } from 'react';
import type { CaseLibraryState } from '../hooks/useCaseLibrary';
import type { TrainingState } from '../hooks/useTrainingState';
import type { ScrambleState } from '../hooks/useScrambleState';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import { CaseGrid } from './CaseGrid';

export const CasesView = memo(function CasesView({
  caseLibrary,
  training,
  scramble,
  smartcube,
  deleteMode,
  setDeleteMode,
  deleteSuccessMessage,
  handleDeleteAlgorithms,
  handleDeleteTimes,
  setAcknowledgedDisconnectToken,
  setMainCubeStickeringDeferred,
  isMobile,
  onPracticeSelected,
  onOpenOptions,
}: {
  caseLibrary: CaseLibraryState;
  training: TrainingState;
  scramble: ScrambleState;
  smartcube: SmartcubeConnectionState;
  deleteMode: boolean;
  setDeleteMode: (v: boolean) => void;
  deleteSuccessMessage: string;
  handleDeleteAlgorithms: () => void;
  handleDeleteTimes: () => void;
  setAcknowledgedDisconnectToken: (v: number) => void;
  setMainCubeStickeringDeferred: (v: boolean) => void;
  isMobile: boolean;
  onPracticeSelected: () => void;
  onOpenOptions?: () => void;
}) {
  const {
    categories,
    selectedCategory,
    subsets,
    selectedSubsets,
    caseCards,
    selectLearningCases,
    selectLearnedCases,
    setSelectedCategory,
    toggleSubset,
    toggleAllSubsets,
    setSelectLearningCases,
    setSelectLearnedCases,
    selectAllCases,
    setSelectAllCases,
  } = caseLibrary;

  const pad = isMobile ? 12 : 20;
  const pb = isMobile ? 'calc(var(--tab-h) + 16px)' : 16;

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [overflowOpen]);

  const filterChip = (
    label: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--fg3)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="app-view-fade-in"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${isMobile ? 14 : 18}px ${pad}px`,
        paddingBottom: pb,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header: scrollable category tabs + practice button + overflow menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div
            className="cases-category-strip"
            style={{
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingRight: 16,
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  setMainCubeStickeringDeferred(false);
                  setSelectedCategory(cat);
                  training.clearFailedCounts();
                  training.resetDrill();
                  scramble.clearScramble();
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid',
                  borderColor: selectedCategory === cat ? 'var(--accent)' : 'var(--border)',
                  background: selectedCategory === cat ? 'var(--accent-tint)' : 'transparent',
                  color: selectedCategory === cat ? 'var(--accent)' : 'var(--fg3)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* right-edge fade hints scrollability */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 24,
            pointerEvents: 'none',
            background: 'linear-gradient(to right, transparent, var(--bg))',
          }} />
        </div>
        {(() => {
          const hasSelection = caseLibrary.selectedCaseIds.length > 0;
          return (
            <button
              type="button"
              onClick={onPracticeSelected}
              disabled={!hasSelection}
              aria-disabled={!hasSelection}
              title={hasSelection ? undefined : 'Select at least one case to practice'}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: hasSelection ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                boxShadow: hasSelection ? '0 4px 10px rgba(59,130,246,0.35)' : 'none',
                opacity: hasSelection ? 1 : 0.45,
                transition: 'opacity 0.15s, box-shadow 0.15s',
                flexShrink: 0,
              }}
            >
              {isMobile ? 'Practice' : 'Practice Selected'}
            </button>
          );
        })()}

        {/* Overflow menu — Delete Mode + destructive actions tucked here. */}
        <div ref={overflowRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg2)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋯
          </button>
          {overflowOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                minWidth: 200,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
                padding: 6,
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: 13,
                  color: 'var(--fg)',
                }}
              >
                <span style={{
                  position: 'relative',
                  width: 30,
                  height: 17,
                  flexShrink: 0,
                  background: deleteMode ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 99,
                  transition: 'background 0.2s',
                  display: 'block',
                }}>
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    left: deleteMode ? 15 : 2,
                    width: 13,
                    height: 13,
                    background: '#fff',
                    borderRadius: '50%',
                    boxShadow: '0 1px 4px oklch(0% 0 0/0.3)',
                    transition: 'left 0.2s',
                  }} />
                  <input
                    type="checkbox"
                    checked={deleteMode}
                    onChange={(e) => setDeleteMode(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                </span>
                Delete Mode
              </label>
              <button
                type="button"
                role="menuitem"
                disabled={!deleteMode}
                onClick={() => {
                  handleDeleteAlgorithms();
                  setOverflowOpen(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: deleteMode ? 'var(--danger)' : 'var(--fg3)',
                  cursor: deleteMode ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                Delete Algorithms
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!deleteMode}
                onClick={() => {
                  handleDeleteTimes();
                  setOverflowOpen(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: deleteMode ? 'var(--danger)' : 'var(--fg3)',
                  cursor: deleteMode ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                Delete Times
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter row: All/Learning/Learned independent toggles. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          background: 'var(--raised)',
          borderRadius: 'var(--radius-sm)',
          padding: 2,
          gap: 1,
        }}>
          {filterChip('All', selectAllCases, () => {
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setMainCubeStickeringDeferred(false);
            setSelectAllCases(!selectAllCases);
          })}
          {filterChip('Learning', selectLearningCases, () => {
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setMainCubeStickeringDeferred(false);
            setSelectLearningCases(!selectLearningCases);
          })}
          {filterChip('Learned', selectLearnedCases, () => {
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setMainCubeStickeringDeferred(false);
            setSelectLearnedCases(!selectLearnedCases);
          })}
        </div>
      </div>

      {/* Subset chips — horizontally scrollable like the category strip */}
      {subsets.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10,
            color: 'var(--fg3)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            Subset
          </span>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div
              className="cases-category-strip"
              style={{
                display: 'flex',
                gap: 5,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                paddingRight: 16,
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                  toggleAllSubsets(selectedSubsets.length < subsets.length);
                  training.clearFailedCounts();
                  training.resetDrill();
                  scramble.clearScramble();
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid',
                  borderColor: selectedSubsets.length === subsets.length ? 'var(--accent)' : 'var(--border)',
                  background: selectedSubsets.length === subsets.length ? 'var(--accent-tint)' : 'transparent',
                  color: selectedSubsets.length === subsets.length ? 'var(--accent)' : 'var(--fg3)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                All
              </button>
              {subsets.map((subset) => (
                <button
                  key={subset}
                  type="button"
                  onClick={() => {
                    setAcknowledgedDisconnectToken(smartcube.disconnectToken);
                    toggleSubset(subset, !selectedSubsets.includes(subset));
                    training.clearFailedCounts();
                    training.resetDrill();
                    scramble.clearScramble();
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1.5px solid',
                    borderColor: selectedSubsets.includes(subset) ? 'var(--accent)' : 'var(--border)',
                    background: selectedSubsets.includes(subset) ? 'var(--accent-tint)' : 'transparent',
                    color: selectedSubsets.includes(subset) ? 'var(--accent)' : 'var(--fg3)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {subset}
                </button>
              ))}
            </div>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 24,
              pointerEvents: 'none',
              background: 'linear-gradient(to right, transparent, var(--bg))',
            }} />
          </div>
        </div>
      )}

      {/* Case grid */}
      <CaseGrid caseCards={caseCards} onOpenOptions={onOpenOptions} />

      {deleteSuccessMessage ? (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(34,197,94,0.4)',
          background: 'rgba(34,197,94,0.08)',
          color: 'var(--ok)',
          fontSize: 12,
        }}>
          {deleteSuccessMessage}
        </div>
      ) : null}
    </div>
  );
});
