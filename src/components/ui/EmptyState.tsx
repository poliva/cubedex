import type { ReactNode } from 'react';

function DefaultIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="empty-state-icon-svg"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 5-6" />
    </svg>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  showIcon?: boolean;
  /** Tighter padding and type scale for inline panels. */
  compact?: boolean;
  className?: string;
  'data-testid'?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  showIcon = true,
  compact = false,
  className = '',
  'data-testid': dataTestId,
}: EmptyStateProps) {
  return (
    <div
      className={[
        'empty-state',
        compact ? 'empty-state--compact' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-testid={dataTestId}
    >
      {showIcon ? (
        <div className="empty-state-icon-wrap" aria-hidden>
          {icon ?? <DefaultIcon />}
        </div>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {description ? (
        <p className="empty-state-desc">{description}</p>
      ) : null}
      {action ? (
        <button type="button" className="empty-state-cta" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
