import { memo } from 'react';
import type { AlgorithmImportExportState } from '../hooks/useAlgorithmImportExport';
import type { AppSettingsState } from '../hooks/useAppSettings';
import { ToggleSwitch } from '../components/ToggleSwitch';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';

export const OptionsView = memo(function OptionsView({
  visible,
  infoVisible,
  setInfoVisible,
  options,
  smartcube,
  algorithmActions,
}: {
  visible: boolean;
  infoVisible: boolean;
  setInfoVisible: (value: boolean | ((prev: boolean) => boolean)) => void;
  options: AppSettingsState;
  smartcube: SmartcubeConnectionState;
  algorithmActions: AlgorithmImportExportState;
}) {
  return (
    <>
      <div id="info" className={`${infoVisible ? 'info-panel shell-card' : 'hidden info-panel shell-card'}`}>
        <label htmlFor="deviceName" className="form-label">Device Name:</label>
        <input id="deviceName" type="text" readOnly value={smartcube.info.deviceName} className="readonly-input" />
        <label htmlFor="deviceMAC" className="form-label">Device MAC:</label>
        <input id="deviceMAC" type="text" readOnly value={smartcube.info.deviceMAC} className="readonly-input" />
        <label htmlFor="deviceProtocol" className="form-label">Protocol:</label>
        <input id="deviceProtocol" type="text" readOnly value={smartcube.info.deviceProtocol} className="readonly-input" />
        <label htmlFor="hardwareName" className="form-label">Hardware Name:</label>
        <input id="hardwareName" type="text" readOnly value={smartcube.info.hardwareName} className="readonly-input" />
        <label htmlFor="hardwareVersion" className="form-label">Hardware Version:</label>
        <input id="hardwareVersion" type="text" readOnly value={smartcube.info.hardwareVersion} className="readonly-input" />
        <label htmlFor="softwareVersion" className="form-label">Software Version:</label>
        <input id="softwareVersion" type="text" readOnly value={smartcube.info.softwareVersion} className="readonly-input" />
        <label htmlFor="productDate" className="form-label">Product Date:</label>
        <input id="productDate" type="text" readOnly value={smartcube.info.productDate} className="readonly-input" />
        <label htmlFor="gyroSupported" className="form-label">Gyro Supported:</label>
        <input id="gyroSupported" type="text" readOnly value={smartcube.info.gyroSupported} className="readonly-input" />
        <label htmlFor="batteryLevel" className="form-label">Battery:</label>
        <input id="batteryLevel" type="text" readOnly value={smartcube.info.batteryLevel} className="readonly-input" />
        <label htmlFor="skew" className="form-label">Clock Skew:</label>
        <input id="skew" type="text" readOnly value={smartcube.info.skew} className="readonly-input" />
        <label htmlFor="quaternion" className="form-label">Quaternion:</label>
        <input id="quaternion" type="text" readOnly value={smartcube.info.quaternion} className="readonly-input" />
        <label htmlFor="velocity" className="form-label">Angular Velocity:</label>
        <input id="velocity" type="text" readOnly value={smartcube.info.velocity} className="readonly-input" />
      </div>

      <div
        id="options-container"
        className={`options-panel shell-card ${visible && !infoVisible ? '' : 'hidden'}`.trim()}
      >
        <div id="alg-options-container" className="options-section">
          <p className="options-section-title">Algorithms Options:</p>
          <div className="button-row options-button-row">
            <button id="export-algs" className="primary-button" type="button" onClick={() => void algorithmActions.exportAll()}>
              Export Algs
            </button>
            <button
              id="import-algs"
              className="primary-button"
              type="button"
              onClick={() => document.getElementById('import-file')?.click()}
            >
              Import Algs
            </button>
          </div>
        </div>

        <div id="backup-options-container" className="options-section">
          <p className="options-section-title">Backup Options:</p>
          <div className="button-row options-button-row">
            <button id="export-backup" className="primary-button" type="button" onClick={() => void algorithmActions.exportBackup()}>
              Export Backup
            </button>
            <button
              id="import-backup"
              className="primary-button"
              type="button"
              onClick={() => document.getElementById('import-backup-file')?.click()}
            >
              Import Backup
            </button>
          </div>
        </div>

        <div id="device-options-container" className="options-section">
          <p className="options-section-title">Smartcube Options:</p>
          <div className="button-row options-button-row">
            <button
              id="reset-state"
              disabled={!smartcube.connected}
              className="primary-button"
              type="button"
              onClick={() => void smartcube.resetState()}
            >
              Reset State
            </button>
            <button
              id="reset-gyro"
              disabled={!smartcube.connected || !options.gyroscope || !smartcube.gyroSupported}
              className="primary-button"
              type="button"
              onClick={() => smartcube.resetGyro()}
            >
              Reset Gyro
            </button>
            <button
              id="device-info"
              disabled={!smartcube.connected}
              className="primary-button"
              type="button"
              onClick={() => {
                setInfoVisible((value) => !value);
              }}
            >
              Device Info
            </button>
          </div>
          <div className="device-ble-toggle-row">
            <ToggleSwitch
              id="smartcube-show-all-ble-toggle"
              checked={smartcube.showAllBluetoothDevices}
              onChange={(checked) => smartcube.setShowAllBluetoothDevices(checked)}
              label="Show all Bluetooth devices when connecting"
            />
          </div>
        </div>

        <div className="options-toggle-row">
          <ToggleSwitch
            id="dark-mode-toggle"
            checked={options.darkMode}
            onChange={(checked) => options.setDarkMode(checked)}
            label="Dark Mode"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="gyroscope-toggle"
            checked={smartcube.connected && !smartcube.gyroSupported ? false : options.gyroscope}
            disabled={smartcube.gyroscopeToggleDisabled}
            onChange={(checked) => options.setGyroscope(checked)}
            label="Animate Virtual Cube Using Gyroscope"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="control-panel-toggle"
            checked={options.controlPanel === 'bottom-row'}
            onChange={(checked) => options.setControlPanel(checked ? 'bottom-row' : 'none')}
            label="Virtual Cube Control Panel"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="hintFacelets-toggle"
            checked={options.hintFacelets === 'floating'}
            onChange={(checked) => options.setHintFacelets(checked ? 'floating' : 'none')}
            label="Floating Mirror Stickers"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="full-stickering-toggle"
            checked={options.fullStickering}
            onChange={(checked) => options.setFullStickering(checked)}
            label="Always Show Full Stickers"
          />
        </div>

        <div className="white-bottom-group">
          <ToggleSwitch
            id="white-on-bottom-toggle"
            className="toggle-switch--indented"
            checked={options.whiteOnBottom}
            disabled={!options.fullStickering}
            onChange={(checked) => options.setWhiteOnBottom(checked)}
            label="Virtual Cube White on Bottom"
          />
          <span id="white-on-bottom-hint" className={`${options.fullStickering ? 'hidden subtle-text' : 'subtle-text'}`}>
            Requires “Always Show Full Stickers”
          </span>
        </div>

        <div className="options-toggle-row">
          <ToggleSwitch
            id="flashing-indicator-toggle"
            checked={options.flashingIndicatorEnabled}
            onChange={(checked) => options.setFlashingIndicatorEnabled(checked)}
            label="Flashing Indicator"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="show-alg-name-toggle"
            checked={options.showAlgName}
            onChange={(checked) => options.setShowAlgName(checked)}
            label="Show Case Name"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="countdown-mode-toggle"
            checked={options.countdownMode}
            onChange={(checked) => options.setCountdownMode(checked)}
            label="Countdown Mode"
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="always-scramble-to-toggle"
            checked={options.alwaysScrambleTo}
            onChange={(checked) => options.setAlwaysScrambleTo(checked)}
            label='Always Keep "Scramble To" Enabled'
          />
        </div>
        <div className="options-toggle-row">
          <ToggleSwitch
            id="auto-learning-state-toggle"
            checked={options.autoUpdateLearningState}
            onChange={(checked) => options.setAutoUpdateLearningState(checked)}
            label="Auto-update learning state"
          />
        </div>

        <div id="visualization-container">
          <label htmlFor="visualization-select" className="options-viz-label">Cube Visualization Mode:</label>
          <select
            id="visualization-select"
            className="select-input"
            value={options.visualization}
            onChange={(event) => options.setVisualization(event.target.value)}
          >
            <option value="PG3D">PG3D</option>
            <option value="2D">2D</option>
            <option value="3D">3D</option>
            <option value="experimental-2D-LL">2D-LL</option>
            <option value="experimental-2D-LL-face">2D-LL-face</option>
          </select>

          <label htmlFor="backview-select" className="options-viz-label">Cube Back View:</label>
          <select
            id="backview-select"
            className="select-input"
            value={options.backview}
            onChange={(event) => options.setBackview(event.target.value)}
          >
            <option value="none">Disabled</option>
            <option value="side-by-side">Side-by-side</option>
            <option value="top-right">Top Right</option>
          </select>
        </div>

        <div id="large-cube-container">
          <label htmlFor="cube-size" className="options-cube-size-label">Cube Size:</label>
          <div className="cube-size-row">
            <input
              id="cube-size"
              type="range"
              min="240"
              max="600"
              step="10"
              value={options.cubeSizePx}
              onChange={(event) => options.setCubeSizePx(Number(event.target.value))}
            />
            <input
              id="cube-size-number"
              type="number"
              min="240"
              max="600"
              step="10"
              value={options.cubeSizePx}
              onChange={(event) => options.setCubeSizePx(Number(event.target.value))}
              className="number-input"
            />
          </div>
        </div>
      </div>
    </>
  );
});
