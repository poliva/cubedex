export const IC = {
  practice: 'M5 3l14 9-14 9V3z',
  cases: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  options: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  help: [
    'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  ],
  newAlg: 'M12 5v14M5 12h14',
  bt: 'M6.5 6.5l11 11M17.5 6.5l-11 11M12 3v18M5 9l7-6 7 6M5 15l7 6 7-6',
  play: 'M5 3l14 9-14 9V3z',
  stop: 'M6 6h12v12H6z',
  scatter: ['M21 3l-6.5 18-3.5-8-8-3.5L21 3z', 'M21 3L10 14'],
  mask: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
};

interface IconProps {
  d: string | string[];
  size?: number;
  strokeWidth?: number;
}

export function Icon({ d, size = 20, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  );
}
