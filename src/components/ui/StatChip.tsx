interface StatChipProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export function StatChip({ label, value, highlight = false }: StatChipProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        padding: '7px 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--raised)',
        minWidth: 70,
        flex: '0 0 auto',
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--fg3)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          fontWeight: 600,
          color: highlight ? 'var(--accent)' : 'var(--fg)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
