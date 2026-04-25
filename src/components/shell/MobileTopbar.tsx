import type { SmartcubeConnectionState } from '../../hooks/useSmartcubeConnection';
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

export function MobileTopbar({
  screen,
  smartcube,
  showResetGyro,
  showResetOrientation,
  onResetGyro,
  onResetOrientation,
}: {
  screen: NavView;
  smartcube: SmartcubeConnectionState;
  showResetGyro: boolean;
  showResetOrientation: boolean;
  onResetGyro: () => void;
  onResetOrientation: () => void;
}) {
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
      <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: 'var(--fg)' }}>
        {SCREEN_TITLES[screen]}
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
            <span style={{ fontSize: 10, color: 'var(--fg3)', fontFamily: 'var(--mono)' }}>
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
        onClick={() => void smartcube.connectOrDisconnect()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: `1.5px solid ${smartcube.connected ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
          background: smartcube.connected ? 'rgba(34,197,94,0.08)' : 'transparent',
          color: smartcube.connected ? 'var(--ok)' : 'var(--fg2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BluetoothIcon size={16} />
      </button>
    </div>
  );
}
