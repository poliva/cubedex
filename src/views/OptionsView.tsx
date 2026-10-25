import { memo, useEffect, useState } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import type { AppSettingsState } from '../hooks/useAppSettings';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import { Toggle } from '../components/ui/Toggle';
import { Icon } from '../components/ui/Icon';
import { MIN_VIEW_ANGLE_DEG, MAX_VIEW_ANGLE_DEG } from '../lib/training-cube-view';

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
  const [pendingAction, setPendingAction] = useState<'read' | 'mark' | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; error: boolean } | null>(null);
  useEffect(() => { setActionFeedback(null); }, [smartcube.connected]);

  async function runCubeAction(kind: 'read' | 'mark', action: () => Promise<unknown>, message: string) {
    if (!smartcube.connected || pendingAction || smartcube.stateSyncing) return;
    setPendingAction(kind);
    setActionFeedback(null);
    try {
      await action();
      setActionFeedback({ message, error: false });
    } catch (error) {
      setActionFeedback({ message: error instanceof Error ? error.message : 'Could not update the cube. Please try again.', error: true });
    } finally {
      setPendingAction(null);
    }
  }

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
    padding: '8px 14px',
    minHeight: 44,
    background: 'var(--surface)',
    borderBottom: last ? 'none' : '1px solid var(--border)',
    gap: 8,
  });

  const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--fg)', minWidth: 0 };
  const optionLabel = (title: string, description: string, style?: React.CSSProperties) => (
    <div style={{ ...lbl, ...style }}>
      {title}
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>{description}</div>
    </div>
  );

  const btnStyle = (ghost = false): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 8,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    ...(ghost
      ? { border: '1px solid var(--border)', background: 'var(--raised)', color: 'var(--fg2)' }
      : { border: 'none', background: 'var(--accent)', color: '#fff' }),
  });

  const sel: React.CSSProperties = {
    flexShrink: 0,
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

  const stackStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const deviceInfoRows: [string, string][] = [
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
  ];

  const deviceInfoTable = (
    <div style={section}>
      {deviceInfoRows.map(([label, value], i, arr) => (
        <div key={label} style={row(i === arr.length - 1)}>
          <span style={{ ...lbl, fontSize: 12, color: 'var(--fg3)' }}>{label}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg)', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );

  const deviceActionsEnabled = smartcube.connected && !pendingAction && !smartcube.stateSyncing;
  const showGyroReset = options.gyroscope && smartcube.gyroSupported;
  const deviceTools = [
    {
      id: 'read-cube', name: 'Read cube again',
      description: 'Update the virtual cube from your smartcube. Works while scrambled.',
      icon: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3a7 7 0 0 0 11.6-2',
      busy: pendingAction === 'read', busyLabel: 'Reading cube…', disabled: !deviceActionsEnabled,
      onClick: () => void runCubeAction('read', () => smartcube.refreshPattern(), 'Cube state updated.'),
    },
    {
      id: 'mark-solved', name: 'Mark cube as solved',
      description: 'Physically solve the cube first. This sets its recorded state to solved.',
      icon: 'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 11l4 4L21 5',
      busy: pendingAction === 'mark', busyLabel: 'Marking as solved…', disabled: !deviceActionsEnabled,
      onClick: () => void runCubeAction('mark', smartcube.resetState, 'Cube marked as solved.'),
    },
    {
      id: 'reset-cube-orientation', name: showGyroReset ? 'Reset Gyro' : 'Reset Orientation',
      description: showGyroReset
        ? 'Hold white on top and green in front, then reset the motion reference.'
        : 'Restore the reference used to display cube turns.',
      icon: 'M12 3v18M3 12h18M17 7l4 5-4 5M7 3l5 4 5-4',
      busy: false, busyLabel: '', disabled: !deviceActionsEnabled,
      onClick: () => {
        if (showGyroReset) smartcube.resetGyro();
        else smartcube.resetOrientation();
        setActionFeedback(null);
      },
    },
    {
      id: 'device-info', name: 'Device Info',
      description: 'View connection, battery, and device details.',
      icon: 'M12 8h.01M12 12v5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
      busy: false, busyLabel: '', disabled: !smartcube.connected,
      onClick: () => setInfoVisible(true),
    },
  ];

  return (
    <div
      className="app-view-fade-in"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${isMobile ? 14 : 18}px ${pad}px`,
        paddingBottom: pb,
      }}
    >
      <div style={stackStyle}>
        {infoVisible ? (
          deviceInfoTable
        ) : (
          <>
        {/* Appearance */}
        <div style={section}>
          <div style={sHdr}>Appearance</div>
          <div style={row(true)}>
            {optionLabel('Dark Mode', 'Use a dark color theme throughout the app.')}
            <Toggle ariaLabel="Dark Mode" checked={options.darkMode} onChange={(v) => options.setDarkMode(v)} />
          </div>
        </div>

        {/* Practice */}
        <div style={section}>
          <div style={sHdr}>Practice</div>
          <div style={row()}>
            {optionLabel('Countdown Mode', 'Show a 3-second countdown before each alg. Disabled in Time Attack.')}
            <Toggle ariaLabel="Countdown Mode" checked={options.countdownMode} onChange={(v) => options.setCountdownMode(v)} />
          </div>
          <div style={row()}>
            {optionLabel('Always Keep "Scramble To" Enabled', 'Automatically prepare a setup scramble for each alg.')}
            <Toggle ariaLabel='Always Keep "Scramble To" Enabled' checked={options.alwaysScrambleTo} onChange={(v) => options.setAlwaysScrambleTo(v)} />
          </div>
          <div style={row()}>
            {optionLabel('Auto-update Learning State', 'Update Learning and Learned status automatically as you practice.')}
            <Toggle ariaLabel="Auto-update learning state" checked={options.autoUpdateLearningState} onChange={(v) => options.setAutoUpdateLearningState(v)} />
          </div>
          <div style={row()}>
            <div style={lbl}>Expert Scrambler
              <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>Full setup and recovery sequences with automatic progress. Start turning after matching the pictured grip.</div>
            </div>
            <Toggle ariaLabel="Expert Scrambler" checked={options.expertScrambler} onChange={options.setExpertScrambler} />
          </div>
          <div style={row()}>
            <div style={lbl}>Match Virtual Cube on Recovery
              <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>“Help me recover” also guides your physical cube to match the virtual cube’s stickers before you continue.</div>
            </div>
            <Toggle ariaLabel="Match Virtual Cube on Recovery" checked={options.matchVirtualCubeOnRecovery} onChange={options.setMatchVirtualCubeOnRecovery} />
          </div>
          <div style={row()}>
            <div style={lbl}>Allow Alternative Algorithms
              <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>With a smartcube, solve the case using any algorithm. Partial stages accept any ending that meets their goal. Different turns won’t trigger mistake or undo warnings.</div>
            </div>
            <Toggle ariaLabel="Allow Alternative Algorithms" checked={options.allowAlternativeAlgorithms} onChange={options.setAllowAlternativeAlgorithms} />
          </div>
          <div style={row()}>
            {optionLabel('Flashing Indicator', 'Flash visual feedback for timer starts, mistakes, and completed algs.')}
            <Toggle ariaLabel="Flashing Indicator" checked={options.flashingIndicatorEnabled} onChange={(v) => options.setFlashingIndicatorEnabled(v)} />
          </div>
          <div style={row(true)}>
            {optionLabel('Show Case Name', 'Display the current case name during practice.')}
            <Toggle ariaLabel="Show Case Name" checked={options.showAlgName} onChange={(v) => options.setShowAlgName(v)} />
          </div>
        </div>

        {/* Visualization */}
        <div style={section}>
          <div style={sHdr}>Visualization</div>
          <div style={row()}>
            {optionLabel('Cube Visualization Mode', 'Choose a 3D cube, a flat view, or a last-layer view.')}
            <select aria-label="Cube Visualization Mode" style={sel} value={options.visualization} onChange={(e) => options.setVisualization(e.target.value)}>
              <option value="PG3D">PG3D</option>
              <option value="2D">2D</option>
              <option value="3D">3D</option>
              <option value="experimental-2D-LL">2D-LL</option>
              <option value="experimental-2D-LL-face">2D-LL-face</option>
            </select>
          </div>
          <div style={row()}>
            {optionLabel('Back View', 'Add a second view to see the back of the virtual cube.')}
            <select aria-label="Back View" style={sel} value={options.backview} onChange={(e) => options.setBackview(e.target.value)}>
              <option value="none">Disabled</option>
              <option value="side-by-side">Side-by-side</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
          <div style={row()}>
            <div style={{ ...lbl, flex: 1 }}>
              <label htmlFor="cube-view-angle">Default View Angle · {options.viewAngleDeg}°</label>
              <div id="cube-view-angle-description" style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4 }}>
                Turn the default view left (negative) or right (positive).
              </div>
              <input id="cube-view-angle" type="range" min={MIN_VIEW_ANGLE_DEG} max={MAX_VIEW_ANGLE_DEG} step={1}
                value={options.viewAngleDeg} aria-label="Default View Angle" aria-valuetext={`${options.viewAngleDeg} degrees`}
                aria-describedby="cube-view-angle-description" onChange={e => options.setViewAngleDeg(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            </div>
          </div>
          <div style={row()}>
            {optionLabel('Floating Mirror Stickers', 'Show hidden stickers beside the virtual cube.')}
            <Toggle
              ariaLabel="Floating Mirror Stickers"
              checked={options.hintFacelets === 'floating'}
              onChange={(v) => options.setHintFacelets(v ? 'floating' : 'none')}
            />
          </div>
          <div style={row()}>
            {optionLabel('Always Show Full Stickers', 'Show every sticker instead of highlighting only the current case.')}
            <Toggle ariaLabel="Always Show Full Stickers" checked={options.fullStickering} onChange={(v) => options.setFullStickering(v)} />
          </div>
          <div style={row(!options.fullStickering)}>
            {optionLabel('Virtual Cube White on Bottom', 'Display the virtual cube with white facing down.', { opacity: options.fullStickering ? 1 : 0.45 })}
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
            {optionLabel('Virtual Cube Control Panel', 'Show playback and move controls below the virtual cube.')}
            <Toggle
              ariaLabel="Virtual Cube Control Panel"
              checked={options.controlPanel === 'bottom-row'}
              onChange={(v) => options.setControlPanel(v ? 'bottom-row' : 'none')}
            />
          </div>
          <div style={row(true)}>
            {optionLabel(`Cube Size · ${options.cubeSizePx}px`, 'Adjust the size of the virtual cube during practice.')}
            <input
              type="range"
              aria-label="Cube Size"
              min={240}
              max={600}
              step={10}
              value={options.cubeSizePx}
              onChange={(e) => options.setCubeSizePx(Number(e.target.value))}
              style={{ width: 110, flexShrink: 0, accentColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Smartcube */}
        <div style={section}>
          <div style={sHdr}>Smartcube</div>
          <div style={row()}>
            {optionLabel('Animate Using Gyroscope', 'Rotate the virtual cube to follow how you hold your smartcube.')}
            <Toggle
              ariaLabel="Animate Virtual Cube Using Gyroscope"
              checked={smartcube.connected && !smartcube.gyroSupported ? false : options.gyroscope}
              disabled={smartcube.gyroscopeToggleDisabled}
              onChange={(v) => options.setGyroscope(v)}
            />
          </div>
          <div style={row()}>
            {optionLabel('Auto-correct Gyro Drift', 'Corrects small tilts at rest, learns heading drift during practice, and gently recenters the training view between algorithms. Turning this off clears learned correction. Connect or reset with white on top and green in front.')}
            <Toggle
              ariaLabel="Auto-correct Gyro Drift"
              checked={options.autoCorrectGyroDrift}
              disabled={!options.gyroscope || smartcube.gyroscopeToggleDisabled}
              onChange={options.setAutoCorrectGyroDrift}
            />
          </div>
          <div style={row()}>
            {optionLabel('Show All Bluetooth Devices', 'Include unrecognized devices in the Bluetooth connection picker.')}
            <Toggle
              ariaLabel="Show all Bluetooth devices when connecting"
              checked={smartcube.showAllBluetoothDevices}
              onChange={(v) => smartcube.setShowAllBluetoothDevices(v)}
            />
          </div>
          <div className="cube-tools" role="group" aria-label="Cube tools">
            <div className="cube-tools__heading">
              <span>Cube tools</span>
              {!smartcube.connected && <span>Connect a cube to use these tools.</span>}
            </div>
            {deviceTools.map(tool => <button key={tool.id} className="cube-tool" type="button"
              aria-label={tool.name} aria-describedby={`${tool.id}-description`} aria-busy={tool.busy}
              disabled={tool.disabled} onClick={tool.onClick}>
              <span className="cube-tool__icon" aria-hidden="true"><Icon d={tool.icon} size={20} /></span>
              <span className="cube-tool__copy">
                <strong>{tool.busy ? tool.busyLabel : tool.name}</strong>
                <span id={`${tool.id}-description`}>{tool.description}</span>
              </span>
            </button>)}
            {actionFeedback && <p className={`cube-tools__feedback${actionFeedback.error ? ' cube-tools__feedback--error' : ''}`}
              role={actionFeedback.error ? 'alert' : 'status'}>{actionFeedback.message}</p>}
          </div>
        </div>

        {/* Algorithms */}
        <div style={section}>
          <div style={sHdr}>Algorithms</div>
          <div style={row()}>
            {optionLabel('Export / Import Algs', 'Save or load your algorithm library as a JSON file.')}
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
            {optionLabel('Export / Import Backup', 'Save or restore algorithms, times, and learning progress.')}
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

          </>
        )}
      </div>
    </div>
  );
});
