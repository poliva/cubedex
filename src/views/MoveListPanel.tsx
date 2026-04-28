import { memo, type CSSProperties } from 'react';
import { EyeIcon, EyeSlashIcon } from '../components/ui/Icon';
import { useMoveListSlice } from '../state/trainingViewStore';

function MoveListPanelComponent({
  darkMode,
  isMoveMasked,
  setIsMoveMasked,
  onEditCurrentAlgorithm,
  className,
  showMoves = true,
  showFix = false,
  suppressFixErrorStrip = false,
  inlineStyle = false,
  variant = 'default',
}: {
  darkMode: boolean;
  isMoveMasked: boolean;
  setIsMoveMasked: (updater: (value: boolean) => boolean) => void;
  onEditCurrentAlgorithm: () => void;
  className?: string;
  showMoves?: boolean;
  showFix?: boolean;
  /** When true, the red fix strip is not rendered (e.g. merged into PracticeView status bar). */
  suppressFixErrorStrip?: boolean;
  inlineStyle?: boolean;
  variant?: 'default' | 'algTrack';
}) {
  const { displayMoves, fixText, fixVisible } = useMoveListSlice();
  const isAlgTrack = variant === 'algTrack';
  return (
    <>
      {showMoves ? (
        <div
          id="alg-display-container"
          className={
            isAlgTrack
              ? `alg-display-container alg-display-container--embed ${className ?? ''}`.trim()
              : `alg-display-container ${className ?? ''}`.trim()
          }
          style={
            isAlgTrack
              ? undefined
              : inlineStyle
                ? { display: 'contents' }
                : {
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  padding: '10px 12px',
                }
          }
        >
          {!inlineStyle && !isAlgTrack && (
            <div className="alg-display-mask-row" style={{ marginBottom: 8 }}>
              <button
                id="toggle-move-mask"
                className="mask-toggle-button"
                type="button"
                style={{
                  backgroundColor: isMoveMasked ? '#f97316' : 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsMoveMasked((value) => !value);
                }}
              >
                {isMoveMasked ? <><EyeSlashIcon size={24} /> Unmask alg</> : <><EyeIcon size={24} /> Mask alg</>}
              </button>
            </div>
          )}
          <div
            id="alg-display"
            className={isAlgTrack ? 'alg-display alg-display--embed' : 'alg-display'}
            onClick={onEditCurrentAlgorithm}
            style={
              isAlgTrack
                ? { minWidth: 0, cursor: 'pointer' }
                : inlineStyle
                  ? { minWidth: 0, cursor: 'pointer' }
                  : {
                    borderRadius: 10,
                    background: 'var(--raised)',
                    padding: '10px 12px',
                    minHeight: 48,
                    cursor: 'pointer',
                  }
            }
          >
            <div className="alg-display-moves" style={{ color: darkMode ? '#fff' : 'var(--fg)' }}>
              {displayMoves.map((move, index) => {
                const color = move.color === 'green'
                  ? 'green'
                  : move.color === 'red'
                    ? 'red'
                    : move.color === 'blue'
                      ? 'blue'
                      : move.color === 'next'
                        ? 'white'
                        : darkMode
                          ? 'white'
                          : 'black';

                return (
                  <span key={`${move.token}-${index}`}>
                    {move.prefix ? <span style={{ color: darkMode ? 'white' : 'black' }}>{move.prefix}</span> : null}
                    {move.circle ? (
                      <span className="circle">
                        <span
                          className="move"
                          style={{ color, WebkitTextSecurity: isMoveMasked ? 'disc' : 'none' } as CSSProperties}
                        >
                          {move.token}
                        </span>
                      </span>
                    ) : (
                      <span
                        className="move"
                        style={{ color, WebkitTextSecurity: isMoveMasked ? 'disc' : 'none' } as CSSProperties}
                      >
                        {move.token}
                      </span>
                    )}
                    {move.suffix ? <span style={{ color: darkMode ? 'white' : 'black' }}>{move.suffix}</span> : null}{' '}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showFix && !suppressFixErrorStrip ? (
        <div
          id="alg-fix"
          className={fixVisible && fixText ? 'status-panel status-error' : 'hidden'}
          style={fixVisible && fixText ? {
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--danger)',
            padding: '9px 12px',
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 'clamp(1.0625rem, 2.5vw, 1.1875rem)',
            lineHeight: 1.35,
          } : undefined}
        >
          {fixText}
        </div>
      ) : null}
    </>
  );
}

export const MoveListPanel = memo(MoveListPanelComponent);

