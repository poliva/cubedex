import type { SmartcubeConnectionState } from '../../hooks/useSmartcubeConnection';
import { Icon, IC } from '../ui/Icon';
import { Logo } from './Logo';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const SCREEN_TITLES: Record<NavView, string> = {
  practice: 'Practice',
  cases: 'Cases',
  options: 'Options',
  help: 'Help',
  'new-alg': 'New Alg',
};

export function MobileTopbar({
  screen,
  smartcube,
}: {
  screen: NavView;
  smartcube: SmartcubeConnectionState;
}) {
  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
      gap: 10,
    }}>
      <Logo size={24} />
      <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: 'var(--fg)' }}>
        {SCREEN_TITLES[screen]}
      </span>

      {screen === 'practice' && smartcube.connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--ok)',
            boxShadow: '0 0 5px var(--ok)',
          }} />
          <span style={{ fontSize: 11, color: 'var(--ok)', fontFamily: 'var(--mono)' }}>
            {smartcube.info.deviceName || 'Connected'}
          </span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void smartcube.connectOrDisconnect()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1.5px solid var(--border)',
          background: 'transparent',
          color: 'var(--fg2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon d={IC.bt} size={16} />
      </button>
    </div>
  );
}
