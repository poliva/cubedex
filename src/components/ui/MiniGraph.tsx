import { useId } from 'react';

interface MiniGraphProps {
  times: number[];
  width?: number;
}

export function MiniGraph({ times, width = 180 }: MiniGraphProps) {
  const gradientId = useId();

  if (times.length < 2) {
    return null;
  }

  const height = 52;
  const pad = 4;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const range = max - min || 1;
  const points = times.map((time, index) => {
    const x = pad + (index / (times.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (time - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const lastX = width - pad;
  const lastY = pad + (1 - (times[times.length - 1] - min) / range) * (height - pad * 2);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${height} ${points} ${width - pad},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--accent)" />
    </svg>
  );
}
