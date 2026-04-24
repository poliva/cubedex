import { memo } from 'react';
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
    selectVisibleCases,
    clearSelectedCases,
    setSelectLearningCases,
    setSelectLearnedCases,
  } = caseLibrary;

  const pad = isMobile ? 12 : 20;
  const pb = isMobile ? 'calc(var(--tab-h) + 16px)' : 16;

  const sectionStyle = {
    borderRadius: 8,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  } as const;

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
    padding: '0 14px',
    minHeight: 44,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: `${isMobile ? 14 : 18}px ${pad}px`,
      paddingBottom: pb,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header: category pills + practice button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {!isMobile && (
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0, marginRight: 4, color: 'var(--fg)' }}>
            Case Library
          </h2>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                borderRadius: 8,
                border: '1.5px solid',
                borderColor: selectedCategory === cat ? 'var(--accent)' : 'var(--border)',
                background: selectedCategory === cat ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: selectedCategory === cat ? 'var(--accent)' : 'var(--fg3)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isMobile && (
            <span style={{ fontSize: 12, color: 'var(--fg3)' }}>
              {caseLibrary.selectedCaseIds.length} selected
            </span>
          )}
          <button
            type="button"
            onClick={onPracticeSelected}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 10px rgba(59,130,246,0.35)',
            }}
          >
            {isMobile ? 'Practice' : 'Practice Selected'}
          </button>
        </div>
      </div>

      {/* Filter + Select All row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          background: 'var(--raised)',
          borderRadius: 8,
          padding: 2,
          gap: 1,
        }}>
          {([
            ['all', 'All', () => {
              setAcknowledgedDisconnectToken(smartcube.disconnectToken);
              clearSelectedCases();
            }],
            ['learning', 'Learning', () => {
              setAcknowledgedDisconnectToken(smartcube.disconnectToken);
              setMainCubeStickeringDeferred(false);
              setSelectLearningCases(true);
            }],
            ['learned', 'Learned', () => {
              setAcknowledgedDisconnectToken(smartcube.disconnectToken);
              setMainCubeStickeringDeferred(false);
              setSelectLearnedCases(true);
            }],
          ] as const).map(([val, label, handler]) => {
            const isActive = val === 'learning' ? selectLearningCases
              : val === 'learned' ? selectLearnedCases
              : !selectLearningCases && !selectLearnedCases;
            return (
              <button
                key={val}
                type="button"
                onClick={() => handler()}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--fg3)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setAcknowledgedDisconnectToken(smartcube.disconnectToken);
            setMainCubeStickeringDeferred(false);
            selectVisibleCases();
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--fg3)',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Select All
        </button>

        {caseLibrary.selectedCaseIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAcknowledgedDisconnectToken(smartcube.disconnectToken);
              clearSelectedCases();
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg3)',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Deselect All
          </button>
        )}
      </div>

      {/* Subset chips */}
      {subsets.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 10,
            color: 'var(--fg3)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 2,
          }}>
            Subset
          </span>
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
              borderRadius: 99,
              border: '1.5px solid',
              borderColor: selectedSubsets.length === subsets.length ? 'var(--accent)' : 'var(--border)',
              background: selectedSubsets.length === subsets.length ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: selectedSubsets.length === subsets.length ? 'var(--accent)' : 'var(--fg3)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
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
                borderRadius: 99,
                border: '1.5px solid',
                borderColor: selectedSubsets.includes(subset) ? 'var(--accent)' : 'var(--border)',
                background: selectedSubsets.includes(subset) ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: selectedSubsets.includes(subset) ? 'var(--accent)' : 'var(--fg3)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {subset}
            </button>
          ))}
        </div>
      )}

      {/* Case grid */}
      <CaseGrid caseCards={caseCards} />

      {/* Delete zone */}
      <div style={{ ...sectionStyle, border: '1px solid var(--border)' }}>
        <div style={{ ...rowStyle, borderBottom: 'none', gap: 12 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            userSelect: 'none',
            minHeight: 44,
          }}>
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
            <span style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.3 }}>Delete Mode</span>
          </label>

          <button
            type="button"
            disabled={!deleteMode}
            onClick={handleDeleteAlgorithms}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: deleteMode ? 'var(--fg)' : 'var(--fg3)',
              fontFamily: 'inherit',
              fontSize: 12,
              cursor: deleteMode ? 'pointer' : 'not-allowed',
            }}
          >
            Delete Alg
          </button>
          <button
            type="button"
            disabled={!deleteMode}
            onClick={handleDeleteTimes}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: deleteMode ? 'var(--fg)' : 'var(--fg3)',
              fontFamily: 'inherit',
              fontSize: 12,
              cursor: deleteMode ? 'pointer' : 'not-allowed',
            }}
          >
            Delete Times
          </button>
        </div>
      </div>

      {deleteSuccessMessage ? (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
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
