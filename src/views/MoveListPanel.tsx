import { memo, type CSSProperties } from 'react';
import { EyeIcon, EyeSlashIcon } from '../components/Icons';
import { useMoveListSlice } from '../state/trainingViewStore';

function MoveListPanelComponent({
  darkMode,
  isMoveMasked,
  setIsMoveMasked,
  onEditCurrentAlgorithm,
  className,
  showMoves = true,
  showFix = false,
  inlineStyle = false,
}: {
  darkMode: boolean;
  isMoveMasked: boolean;
  setIsMoveMasked: (updater: (value: boolean) => boolean) => void;
  onEditCurrentAlgorithm: () => void;
  className?: string;
  showMoves?: boolean;
  showFix?: boolean;
  inlineStyle?: boolean;
}) {
  const { displayMoves, fixText, fixVisible } = useMoveListSlice();
  return (
    <>
      {showMoves ? (
        <div id="alg-display-container" className={`alg-display-container ${className ?? ''}`.trim()}
          style={inlineStyle ? { display: 'contents' } : undefined}>
          {!inlineStyle && (
            <div className="alg-display-mask-row">
              <a
                href="#"
                id="toggle-move-mask"
                className="mask-toggle-button"
                style={{ backgroundColor: isMoveMasked ? '#f97316' : '#3b82f6' }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsMoveMasked((value) => !value);
                }}
              >
                {isMoveMasked ? <><EyeSlashIcon /> Unmask alg</> : <><EyeIcon /> Mask alg</>}
              </a>
            </div>
          )}
          <div id="alg-display" className="alg-display" onClick={onEditCurrentAlgorithm}>
            <div className="alg-display-moves">
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

      {showFix ? (
        <div id="alg-fix" className={`${fixVisible && fixText ? 'status-panel status-error' : 'hidden status-panel status-error'}`}>
          {fixText}
        </div>
      ) : null}
    </>
  );
}

export const MoveListPanel = memo(MoveListPanelComponent);

