import { memo, type CSSProperties } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import { averageTimeString, bestTimeString } from '../lib/case-cards';
import { getStickeringForCategory } from '../lib/stickering';
import {
  BookClosedGreenIcon,
  BookClosedOrangeIcon,
  BookOpenIcon,
} from './Icons';
import { CaseCardPreview } from './CaseCardPreview';
import {
  stableActions,
  useAutoUpdateLearningState,
  useCaseCardSlice,
} from '../state/caseCardStore';

interface CaseCardProps {
  card: CaseCardData;
  index: number;
  style?: CSSProperties;
}

function CaseCardComponent({ card, index, style }: CaseCardProps) {
  const { practiceCount, failedCount, bestTime, ao5, selected } = useCaseCardSlice(card.id);
  const autoUpdateLearningState = useAutoUpdateLearningState();
  const successCount = Math.max(0, practiceCount - Math.min(failedCount, practiceCount));
  const isLL = card.category.toLowerCase().includes('ll');
  const visualization = isLL ? 'experimental-2D-LL' : '3D';
  const stickering = getStickeringForCategory(card.category, false);

  const background = failedCount
    ? 'rgba(239,68,68,0.12)'
    : index % 2 === 0
      ? 'var(--surface)'
      : 'var(--raised)';

  return (
    <div
      key={`${card.id}-${card.name}`}
      className="case-wrapper"
      id={card.id}
      data-name={card.name}
      data-algorithm={card.algorithm}
      data-category={card.category}
      data-subset={card.subset}
      style={{
        ...style,
        border: `4px solid ${selected ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
        background,
        boxShadow: '0 10px 24px oklch(0% 0 0 / 0.12)',
      }}
    >
      <div className="case-card-header">
        <div className="case-name" title={card.algorithm} style={{ fontWeight: 700, color: 'var(--fg)' }}>
          {card.name}
        </div>
        <button
          id={`bookmark-${card.id}`}
          data-value={card.learned}
          title={autoUpdateLearningState ? 'Learning status is managed automatically' : 'Learning status'}
          className="bookmark-button"
          type="button"
          aria-disabled={autoUpdateLearningState}
          aria-label={`Learning status for ${card.name}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--fg2)',
          }}
          onClick={() => {
            if (autoUpdateLearningState) {
              return;
            }
            stableActions.cycleCaseLearnedState(card.id);
          }}
        >
          <span aria-hidden="true">
            {card.learned === 2 ? (
              <BookClosedGreenIcon />
            ) : card.learned === 1 ? (
              <BookClosedOrangeIcon />
            ) : (
              <BookOpenIcon />
            )}
          </span>
        </button>
      </div>
      <label htmlFor={`case-toggle-${card.id}`} className="case-card-body" title={card.algorithm}>
        <div id={`best-time-${card.id}`} className="case-metric" style={{ color: 'var(--fg3)' }}>
          Best: {bestTimeString(bestTime)}
        </div>
        <div id={`ao5-time-${card.id}`} className="case-metric" style={{ color: 'var(--fg3)' }}>
          Ao5: {averageTimeString(ao5)}
        </div>
        <div id={`alg-case-${card.id}`} className="case-preview" style={{ marginTop: 6 }}>
          <div className="case-preview-inner" style={{ borderRadius: 12, background: 'transparent' }}>
            <CaseCardPreview
              alg={card.algorithm}
              visualization={visualization}
              stickering={stickering}
              setupAnchor="end"
            />
          </div>
        </div>
        <div className="case-toggle-row">
          <input
            type="checkbox"
            id={`case-toggle-${card.id}`}
            className="sr-only"
            checked={selected}
            onChange={(event) => {
              stableActions.onBeforeToggleCase();
              stableActions.toggleCaseSelection(card.id, event.target.checked);
            }}
          />
          <div className="toggle-track" />
          <div className="toggle-dot dot" />
          <div className="case-results">
            <div id={`${card.id}-failed`} className="failed-count" style={{ color: 'var(--danger)' }}>
              {failedCount > 0 ? `❌: ${failedCount}` : ''}
            </div>
            <div id={`${card.id}-success`} className="success-count" style={{ color: 'var(--ok)' }}>
              {practiceCount > 0 ? `✅: ${successCount}` : ''}
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}

export const CaseCard = memo(CaseCardComponent);
