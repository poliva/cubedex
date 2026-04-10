export function BookOpenIcon() {
  return (
    <svg fill="none" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 7.5L14.5 12.5M14.5 7.5L9.5 12.5M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookClosedGreenIcon() {
  return (
    <svg fill="green" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 10.5L11 12.5L15.5 8M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function BookClosedOrangeIcon() {
  return (
    <svg fill="orange" className="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 13V7M9 10H15M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

export function BluetoothIcon() {
  return (
    <svg
      className="h-8 w-8 inline-block fill-current"
      fill="currentColor"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M 16 2 C 12.886719 2 10.03125 2.742188 8.03125 4.96875 C 6.03125 7.195313 5 10.714844 5 16 C 5 21.285156 6.03125 24.804688 8.03125 27.03125 C 10.03125 29.257813 12.886719 30 16 30 C 19.113281 30 21.972656 29.257813 23.96875 27.03125 C 25.964844 24.804688 27 21.285156 27 16 C 27 10.714844 25.964844 7.195313 23.96875 4.96875 C 21.972656 2.742188 19.113281 2 16 2 Z M 16 4 C 18.808594 4 20.945313 4.617188 22.46875 6.3125 C 23.992188 8.007813 25 10.980469 25 16 C 25 21.019531 23.992188 23.992188 22.46875 25.6875 C 20.945313 27.382813 18.808594 28 16 28 C 13.191406 28 11.054688 27.382813 9.53125 25.6875 C 8.007813 23.992188 7 21.019531 7 16 C 7 10.980469 8.007813 8.007813 9.53125 6.3125 C 11.054688 4.617188 13.191406 4 16 4 Z M 15 7 L 15 13.5625 L 12.71875 11.28125 L 11.28125 12.71875 L 14.5625 16 L 11.28125 19.28125 L 12.71875 20.71875 L 15 18.4375 L 15 25 L 16.59375 23.8125 L 20.59375 20.8125 L 21.53125 20.09375 L 17.4375 16 L 21.53125 11.90625 L 20.59375 11.1875 L 16.59375 8.1875 Z M 17 11 L 18.46875 12.09375 L 17 13.5625 Z M 17 18.4375 L 18.46875 19.90625 L 17 21 Z" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg fill="currentColor" className="h-6 w-6 inline-block" viewBox="-5.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.32 22.32c-5.6 0-9.92-5.56-10.12-5.8-0.24-0.32-0.24-0.72 0-1.040 0.2-0.24 4.52-5.8 10.12-5.8s9.92 5.56 10.12 5.8c0.24 0.32 0.24 0.72 0 1.040-0.2 0.24-4.56 5.8-10.12 5.8zM1.96 16c1.16 1.32 4.52 4.64 8.36 4.64s7.2-3.32 8.36-4.64c-1.16-1.32-4.52-4.64-8.36-4.64s-7.2 3.32-8.36 4.64zM10.32 20c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.84 4-4 4zM10.32 13.68c-1.28 0-2.32 1.040-2.32 2.32s1.040 2.32 2.32 2.32 2.32-1.040 2.32-2.32-1.040-2.32-2.32-2.32z"></path>
    </svg>
  );
}

export function EyeSlashIcon() {
  return (
    <svg fill="currentColor" className="h-6 w-6 inline-block" viewBox="-5.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.44 15.48c-0.12-0.16-2.28-2.92-5.48-4.56l0.92-3c0.12-0.44-0.12-0.92-0.56-1.040s-0.92 0.12-1.040 0.56l-0.88 2.8c-0.96-0.32-2-0.56-3.080-0.56-5.6 0-9.92 5.56-10.12 5.8-0.24 0.32-0.24 0.72 0 1.040 0.16 0.24 4.2 5.36 9.48 5.76l-0.56 1.8c-0.12 0.44 0.12 0.92 0.56 1.040 0.080 0.040 0.16 0.040 0.24 0.040 0.36 0 0.68-0.24 0.8-0.6l0.72-2.36c5-0.68 8.8-5.48 9-5.72 0.24-0.28 0.24-0.68 0-1zM1.96 16c1.16-1.32 4.52-4.64 8.36-4.64 0.88 0 1.76 0.2 2.6 0.48l-0.28 0.88c-0.68-0.48-1.48-0.72-2.32-0.72-2.2 0-4 1.8-4 4s1.8 4 4 4c0.040 0 0.040 0 0.080 0l-0.2 0.64c-3.8-0.080-7.080-3.36-8.24-4.64zM10.88 18.24c-0.2 0.040-0.4 0.080-0.6 0.080-1.28 0-2.32-1.040-2.32-2.32s1.040-2.32 2.32-2.32c0.68 0 1.32 0.32 1.76 0.8l-1.16 3.76zM12 20.44l2.4-7.88c1.96 1.080 3.52 2.64 4.24 3.44-0.96 1.12-3.52 3.68-6.64 4.44z"></path>
    </svg>
  );
}
