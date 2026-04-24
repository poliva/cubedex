const ghIcon = 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z';
const coffeeIcon = 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3';

const links = [
  { href: 'https://github.com/poliva/cubedex', label: 'GitHub', icon: ghIcon, fill: true },
  { href: 'https://ko-fi.com/cubedex', label: 'Buy me a coffee', icon: coffeeIcon, fill: false },
];

export function Footer() {
  return (
    <footer style={{
      flexShrink: 0,
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, color: 'var(--fg3)', fontFamily: 'var(--mono)' }}>cubedex</span>
      <div style={{ flex: 1 }} />
      {links.map(({ href, label, icon, fill }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: 'var(--fg3)',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 600,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg3)')}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill={fill ? 'currentColor' : 'none'}
            stroke={fill ? 'none' : 'currentColor'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
          {label}
        </a>
      ))}
    </footer>
  );
}
