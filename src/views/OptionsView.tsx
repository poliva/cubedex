import { memo } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import { Toggle } from '../components/ui/Toggle';

export const OptionsView = memo(function OptionsView({
  visible,
  infoVisible,
  setInfoVisible,
  options,
  smartcube,
  algorithmActions,
  isMobile,
}: {
  visible: boolean;
  infoVisible: boolean;
  setInfoVisible: (value: boolean | ((prev: boolean) => boolean)) => void;
  options: AppSettingsState;
  smartcube: SmartcubeConnectionState;
  algorithmActions: AlgorithmImportExportState;
  isMobile?: boolean;
}) {
  const pad = isMobile ? 12 : 20;
  const pb = isMobile ? 'calc(var(--tab-h) + 12px)' : 16;

  const sHdr: React.CSSProperties = {
    padding: '8px 14px',
    background: 'var(--raised)',
    borderBottom: '1px solid var(--border)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--fg3)',
  };

  const row = (last = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 14px',
    minHeight: 44,
    background: 'var(--surface)',
    borderBottom: last ? 'none' : '1px solid var(--border)',
    gap: 8,
  });

  const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--fg)' };

  const btnStyle = (ghost = false): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 8,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    ...(ghost
      ? { border: '1px solid var(--border)', background: 'var(--raised)', color: 'var(--fg2)' }
      : { border: 'none', background: 'var(--accent)', color: '#fff' }),
  });

  const sel: React.CSSProperties = {
    background: 'var(--raised)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    borderRadius: 8,
    padding: '4px 8px',
    fontFamily: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
  };

  const section: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  };

  if (!visible && !infoVisible) return null;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: `${isMobile ? 14 : 18}px ${pad}px`,
      paddingBottom: pb,
    }}>
      {!isMobile && (
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--fg)' }}>Options</h2>
      )}

      {/* Device info panel */}
      {infoVisible && (
        <div style={{ ...section, marginBottom: 12 }}>
          <div style={sHdr}>Device Info</div>
          {[
            ['Device Name', smartcube.info.deviceName],
            ['Device MAC', smartcube.info.deviceMAC],
            ['Protocol', smartcube.info.deviceProtocol],
            ['Hardware Name', smartcube.info.hardwareName],
            ['Hardware Version', smartcube.info.hardwareVersion],
            ['Software Version', smartcube.info.softwareVersion],
            ['Product Date', smartcube.info.productDate],
            ['Gyro Supported', smartcube.info.gyroSupported],
            ['Battery', smartcube.info.batteryLevel],
            ['Clock Skew', smartcube.info.skew],
            ['Quaternion', smartcube.info.quaternion],
            ['Angular Velocity', smartcube.info.velocity],
          ].map(([label, value], i, arr) => (
            <div key={label} style={row(i === arr.length - 1)}>
              <span style={{ ...lbl, fontSize: 12, color: 'var(--fg3)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg)', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>

        {/* Algorithms */}
        <div style={section}>
          <div style={sHdr}>Algorithms</div>
          <div style={row()}>
            <span style={lbl}>Export / Import Algs</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btnStyle()} type="button" onClick={() => void algorithmActions.exportAll()}>
                Export
              </button>
              <button style={btnStyle()} type="button" onClick={() => document.getElementById('import-file')?.click()}>
                Import
              </button>
            </div>
          </div>
          <div style={row(true)}>
            <span style={lbl}>Export / Import Backup</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btnStyle()} type="button" onClick={() => void algorithmActions.exportBackup()}>
                Export
              </button>
              <button style={btnStyle()} type="button" onClick={() => document.getElementById('import-backup-file')?.click()}>
                Import
              </button>
            </div>
          </div>
        </div>

        {/* Practice */}
        <div style={section}>
          <div style={sHdr}>Practice</div>
          <div style={row()}>
            <span style={lbl}>Countdown Mode</span>
            <Toggle ariaLabel="Countdown Mode" checked={options.countdownMode} onChange={(v) => options.setCountdownMode(v)} />
          </div>
          <div style={row()}>
            <span style={lbl}>Always Keep "Scramble To" Enabled</span>
            <Toggle ariaLabel='Always Keep "Scramble To" Enabled' checked={options.alwaysScrambleTo} onChange={(v) => options.setAlwaysScrambleTo(v)} />
          </div>
          <div style={row()}>
            <span style={lbl}>Auto-update Learning State</span>
            <Toggle ariaLabel="Auto-update learning state" checked={options.autoUpdateLearningState} onChange={(v) => options.setAutoUpdateLearningState(v)} />
          </div>
          <div style={row()}>
            <span style={lbl}>Flashing Indicator</span>
            <Toggle ariaLabel="Flashing Indicator" checked={options.flashingIndicatorEnabled} onChange={(v) => options.setFlashingIndicatorEnabled(v)} />
          </div>
          <div style={row(true)}>
            <span style={lbl}>Show Case Name</span>
            <Toggle ariaLabel="Show Case Name" checked={options.showAlgName} onChange={(v) => options.setShowAlgName(v)} />
          </div>
        </div>

        {/* Visualization */}
        <div style={section}>
          <div style={sHdr}>Visualization</div>
          <div style={row()}>
            <span style={lbl}>Cube Visualization Mode</span>
            <select style={sel} value={options.visualization} onChange={(e) => options.setVisualization(e.target.value)}>
              <option value="PG3D">PG3D</option>
              <option value="2D">2D</option>
              <option value="3D">3D</option>
              <option value="experimental-2D-LL">2D-LL</option>
              <option value="experimental-2D-LL-face">2D-LL-face</option>
            </select>
          </div>
          <div style={row()}>
            <span style={lbl}>Back View</span>
            <select style={sel} value={options.backview} onChange={(e) => options.setBackview(e.target.value)}>
              <option value="none">Disabled</option>
              <option value="side-by-side">Side-by-side</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
          <div style={row()}>
            <span style={lbl}>Floating Mirror Stickers</span>
            <Toggle
              ariaLabel="Floating Mirror Stickers"
              checked={options.hintFacelets === 'floating'}
              onChange={(v) => options.setHintFacelets(v ? 'floating' : 'none')}
            />
          </div>
          <div style={row()}>
            <span style={lbl}>Always Show Full Stickers</span>
            <Toggle ariaLabel="Always Show Full Stickers" checked={options.fullStickering} onChange={(v) => options.setFullStickering(v)} />
          </div>
          <div style={row(!options.fullStickering)}>
            <span style={{ ...lbl, opacity: options.fullStickering ? 1 : 0.45 }}>Virtual Cube White on Bottom</span>
            <Toggle
              ariaLabel="Virtual Cube White on Bottom"
              checked={options.whiteOnBottom}
              disabled={!options.fullStickering}
              onChange={(v) => options.setWhiteOnBottom(v)}
            />
          </div>
          {!options.fullStickering && (
            <div style={{ padding: '0 14px 8px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}>Requires "Always Show Full Stickers"</span>
            </div>
          )}
          <div style={row()}>
            <span style={lbl}>Virtual Cube Control Panel</span>
            <Toggle
              ariaLabel="Virtual Cube Control Panel"
              checked={options.controlPanel === 'bottom-row'}
              onChange={(v) => options.setControlPanel(v ? 'bottom-row' : 'none')}
            />
          </div>
          <div style={row(true)}>
            <span style={lbl}>
              Cube Size{' '}
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--fg3)', fontSize: 12 }}>
                {options.cubeSizePx}px
              </span>
            </span>
            <input
              type="range"
              min={240}
              max={600}
              step={10}
              value={options.cubeSizePx}
              onChange={(e) => options.setCubeSizePx(Number(e.target.value))}
              style={{ width: 110, accentColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Smartcube */}
        <div style={section}>
          <div style={sHdr}>Smartcube</div>
          <div style={row()}>
            <span style={lbl}>Animate Using Gyroscope</span>
            <Toggle
              ariaLabel="Animate Virtual Cube Using Gyroscope"
              checked={smartcube.connected && !smartcube.gyroSupported ? false : options.gyroscope}
              disabled={smartcube.gyroscopeToggleDisabled}
              onChange={(v) => options.setGyroscope(v)}
            />
          </div>
          <div style={row()}>
            <span style={lbl}>Show All Bluetooth Devices</span>
            <Toggle
              ariaLabel="Show all Bluetooth devices when connecting"
              checked={smartcube.showAllBluetoothDevices}
              onChange={(v) => smartcube.setShowAllBluetoothDevices(v)}
            />
          </div>
          <div style={{ ...row(true), flexWrap: 'wrap', gap: 8 }}>
            <span style={lbl}>Device Actions</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                style={btnStyle(true)}
                type="button"
                disabled={!smartcube.connected}
                onClick={() => void smartcube.resetState()}
              >
                Reset State
              </button>
              <button
                style={btnStyle(true)}
                type="button"
                disabled={!smartcube.connected || !options.gyroscope || !smartcube.gyroSupported}
                onClick={() => smartcube.resetGyro()}
              >
                Reset Gyro
              </button>
              <button
                style={btnStyle(true)}
                type="button"
                disabled={!smartcube.connected}
                onClick={() => setInfoVisible((v) => !v)}
              >
                Device Info
              </button>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div style={section}>
          <div style={sHdr}>Appearance</div>
          <div style={row(true)}>
            <span style={lbl}>Dark Mode</span>
            <Toggle ariaLabel="Dark Mode" checked={options.darkMode} onChange={(v) => options.setDarkMode(v)} />
          </div>
        </div>

      </div>
    </div>
  );
});
