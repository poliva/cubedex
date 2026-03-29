import $ from 'jquery';
import { connectSmartCube } from 'smartcube-web-bluetooth';
import { S } from '../state';
import { syncMirrorAlg } from '../visualization';
import { drawAlgInCube } from '../trainer';
import { handleCubeEvent, customMacAddressProvider, deviceDisconnected } from './moveHandler';
import { setGyroscopeUiFromSupported } from './handlersOptions';

// -- Wake lock ----------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null;

/** Requests a screen wake lock to prevent the device from sleeping during practice. */
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      console.log('Wake lock is not supported by this browser.');
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(`${err.name}, ${err.message}`);
    } else {
      console.error('An unknown error occurred.');
    }
  }
}

/** Releases the screen wake lock. */
export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}

function handleVisibilityChange() {
  if (wakeLock !== null) {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }
}

const SMARTCUBE_DEVICE_SELECTION_KEY = 'smartcubeDeviceSelection';

function storedSmartCubeDeviceSelection(): 'filtered' | 'any' {
  return localStorage.getItem(SMARTCUBE_DEVICE_SELECTION_KEY) === 'any' ? 'any' : 'filtered';
}

export function updateHeaderResetGyroState() {
  const headerResetGyro = $('#header-reset-gyro');
  if (S.conn && S.gyroscopeEnabled) {
    headerResetGyro.removeClass('hidden');
    headerResetGyro.prop('disabled', false);
  } else {
    headerResetGyro.addClass('hidden');
    headerResetGyro.prop('disabled', true);
  }
}

let connectAbort: AbortController | null = null;
let connectInFlight = false;

const SPINNER = ' <svg class="animate-spin inline-block w-4 h-4 mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75"></path></svg>';

window.addEventListener('pagehide', () => {
  if (connectInFlight && !S.conn) {
    connectAbort?.abort();
  }
});

/** Registers event handlers for GAN Bluetooth cube connection and device controls. */
export function initDeviceHandlers() {
  // Show all BLE devices toggle
  const smartcubeShowAllBleToggle = document.getElementById('smartcube-show-all-ble-toggle') as HTMLInputElement;
  smartcubeShowAllBleToggle.checked = storedSmartCubeDeviceSelection() === 'any';
  smartcubeShowAllBleToggle.addEventListener('change', () => {
    localStorage.setItem(SMARTCUBE_DEVICE_SELECTION_KEY, smartcubeShowAllBleToggle.checked ? 'any' : 'filtered');
  });

  // #device-info button - toggles visibility of the device-info panel (hardware name, firmware, battery)
  $('#device-info').on('click', () => {
    const infoDiv = $('#info');
    if (infoDiv.css('display') === 'none') {
      infoDiv.css('display', 'grid');
      $('#options-container').hide();
      $('#load-container').hide();
      $('#save-container').hide();
      $('#help').hide();
    } else {
      infoDiv.css('display', 'none');
    }
  });

  // #reset-state button - sends a hardware reset command to the GAN cube and re-draws the algorithm
  $('#reset-state').on('click', async () => {
    await S.conn?.sendCommand({ type: "REQUEST_RESET" });
    S.twistyPlayer.alg = '';
    syncMirrorAlg('');
    S.twistyTracker.alg = '';
    drawAlgInCube();
  });

  // #reset-gyro button - resets the gyroscope calibration basis quaternion
  $('#reset-gyro').on('click', async () => {
    S.basis = null;
  });

  // #connect-button - connects or disconnects the GAN Bluetooth cube
  $('#connect-button').on('click', async () => {
    if (S.conn) {
      S.conn.disconnect();
      deviceDisconnected();
      return;
    }
    if (connectInFlight) {
      connectAbort?.abort();
      $('#connect').html('Connect');
      connectInFlight = false;
      connectAbort = null;
      return;
    }

    connectAbort = new AbortController();
    connectInFlight = true;

    let newConn: import('smartcube-web-bluetooth').SmartCubeConnection | undefined;
    try {
      newConn = await connectSmartCube({
        macAddressProvider: customMacAddressProvider,
        enableAddressSearch: true,
        deviceSelection: storedSmartCubeDeviceSelection(),
        signal: connectAbort.signal,
        onStatus: (msg) => {
          $('#connect').html(`${msg}${SPINNER}`);
        },
      });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (!aborted) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        window.alert(msg);
      }
      $('#connect').html('Connect');
    } finally {
      connectInFlight = false;
      connectAbort = null;
    }

    if (!newConn) {
      return;
    }

    S.conn = newConn;
    S.conn.events$.subscribe(handleCubeEvent);
    if (S.conn.capabilities.hardware) {
      await S.conn.sendCommand({ type: "REQUEST_HARDWARE" });
    }
    if (S.conn.capabilities.facelets) {
      await S.conn.sendCommand({ type: "REQUEST_FACELETS" });
    }
    if (S.conn.capabilities.battery) {
      await S.conn.sendCommand({ type: "REQUEST_BATTERY" });
    }
    $('#deviceName').val(S.conn.deviceName);
    $('#deviceMAC').val(S.conn.deviceMAC);
    if (!S.conn.capabilities.hardware) {
      setGyroscopeUiFromSupported(S.conn.capabilities.gyroscope);
    }
    $('#connect').html('Disconnect');
    $('#bluetooth-indicator').hide();
    $('#battery-indicator').show();
    $('#reset-gyro').prop('disabled', false);
    $('#reset-state').prop('disabled', false);
    $('#device-info').prop('disabled', false);
    $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    requestWakeLock();
    updateHeaderResetGyroState();
  });
}
