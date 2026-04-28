export function BookOpenIcon() {
  return (
    <svg fill="none" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 7.5L14.5 12.5M14.5 7.5L9.5 12.5M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookClosedGreenIcon() {
  return (
    <svg fill="green" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 10.5L11 12.5L15.5 8M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookClosedOrangeIcon() {
  return (
    <svg fill="orange" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 13V7M9 10H15M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 32 32">
      <path d="M8 8h16v16H8z"/>
    </svg>
  );
}

export function AlgHelpInfoIcon() {
  const s = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeMiterlimit: 10,
    strokeWidth: 1.91,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        {...s}
        d="M18.68,1.48H5.32A3.82,3.82,0,0,0,1.5,5.3v9.54a3.82,3.82,0,0,0,3.82,3.82H9.14L12,21.52l2.86-2.86h3.82a3.82,3.82,0,0,0,3.82-3.82V5.3A3.82,3.82,0,0,0,18.68,1.48Z"
      />
      <line {...s} x1="10.09" y1="13.89" x2="13.91" y2="13.89" />
      <polyline {...s} points="10.09 8.16 12 8.16 12 13.89" />
      <line {...s} x1="11.05" y1="5.3" x2="12.95" y2="5.3" />
    </svg>
  );
}

export function ScatterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M3 21L12 12M12.2 6.2L11 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

