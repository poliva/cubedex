import { useRef, useState } from 'react';
import { useAutoUpdateLearningState } from '../state/caseCardStore';
import { BookClosedGreenIcon, BookClosedOrangeIcon, BookOpenIcon } from './Icons';

export function BookmarkButton({
  learnedState,
  onCycle,
  ariaLabel = 'Learning status',
}: {
  learnedState: 0 | 1 | 2;
  onCycle: () => void;
  ariaLabel?: string;
}) {
  const autoUpdateLearningState = useAutoUpdateLearningState();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    if (autoUpdateLearningState) {
      setTooltipVisible(true);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(() => setTooltipVisible(false), 3500);
      return;
    }
    onCycle();
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        className="bookmark-button"
        aria-label={ariaLabel}
        aria-disabled={autoUpdateLearningState}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: 'var(--fg2)',
          cursor: autoUpdateLearningState ? 'default' : 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleClick}
      >
        <span aria-hidden="true">
          {learnedState === 2 ? (
            <BookClosedGreenIcon />
          ) : learnedState === 1 ? (
            <BookClosedOrangeIcon />
          ) : (
            <BookOpenIcon />
          )}
        </span>
      </button>
      {tooltipVisible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            background: 'var(--raised)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: '0.8rem',
            fontWeight: 400,
            color: 'var(--fg2)',
            whiteSpace: 'normal',
            zIndex: 100,
            boxShadow: '0 4px 12px oklch(0% 0 0 / 0.2)',
            maxWidth: 240,
            textAlign: 'left',
          }}
        >
          Learning status is managed automatically. Disable "Auto-update Learning State" in options to set it manually.
        </div>
      )}
    </div>
  );
}
