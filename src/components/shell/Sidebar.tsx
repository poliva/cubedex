import { Icon, IC } from '../ui/Icon';
import { Logo } from './Logo';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const NAV_ITEMS: Array<{ id: NavView; icon: string | string[]; label: string }> = [
  { id: 'practice', icon: IC.practice, label: 'Practice' },
  { id: 'cases', icon: IC.cases, label: 'Cases' },
  { id: 'options', icon: IC.options, label: 'Options' },
  { id: 'help', icon: IC.help, label: 'Help' },
];

export function Sidebar({ active, onNav }: { active: NavView; onNav: (view: NavView) => void }) {
  return (
    <nav style={{
      width: 'var(--sidebar-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 12,
      gap: 2,
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{ marginBottom: 8 }}>
        <Logo size={30} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', alignItems: 'center' }}>
        {NAV_ITEMS.map((item) => (
          <NavBtn key={item.id} item={item} active={active === item.id} onNav={onNav} />
        ))}
        <div style={{ width: 28, height: 1, background: 'var(--border)', margin: '6px 8px' }} />
        <NavBtn item={{ id: 'new-alg', icon: IC.newAlg, label: 'New' }} active={active === 'new-alg'} onNav={onNav} />
      </div>
    </nav>
  );
}

function NavBtn({
  item,
  active,
  onNav,
}: {
  item: { id: NavView; icon: string | string[]; label: string };
  active: boolean;
  onNav: (view: NavView) => void;
}) {
  return (
    <button
      onClick={() => onNav(item.id)}
      title={item.label}
      type="button"
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--fg3)',
        transition: 'all 0.15s',
      }}
    >
      <Icon d={item.icon} size={17} />
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {item.label}
      </span>
    </button>
  );
}
