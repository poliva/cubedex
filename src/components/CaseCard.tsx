import { memo, type CSSProperties } from 'react';
import type { CaseCardData } from '../lib/legacy-algorithms';
import { averageTimeString, bestTimeString } from '../lib/legacy-algorithms';
import { getLegacyStickering } from '../lib/legacy-stickering';
import {
  BookClosedGreenIcon,
  BookClosedOrangeIcon,
  BookOpenIcon,
} from './Icons';
import { CaseCardPreview } from './CaseCardPreview';
import {
  stableActions,
  useCaseCardSlice,
  useFullStickering,
} from '../state/caseCardStore';

interface CaseCardProps {
  card: CaseCardData;
  index: number;
  style?: CSSProperties;
}

function CaseCardComponent({ card, index, style }: CaseCardProps) {
  const { practiceCount, failedCount, bestTime, ao5, selected } = useCaseCardSlice(card.id);
  const fullStickering = useFullStickering();
  const successCount = Math.max(0, practiceCount - Math.min(failedCount, practiceCount));
  const isLL = card.category.toLowerCase().includes('ll');
  const visualization = isLL ? 'experimental-2D-LL' : '3D';
  const stickering = getLegacyStickering(card.category, fullStickering);

  const wrapperClass = `case-wrapper ${
    failedCount
      ? 'bg-red-400 dark:bg-red-400'
      : index % 2 === 0
        ? 'case-alt-dark'
        : 'case-alt-light'
  }`;

  return (
    <div
      key={`${card.id}-${card.name}`}
      className={wrapperClass}
      id={card.id}
      data-name={card.name}
      data-algorithm={card.algorithm}
      data-category={card.category}
      data-subset={card.subset}
      style={style}
    >
      <div className="case-card-header">
        <div className="case-name" title={card.algorithm}>
          {card.name}
        </div>
        <button
          id={`bookmark-${card.id}`}
          data-value={card.learned}
          title="Learning status"
          className="bookmark-button"
          type="button"
          onClick={() => stableActions.cycleCaseLearnedState(card.id)}
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
        <div id={`best-time-${card.id}`} className="case-metric">
          Best: {bestTimeString(bestTime)}
        </div>
        <div id={`ao5-time-${card.id}`} className="case-metric">
          Ao5: {averageTimeString(ao5)}
        </div>
        <div id={`alg-case-${card.id}`} className="case-preview">
          <div className="case-preview-inner">
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
            <div id={`${card.id}-failed`} className="failed-count">
              {failedCount > 0 ? `❌: ${failedCount}` : ''}
            </div>
            <div id={`${card.id}-success`} className="success-count">
              {practiceCount > 0 ? `✅: ${successCount}` : ''}
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}

export const CaseCard = memo(CaseCardComponent);
