export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x={1} y={1} width={12} height={12} rx={3} fill="var(--accent)" />
      <rect x={16} y={1} width={12} height={12} rx={3} fill="var(--accent)" opacity={0.6} />
      <rect x={1} y={16} width={12} height={12} rx={3} fill="var(--accent)" opacity={0.6} />
      <rect x={16} y={16} width={12} height={12} rx={3} fill="var(--accent)" opacity={0.25} />
    </svg>
  );
}
