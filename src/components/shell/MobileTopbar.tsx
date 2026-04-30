import type { SmartcubeConnectionState } from '../../hooks/useSmartcubeConnection';
import { batteryLevelTextColor } from '../../lib/batteryLevelColor';
import { BluetoothIcon } from '../ui/Icon';
import { Logo } from './Logo';

type NavView = 'practice' | 'cases' | 'options' | 'help' | 'new-alg';

const SCREEN_TITLES: Record<NavView, string> = {
  practice: 'Practice',
  cases: 'Cases',
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
        width: 36,
        height: 36,
        borderRadius: 10,
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

export function MobileTopbar({
  screen,
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
  smartcube: SmartcubeConnectionState;
  showResetGyro: boolean;
  showResetOrientation: boolean;
  onResetGyro: () => void;
  onResetOrientation: () => void;
  /** When set with `onHeaderBack`, replaces the default screen title (e.g. options drill-down). */
  headerTitleOverride?: string;
  onHeaderBack?: () => void;
  headerBackLabel?: string;
}) {
  const title = headerTitleOverride ?? SCREEN_TITLES[screen];

  const statusText = smartcube.connecting
    ? 'Connecting'
    : smartcube.connected
      ? (smartcube.info.deviceName || 'Connected')
      : 'Bluetooth';
  const statusColor = smartcube.connected ? 'var(--ok)' : smartcube.connecting ? 'var(--accent)' : 'var(--fg3)';

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
      {onHeaderBack ? <HeaderBackButton onClick={onHeaderBack} label={headerBackLabel} /> : null}
      <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: 'var(--fg)', minWidth: 0 }}>
        {title}
      </span>

      {(smartcube.connected || smartcube.connecting) ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: screen === 'practice' ? 110 : 90,
          padding: '4px 8px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--raised)',
        }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 5px ${statusColor}`,
          }} />
          <span style={{
            fontSize: 11,
            color: statusColor,
            fontFamily: 'var(--mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {statusText}
          </span>
          {smartcube.connected && smartcube.battery.level != null ? (
            <span style={{
              fontSize: 10,
              color: batteryLevelTextColor(smartcube.battery.level),
              fontFamily: 'var(--mono)',
            }}>
              {smartcube.battery.level}%
            </span>
          ) : null}
        </div>
      ) : null}

      {showResetGyro ? (
        <button
          type="button"
          onClick={onResetGyro}
          style={{
            padding: '4px 8px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--raised)',
            color: 'var(--fg2)',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Reset Gyro
        </button>
      ) : null}
      {showResetOrientation ? (
        <button
          type="button"
          onClick={onResetOrientation}
          style={{
            padding: '4px 8px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--raised)',
            color: 'var(--fg2)',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Reset Orient.
        </button>
      ) : null}

      <button
        type="button"
        title={smartcube.connected ? 'Disconnect Smartcube' : 'Connect Smartcube'}
        onClick={() => void smartcube.connectOrDisconnect()}
        style={{
          height: 34,
          paddingLeft: 10,
          paddingRight: 10,
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <BluetoothIcon size={21} />
        <span>{smartcube.connectLabel}</span>
      </button>
    </div>
  );
}
