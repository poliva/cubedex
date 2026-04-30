import type { SmartcubeConnectionState } from '../../hooks/useSmartcubeConnection';
import { batteryLevelTextColor } from '../../lib/batteryLevelColor';
import { BluetoothIcon } from '../ui/Icon';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const SCREEN_TITLES: Record<NavView, string> = {
  practice: 'Practice',
  cases: 'Case Library',
  options: 'Options',
  help: 'Help',
  'new-alg': 'New Alg',
};

function HeaderBackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--raised)',
        color: 'var(--fg2)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

export function DesktopTopbar({
  screen,
  selectedCategory,
  selectedCount,
  smartcube,
  showResetGyro,
  showResetOrientation,
  onResetGyro,
  onResetOrientation,
  headerTitleOverride,
  onHeaderBack,
  headerBackLabel = 'Back',
}: {
  screen: NavView;
  selectedCategory: string;
  selectedCount: number;
  smartcube: SmartcubeConnectionState;
  showResetGyro: boolean;
  showResetOrientation: boolean;
  onResetGyro: () => void;
  onResetOrientation: () => void;
  headerTitleOverride?: string;
  onHeaderBack?: () => void;
  headerBackLabel?: string;
}) {
  const resetBtnStyle = {
    padding: '4px 10px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--raised)',
    color: 'var(--fg2)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  };

  const title = headerTitleOverride ?? SCREEN_TITLES[screen];

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
      {onHeaderBack ? <HeaderBackButton onClick={onHeaderBack} label={headerBackLabel} /> : null}
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>
        {title}
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

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {showResetGyro ? (
          <button type="button" onClick={onResetGyro} style={resetBtnStyle}>
            Reset Gyro
          </button>
        ) : null}
        {showResetOrientation ? (
          <button type="button" onClick={onResetOrientation} style={resetBtnStyle}>
            Reset Orientation
          </button>
        ) : null}

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
              <span style={{
                fontSize: 12,
                color: batteryLevelTextColor(smartcube.battery.level),
                fontFamily: 'var(--mono)',
              }}>
                {smartcube.battery.level}%
              </span>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          title={smartcube.connected ? 'Disconnect Smartcube' : 'Connect Smartcube'}
          onClick={() => void smartcube.connectOrDisconnect()}
          style={{
            height: 32,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <BluetoothIcon size={21} />
          <span>{smartcube.connectLabel}</span>
        </button>
      </div>
    </div>
  );
}
