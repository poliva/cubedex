import type { SmartcubeConnectionState } from '../../hooks/useSmartcubeConnection';
import { Icon, IC } from '../ui/Icon';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const SCREEN_TITLES: Record<NavView, string> = {
  practice: 'Practice',
  cases: 'Case Library',
  options: 'Options',
  help: 'Help',
  'new-alg': 'New Alg',
};

export function DesktopTopbar({
  screen,
  selectedCategory,
  selectedCount,
  smartcube,
}: {
  screen: NavView;
  selectedCategory: string;
  selectedCount: number;
  smartcube: SmartcubeConnectionState;
}) {
  return (
    <div style={{
      height: 50,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
      gap: 10,
    }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>
        {SCREEN_TITLES[screen]}
      </span>

      {(screen === 'practice' || screen === 'cases') && selectedCategory ? (
        <>
          <span style={{ color: 'var(--fg3)', fontSize: 13, fontFamily: 'var(--mono)' }}>
            {selectedCategory}
          </span>
          <span style={{ color: 'var(--fg3)', fontSize: 11 }}>·</span>
          <span style={{ color: 'var(--fg3)', fontSize: 13 }}>{selectedCount} selected</span>
        </>
      ) : null}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {smartcube.connected ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--ok)',
                boxShadow: '0 0 5px var(--ok)',
              }} />
              <span style={{ fontSize: 12, color: 'var(--ok)' }}>
                {smartcube.info.deviceName || 'Connected'}
              </span>
            </div>
            {smartcube.battery.level != null ? (
              <span style={{ fontSize: 12, color: 'var(--fg3)', fontFamily: 'var(--mono)' }}>
                {smartcube.battery.level}%
              </span>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          title="Connect Smartcube"
          onClick={() => void smartcube.connectOrDisconnect()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            border: '1.5px solid var(--border)',
            background: 'transparent',
            color: 'var(--fg2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={IC.bt} size={15} />
        </button>
      </div>
    </div>
  );
}
