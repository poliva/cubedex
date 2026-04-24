import { Icon, IC } from '../ui/Icon';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const ITEMS: Array<{ id: NavView; icon: string | string[]; label: string }> = [
  { id: 'practice', icon: IC.practice, label: 'Practice' },
  { id: 'cases', icon: IC.cases, label: 'Cases' },
  { id: 'options', icon: IC.options, label: 'Options' },
  { id: 'help', icon: IC.help, label: 'Help' },
  { id: 'new-alg', icon: IC.newAlg, label: 'New' },
];

export function BottomTabBar({ active, onNav }: { active: NavView; onNav: (view: NavView) => void }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'var(--tab-h)',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      zIndex: 100,
    }}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onNav(item.id)}
          type="button"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: active === item.id ? 'var(--accent)' : 'var(--fg3)',
            transition: 'color 0.15s',
          }}
        >
          <Icon d={item.icon} size={20} />
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'inherit',
          }}>
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
