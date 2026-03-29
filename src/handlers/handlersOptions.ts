import $ from 'jquery';
import { S } from '../state';
import { setStickering, buildStickeringMaskString, applyMaskToPlayer } from '../functions';
import {
  amimateCubeOrientation, createMirrorView, removeMirrorView,
  resetmasterRepairFaceMap,
} from '../visualization';
import { updateAlgDisplay } from '../trainer';
import { cancelCountdown } from '../timer';
import { updateTimesDisplay } from '../statsPanel';
import { renderLastCaseTile } from '../tile';

// ── Icon SVG fragments for rich tooltips ───────────────────────────────
const ICON_LEARNING = `<svg style="display:inline;width:1.1em;height:1.1em;vertical-align:middle" aria-hidden="true"><use href="#icon-bookmark-learning"/></svg>`;
const ICON_LEARNED  = `<svg style="display:inline;width:1.1em;height:1.1em;vertical-align:middle" aria-hidden="true"><use href="#icon-bookmark-learned"/></svg>`;

// ── Tooltip content keyed by data-tooltip-key attribute values ─────────
const RICH_TOOLTIPS: Record<string, string> = {
  'practice-learning':     `Filter: only practice cases in ${ICON_LEARNING} <b>Learning</b> state. Unknown and Learned cases are skipped. Mutually exclusive with 'Practice only Learned'.`,
  'practice-learned':      `Filter: only practice cases in ${ICON_LEARNED} <b>Learned</b> state. Unknown and Learning cases are skipped. Mutually exclusive with 'Practice only Learning'.`,
  'auto-promote-learning': `Automatically change Unknown cases to ${ICON_LEARNING} <b>Learning</b> state when they come up in practice. Without this, you must manually change the status on tiles.`,
  'limit-learning':        `Cap the number of cases in ${ICON_LEARNING} <b>Learning</b> state. New unknown cases won't be auto-promoted until existing ones graduate to ${ICON_LEARNED} Learned.`,
  'auto-promote-learned':  `Automatically promote ${ICON_LEARNING} Learning cases to ${ICON_LEARNED} <b>Learned</b> state after reaching the consecutive success threshold.`,
};

// ── Toggle element references (module-scope so loadConfiguration can access them) ──
const gyroscopeToggle = document.getElementById('gyroscope-toggle') as HTMLInputElement;
const controlPanelToggle = document.getElementById('control-panel-toggle') as HTMLInputElement;
const hintFaceletsToggle = document.getElementById('hintFacelets-toggle') as HTMLInputElement;
const retryFailedToggle = document.getElementById('retry-failed-toggle') as HTMLInputElement;
const fullStickeringToggle = document.getElementById('full-stickering-toggle') as HTMLInputElement;
const flashingIndicatorToggle = document.getElementById('flashing-indicator-toggle') as HTMLInputElement;
const countdownModeToggle = document.getElementById('countdown-mode-toggle') as HTMLInputElement;
const countdownSecondsSelect = document.getElementById('countdown-seconds-select') as HTMLSelectElement;
const showAlgNameToggle = document.getElementById('show-alg-name-toggle') as HTMLInputElement;
const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;
const randomOrderToggle = document.getElementById('random-order-toggle') as HTMLInputElement;
const randomAUFToggle = document.getElementById('random-auf-toggle') as HTMLInputElement;
const prioritizeSlowToggle = document.getElementById('prioritize-slow-toggle') as HTMLInputElement;
const prioritizeFailedToggle = document.getElementById('prioritize-failed-toggle') as HTMLInputElement;
const prioritizeDifficultToggle = document.getElementById('prioritize-difficult-toggle') as HTMLInputElement;
const smartCaseToggle = document.getElementById('smart-case-toggle') as HTMLInputElement;
const selectAllToggle = document.getElementById('select-all-toggle') as HTMLInputElement;
const cubeZoomSlider = document.getElementById('cube-zoom-slider') as HTMLInputElement;
const cubeZoomValue = document.getElementById('cube-zoom-value') as HTMLElement;

// ── Gyroscope UI management ────────────────────────────────────────────

/** Applies gyroscope enabled/disabled state: updates toggle, sliceOrientation, localStorage, and animation. */
export function applyGyroscopeEnabled(enabled: boolean) {
  S.gyroscopeEnabled = enabled;
  gyroscopeToggle.checked = enabled;
  Object.assign(S.sliceOrientation, { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
  localStorage.setItem('gyroscope', enabled ? 'enabled' : 'disabled');
  requestAnimationFrame(amimateCubeOrientation);
}

/** Sets whether the gyroscope toggle is disabled (grayed out). */
export function setGyroscopeToggleDisabled(disabled: boolean) {
  gyroscopeToggle.disabled = disabled;
}

/** Sync device info field, animation toggle, and whether the toggle can be edited (off + disabled when no gyro). */
export function setGyroscopeUiFromSupported(supported: boolean) {
  $('#gyroSupported').val(supported ? 'YES' : 'NO');
  applyGyroscopeEnabled(supported);
  setGyroscopeToggleDisabled(!supported);
}

/** Sets up the rich HTML tooltip system for elements with data-tooltip-key attributes. */
export function initRichTooltips() {
  const tooltip = document.getElementById('rich-tooltip');
  if (!tooltip) return;

  let showTimer: ReturnType<typeof setTimeout> | null = null;

  document.addEventListener('mouseover', (e) => {
    const el = e.target as Element;
    if (!el?.closest) return;
    const target = el.closest('[data-tooltip-key]') as HTMLElement | null;
    if (!target) return;
    const key = target.getAttribute('data-tooltip-key') ?? '';
    const html = RICH_TOOLTIPS[key];
    if (!html) return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      tooltip.innerHTML = html;
      const rect = target.getBoundingClientRect();
      tooltip.style.left = (rect.left + rect.width / 2) + 'px';
      tooltip.style.top = (rect.top - 8) + 'px';
      tooltip.classList.add('visible');
    }, 700);
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target as Element;
    if (!el?.closest) return;
    const target = el.closest('[data-tooltip-key]');
    if (!target) return;
    const related = (e as MouseEvent).relatedTarget as Element | null;
    if (related && target.contains(related)) return;
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    tooltip.classList.remove('visible');
  });

  document.addEventListener('click', () => tooltip.classList.remove('visible'));
  document.addEventListener('scroll', () => tooltip.classList.remove('visible'), true);
}

/** Migrates old localStorage key prefixes (LastFiveTimes->LastTimes) from earlier versions. */
export function renameOldKeys() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('LastFiveTimes-')) {
      const newKey = key.replace('LastFiveTimes-', 'LastTimes-');
      localStorage.setItem(newKey, localStorage.getItem(key) ?? '');
      localStorage.removeItem(key);
    }
  }
}

/** Guard flag - prevents saveAllOptions() from running during loadConfiguration().
 *  Without this, .trigger('change') on select elements in loadConfiguration() fires
 *  change handlers that call saveAllOptions(), overwriting localStorage with partially
 *  loaded (default) state values. */
let _isLoadingConfig = false;

/** Derives the colorRotationMode string from the current state of the 3 checkboxes. */
function deriveColorRotationMode(): string {
  const vertical = $('#rotate-colors-vertical').is(':checked');
  const upside = $('#rotate-colors-upside').is(':checked');
  const any = $('#rotate-colors-any').is(':checked');
  if (any) return 'any';
  if (vertical && upside) return 'vertical+upside';
  if (vertical) return 'vertical';
  if (upside) return 'upside';
  return 'none';
}

/** Updates the 3 color-rotation checkboxes to reflect the given mode string. */
function syncColorRotationCheckboxes(mode: string) {
  $('#rotate-colors-vertical').prop('checked', mode === 'vertical' || mode === 'vertical+upside');
  $('#rotate-colors-upside').prop('checked', mode === 'upside' || mode === 'vertical+upside');
  $('#rotate-colors-any').prop('checked', mode === 'any');
}

/** Reads all persisted settings from localStorage and applies them to the UI toggles and state. */
export function loadConfiguration() {  _isLoadingConfig = true;
  // Helper: read a boolean from localStorage with a default value
  const readBool = (key: string, def: boolean) => (localStorage.getItem(key) ?? String(def)) === 'true';
  const readStr = (key: string, def: string) => localStorage.getItem(key) ?? def;
  const readNum = (key: string, def: number) => {
    const v = localStorage.getItem(key);
    return v !== null ? (Number.isNaN(parseFloat(v)) ? def : parseFloat(v)) : def;
  };

  // ── Visual ────────────────────────────────────────────────────────────
  const visualization = localStorage.getItem('visualization');
  if (visualization) $('#visualization-select').val(visualization).trigger('change');

  const backview = localStorage.getItem('backview');
  if (backview) {
    const migrated = backview === 'dual-front' ? 'mirror-view' : backview;
    $('#backview-select').val(migrated).trigger('change');
  }

  const gyroEnabled = readStr('gyroscope', 'enabled') === 'enabled';
  gyroscopeToggle.checked = gyroEnabled;
  S.gyroscopeEnabled = gyroEnabled;

  const cpEnabled = readStr('control-panel', 'none') === 'bottom-row';
  controlPanelToggle.checked = cpEnabled;
  S.twistyPlayer.controlPanel = cpEnabled ? 'bottom-row' : 'none';

  const hfEnabled = readStr('hintFacelets', 'none') === 'floating';
  hintFaceletsToggle.checked = hfEnabled;
  S.twistyPlayer.hintFacelets = hfEnabled ? 'floating' : 'none';

  S.showAlgNameEnabled = readBool('showAlgName', true);
  showAlgNameToggle.checked = S.showAlgNameEnabled;

  S.fullStickeringEnabled = readBool('fullStickering', false);
  fullStickeringToggle.checked = S.fullStickeringEnabled;

  S.flashingIndicatorEnabled = readBool('flashingIndicatorEnabled', true);
  flashingIndicatorToggle.checked = S.flashingIndicatorEnabled;

  S.stareDelayEnabled = readBool('stareDelay', false);
  $('#stare-delay-toggle').prop('checked', S.stareDelayEnabled);
  S.stareDelaySeconds = readNum('stareDelaySeconds', 3);
  $('#stare-delay-seconds').val(String(S.stareDelaySeconds));

  S.colorRotationMode = localStorage.getItem('rotateColorsMode') || 'none';
  syncColorRotationCheckboxes(S.colorRotationMode);

  S.keepRotationEnabled = readBool('keepRotation', false);
  $('#keep-rotation-toggle').prop('checked', S.keepRotationEnabled);

  S.phantomModeEnabled = readBool('phantomMode', false);
  $('#phantom-mode-toggle').prop('checked', S.phantomModeEnabled);

  const savedZoom = localStorage.getItem('cubeZoom');
  if (savedZoom) {
    const qz = document.getElementById('cube-zoom-slider') as HTMLInputElement;
    if (qz) qz.value = savedZoom;
  }

  // ── Learning / promotion ──────────────────────────────────────────────
  S.autoPromoteLearning = readBool('autoPromoteLearning', true);
  $('#auto-promote-learning-toggle').prop('checked', S.autoPromoteLearning);
  $('#limit-learning-container').toggle(S.autoPromoteLearning);

  S.limitLearningEnabled = readBool('limitLearningEnabled', true);
  $('#limit-learning-toggle').prop('checked', S.limitLearningEnabled);
  ($('#max-learning-input') as JQuery<HTMLInputElement>).prop('disabled', !S.limitLearningEnabled);

  S.maxConcurrentLearning = readNum('maxConcurrentLearning', 4);
  ($('#max-learning-input') as JQuery<HTMLInputElement>).val(S.maxConcurrentLearning);

  S.autoPromoteLearned = readBool('autoPromoteLearned', true);
  $('#auto-promote-learned-toggle').prop('checked', S.autoPromoteLearned);
  $('#promotion-threshold-container').toggle(S.autoPromoteLearned);

  S.promotionThreshold = readNum('promotionThreshold', 10);
  ($('#promotion-threshold-input') as JQuery<HTMLInputElement>).val(S.promotionThreshold);

  S.retryFailedEnabled = readBool('retryFailed', false);
  retryFailedToggle.checked = S.retryFailedEnabled;

  // ── Timer / TPS ───────────────────────────────────────────────────────
  S.countdownModeEnabled = readBool('countdownMode', false);
  if (countdownModeToggle) countdownModeToggle.checked = S.countdownModeEnabled;

  S.countdownSeconds = readNum('countdownSeconds', 3);
  if (countdownSecondsSelect) countdownSecondsSelect.value = String(S.countdownSeconds);

  S.tpsFailEnabled = readBool('tpsFailEnabled', true);
  $('#tps-fail-toggle').prop('checked', S.tpsFailEnabled);

  S.tpsFailThreshold = readNum('tpsFailThreshold', 1);
  $('#tps-fail-threshold').val(String(S.tpsFailThreshold));

  S.countdownFailThreshold = readNum('countdownFailThreshold', 3);
  $('#countdown-fail-threshold').val(String(S.countdownFailThreshold));

  // ── Features ──────────────────────────────────────────────────────────
  S.alwaysScrambleTo = readBool('alwaysScrambleTo', false);
  $('#always-scramble-to-toggle').prop('checked', S.alwaysScrambleTo);

  S.overrideAlgEnabled = readBool('overrideAlgEnabled', true);
  $('#override-alg-toggle').prop('checked', S.overrideAlgEnabled);

  S.resetPracticeEnabled = readBool('resetPracticeEnabled', true);
  $('#reset-practice-toggle').prop('checked', S.resetPracticeEnabled);

  selectAllToggle.checked = readBool('ignoreSelection', false);

  // ── Statistics ─────────────────────────────────────────────────────────
  S.showCompactGraphEnabled = readBool('showCompactGraph', true);
  $('#show-compact-graph-toggle').prop('checked', S.showCompactGraphEnabled);
  $('#graph-display').toggle(S.showCompactGraphEnabled);

  S.showLastCaseTileEnabled = readBool('showLastCaseTile', false);
  $('#show-last-case-toggle').prop('checked', S.showLastCaseTileEnabled);

  S.showLastTimeEnabled = readBool('showLastTime', true);
  $('#show-last-time-toggle').prop('checked', S.showLastTimeEnabled);

  S.showPrevStatsEnabled = readBool('showPrevStats', false);
  $('#show-prev-stats-toggle').prop('checked', S.showPrevStatsEnabled);

  // ── Practice order ────────────────────────────────────────────────────
  S.queueSize = readNum('queueSize', 0);
  const queueSelect = document.getElementById('queue-size-select') as HTMLSelectElement;
  if (queueSelect) queueSelect.value = String(S.queueSize);

  S.colorRotationFrequency = readNum('colorRotationFrequency', 0);
  const colorRotFreqEl = document.getElementById('color-rotation-freq-select') as HTMLSelectElement;
  if (colorRotFreqEl) colorRotFreqEl.value = String(S.colorRotationFrequency);

  S.randomAlgorithms = readBool('sortRandom', false);
  randomOrderToggle.checked = S.randomAlgorithms;

  S.prioritizeSlowAlgs = readBool('sortSlow', false);
  prioritizeSlowToggle.checked = S.prioritizeSlowAlgs;

  S.prioritizeDifficultAlgs = readBool('sortDifficult', false);
  prioritizeDifficultToggle.checked = S.prioritizeDifficultAlgs;

  S.smartCaseSelection = readBool('sortSmart', false);
  smartCaseToggle.checked = S.smartCaseSelection;

  S.randomizeAUF = readBool('randomAUF', false);
  randomAUFToggle.checked = S.randomizeAUF;

  S.prioritizeFailedAlgs = readBool('prioritizeFailed', false);
  prioritizeFailedToggle.checked = S.prioritizeFailedAlgs;

  _isLoadingConfig = false;
}

/** Applies a zoom percentage to the TwistyPlayer cube element. */
function applyCubeZoom(pct: number) {
  const base = 384; // TwistyPlayer natural width
  const size = Math.round(base * pct / 100);
  $('#cube > twisty-player').css({ width: size + 'px', height: size + 'px' });
  if (cubeZoomValue) cubeZoomValue.textContent = pct + '%';
}

/** Registers all options/settings page event handlers and toggle listeners. */
export function initOptionsHandlers() {
  // #show-options nav button - navigates to the options/settings page
  $('#show-options').on('click', () => {
    $('#app-top').hide();
    $('#load-container').hide();
    $('#save-container').hide();
    $('#info').hide();
    $('#help').hide();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    $('#options-container').show();
  });

  // #gyroscope-toggle checkbox - enables/disables gyroscope cube orientation tracking
  gyroscopeToggle.addEventListener('change', () => {
    applyGyroscopeEnabled(gyroscopeToggle.checked);
  });

  // #control-panel-toggle checkbox - shows/hides the TwistyPlayer playback controls
  controlPanelToggle.addEventListener('change', () => {
    S.twistyPlayer.controlPanel = controlPanelToggle.checked ? 'bottom-row' : 'none';
    saveAllOptions();
  });

  // #hintFacelets-toggle checkbox - shows/hides translucent hint facelets on the cube
  hintFaceletsToggle.addEventListener('change', () => {
    S.twistyPlayer.hintFacelets = hintFaceletsToggle.checked ? 'floating' : 'none';
    saveAllOptions();
  });

  // #limit-learning-toggle checkbox - caps the number of concurrent "Learning" cases
  $('#limit-learning-toggle').on('change', function () {
    S.limitLearningEnabled = $(this).is(':checked');
    saveAllOptions();
    ($('#max-learning-input') as JQuery<HTMLInputElement>).prop('disabled', !S.limitLearningEnabled);
  });

  // #max-learning-input number field - sets the maximum concurrent learning cases (1-10)
  $('#max-learning-input').on('change', function () {
    const val = Math.max(1, Math.min(10, parseInt($(this).val() as string) || 4));
    $(this).val(val);
    S.maxConcurrentLearning = val;
    saveAllOptions();
  });

  // #retry-failed-toggle checkbox - re-queues failed cases for immediate retry
  retryFailedToggle.addEventListener('change', () => {
    S.retryFailedEnabled = retryFailedToggle.checked;
    saveAllOptions();
  });

  // #auto-promote-learning-toggle checkbox - auto-promotes unknown cases to "Learning" on presentation
  $('#auto-promote-learning-toggle').on('change', function () {
    S.autoPromoteLearning = $(this).is(':checked');
    saveAllOptions();
    $('#limit-learning-container').toggle(S.autoPromoteLearning);
  });

  // #auto-promote-learned-toggle checkbox - auto-promotes "Learning" cases to "Learned" after enough successes
  $('#auto-promote-learned-toggle').on('change', function () {
    S.autoPromoteLearned = $(this).is(':checked');
    saveAllOptions();
    if (S.autoPromoteLearned) {
      $('#promotion-threshold-container').show();
    } else {
      $('#promotion-threshold-container').hide();
    }
  });

  // #promotion-threshold-input number field - consecutive successes needed for auto-promotion (1-100)
  $('#promotion-threshold-input').on('change', function () {
    const val = Math.max(1, Math.min(100, parseInt($(this).val() as string) || 10));
    $(this).val(val);
    S.promotionThreshold = val;
    saveAllOptions();
  });

  // #rotate-colors-* checkboxes - set color rotation mode (none/vertical/upside/vertical+upside/any)
  $('#rotate-colors-vertical, #rotate-colors-upside').on('change', function () {
    // Uncheck "any" when a specific option is selected
    $('#rotate-colors-any').prop('checked', false);
    S.colorRotationMode = deriveColorRotationMode();
    saveAllOptions();
  });

  $('#rotate-colors-any').on('change', function () {
    if ($(this).is(':checked')) {
      // "any" is exclusive
      $('#rotate-colors-vertical').prop('checked', false);
      $('#rotate-colors-upside').prop('checked', false);
    }
    S.colorRotationMode = deriveColorRotationMode();
    saveAllOptions();
  });

  // #keep-rotation-toggle checkbox - keeps cube rotation after algorithms instead of showing rotate-back hint
  $('#keep-rotation-toggle').on('change', function () {
    S.keepRotationEnabled = $(this).is(':checked');
    saveAllOptions();
    if (!S.keepRotationEnabled) {
      resetmasterRepairFaceMap();
      $('#rotation-indicator').addClass('hidden');
    }
  });

  // #stare-delay-toggle checkbox - adds a delay between case completion and next case
  $('#stare-delay-toggle').on('change', function () {
    S.stareDelayEnabled = $(this).is(':checked');
    saveAllOptions();
  });

  // #stare-delay-seconds select - how many seconds to wait before next case
  $('#stare-delay-seconds').on('change', function () {
    S.stareDelaySeconds = parseFloat($(this).val() as string) || 3;
    saveAllOptions();
  });

  // #tps-fail-toggle checkbox - enables counting low TPS as a failure
  $('#tps-fail-toggle').on('change', function () {
    S.tpsFailEnabled = $(this).is(':checked');
    saveAllOptions();
  });

  // #tps-fail-threshold number field - minimum TPS required to count as a success (execution mode)
  $('#tps-fail-threshold').on('change', function () {
    S.tpsFailThreshold = parseFloat($(this).val() as string) || 1;
    saveAllOptions();
  });

  // #countdown-fail-threshold number field - minimum TPS required to count as a success (countdown mode)
  $('#countdown-fail-threshold').on('change', function () {
    S.countdownFailThreshold = parseFloat($(this).val() as string) || 1;
    saveAllOptions();
  });

  // #full-stickering-toggle checkbox - forces all cube faces visible regardless of category stickering
  fullStickeringToggle.addEventListener('change', () => {
    S.fullStickeringEnabled = fullStickeringToggle.checked;
    saveAllOptions();
    if (S.fullStickeringEnabled) {
      applyMaskToPlayer(S.twistyPlayer, buildStickeringMaskString('full'));
    } else {
      let category = $('#category-select').val()?.toString().toLowerCase() || 'pll';
      setStickering(category);
    }
  });

  // #flashing-indicator-toggle checkbox - enables/disables the fullscreen color flash on solve completion
  flashingIndicatorToggle.addEventListener('change', () => {
    S.flashingIndicatorEnabled = flashingIndicatorToggle.checked;
    saveAllOptions();
  });

  // #show-compact-graph-toggle checkbox - shows/hides the inline timing graph on the practice page
  $('#show-compact-graph-toggle').on('change', function () {
    S.showCompactGraphEnabled = $(this).is(':checked');
    saveAllOptions();
    $('#graph-display').toggle(S.showCompactGraphEnabled);
  });

  // #show-last-case-toggle checkbox - shows/hides the "last completed case" mini-tile
  $('#show-last-case-toggle').on('change', function () {
    S.showLastCaseTileEnabled = $(this).is(':checked');
    saveAllOptions();
    renderLastCaseTile();
  });

  // #show-last-time-toggle checkbox - shows/hides the previous solve time display
  $('#show-last-time-toggle').on('change', function () {
    S.showLastTimeEnabled = $(this).is(':checked');
    saveAllOptions();
    if (!S.showLastTimeEnabled) {
      $('#last-time-display').hide();
    } else if (S.lastSolveTime) {
      $('#last-time-display').show();
    }
  });

  // #show-prev-stats-toggle checkbox - shows stats of previous case instead of current
  $('#show-prev-stats-toggle').on('change', function () {
    S.showPrevStatsEnabled = $(this).is(':checked');
    saveAllOptions();
  });

  // #cube-zoom-slider range input - adjusts the displayed size of the TwistyPlayer cube
  if (cubeZoomSlider) {
    cubeZoomSlider.addEventListener('input', () => {
      const val = parseInt(cubeZoomSlider.value);
      saveAllOptions();
      applyCubeZoom(val);
    });
    // Always apply zoom on load (default 100% if no saved value)
    const savedZoom = localStorage.getItem('cubeZoom');
    const zoomPct = savedZoom ? parseInt(savedZoom) : 100;
    if (savedZoom) cubeZoomSlider.value = savedZoom;
    applyCubeZoom(zoomPct);
  }

  // #countdown-mode-toggle checkbox - enables the pre-solve countdown timer
  if (countdownModeToggle) {
    countdownModeToggle.addEventListener('change', () => {
      S.countdownModeEnabled = countdownModeToggle.checked;
      saveAllOptions();
      if (!S.countdownModeEnabled) {
        cancelCountdown();
      }
    });
  }

  // #countdown-seconds-select dropdown - sets the countdown duration in seconds
  if (countdownSecondsSelect) {
    countdownSecondsSelect.addEventListener('change', () => {
      S.countdownSeconds = parseInt(countdownSecondsSelect.value);
      saveAllOptions();
    });
  }

  // #show-alg-name-toggle checkbox - shows/hides the algorithm name above the alg display
  showAlgNameToggle.addEventListener('change', () => {
    S.showAlgNameEnabled = showAlgNameToggle.checked;
    saveAllOptions();
    updateTimesDisplay();
  });

  // #always-scramble-to-toggle checkbox - automatically scrambles to the starting position each case
  $('#always-scramble-to-toggle').on('change', () => {
    S.alwaysScrambleTo = $('#always-scramble-to-toggle').is(':checked');
    saveAllOptions();
  });

  // #override-alg-toggle checkbox - enables the "algorithm override" dialog when a different alg is detected
  $('#override-alg-toggle').on('change', () => {
    S.overrideAlgEnabled = $('#override-alg-toggle').is(':checked');
    saveAllOptions();
  });

  // #reset-practice-toggle checkbox - shows a reset button when mistakes are detected mid-solve
  $('#reset-practice-toggle').on('change', () => {
    S.resetPracticeEnabled = $('#reset-practice-toggle').is(':checked');
    saveAllOptions();
    if (S.resetPracticeEnabled && $('#alg-fix').is(':visible')) {
      $('#reset-practice-container').show();
    } else {
      $('#reset-practice-container').hide();
    }
  });

  // #visualization-select dropdown - switches the cube rendering mode (2D, 3D, PG3D, experimental LL)
  $('#visualization-select').on('change', () => {
    const visualizationValue = $('#visualization-select').val() || 'PG3D';
    saveAllOptions();
    switch (visualizationValue) {
      case '2D':
        S.twistyPlayer.visualization = '2D';
        break;
      case '3D':
        S.twistyPlayer.visualization = '3D';
        S.twistyPlayer.cameraLatitude = 30;
        break;
      case 'PG3D':
        S.twistyPlayer.visualization = 'PG3D';
        S.twistyPlayer.cameraLatitude = 30;
        break;
      case 'experimental-2D-LL':
        S.twistyPlayer.visualization = 'experimental-2D-LL';
        break;
      case 'experimental-2D-LL-face':
        S.twistyPlayer.visualization = 'experimental-2D-LL-face';
        break;
      default:
        S.twistyPlayer.visualization = 'PG3D';
    }
    // fix for 3D visualization not animating after visualization change
    if (S.conn && (visualizationValue as string).includes('3D')) {
      S.forceFix = true;
      requestAnimationFrame(amimateCubeOrientation);
    } else {
      S.forceFix = false;
    }
    // Sync mirror player visualization (mirror only supports 3D modes)
    if (S.twistyMirror) {
      const is3D = (visualizationValue as string).includes('3D') || visualizationValue === '3D';
      const mirrorViz = is3D ? visualizationValue as any : 'PG3D';
      (S.twistyMirror as any).style.display = is3D ? '' : 'none';
      if (is3D) S.twistyMirror.visualization = mirrorViz;
    }
  });

  // #backview-select dropdown - configures the back-view display mode (none, side-by-side, top-right, mirror)
  $('#backview-select').on('change', () => {
    const backviewValue = $('#backview-select').val();
    saveAllOptions();
    // Remove mirror view if switching away
    if (backviewValue !== 'mirror-view') {
      removeMirrorView();
    }
    switch (backviewValue) {
      case 'none':
        S.twistyPlayer.backView = 'none';
        break;
      case 'side-by-side':
        S.twistyPlayer.backView = 'side-by-side';
        break;
      case 'top-right':
        S.twistyPlayer.backView = 'top-right';
        break;
      case 'mirror-view':
        S.twistyPlayer.backView = 'none';
        createMirrorView();
        // Sync stickering to mirror immediately after creation
        setStickering($('#category-select').val()?.toString() || '');
        break;
      default:
        S.twistyPlayer.backView = 'none';
    }
  });

  // Dark mode initialization + #dark-mode-toggle checkbox - toggles dark/light theme
  if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    darkModeToggle.checked = true;
  } else {
    document.documentElement.classList.remove('dark');
    darkModeToggle.checked = false;
  }

  darkModeToggle.addEventListener('change', () => {
    document.documentElement.classList.toggle('dark', darkModeToggle.checked);
    saveAllOptions();
    updateAlgDisplay();
  });

  /** Turns off all sorting-mode toggles and state flags except the given one.
   *  Random is excluded from clearing - it's additive to other modes. */
  function clearSortingModes(except?: 'slow' | 'difficult' | 'smart') {
    if (except !== 'slow')      { prioritizeSlowToggle.checked = false; S.prioritizeSlowAlgs = false; }
    if (except !== 'difficult') { prioritizeDifficultToggle.checked = false; S.prioritizeDifficultAlgs = false; }
    if (except !== 'smart')     { smartCaseToggle.checked = false; S.smartCaseSelection = false; }
  }

  /** Saves all options in the options panel to localStorage in one go. */
  function saveAllOptions() {
    if (_isLoadingConfig) return;
    // Visual
    localStorage.setItem('gyroscope', S.gyroscopeEnabled ? 'enabled' : 'disabled');
    localStorage.setItem('control-panel', controlPanelToggle.checked ? 'bottom-row' : 'none');
    localStorage.setItem('hintFacelets', hintFaceletsToggle.checked ? 'floating' : 'none');
    localStorage.setItem('fullStickering', String(S.fullStickeringEnabled));
    localStorage.setItem('flashingIndicatorEnabled', String(S.flashingIndicatorEnabled));
    localStorage.setItem('visualization', ($('#visualization-select').val() || 'PG3D') as string);
    localStorage.setItem('backview', ($('#backview-select').val() || 'none') as string);
    localStorage.setItem('cubeZoom', cubeZoomSlider?.value || '100');
    localStorage.setItem('stareDelay', String(S.stareDelayEnabled));
    localStorage.setItem('stareDelaySeconds', String(S.stareDelaySeconds));
    // Learning
    localStorage.setItem('autoPromoteLearning', String(S.autoPromoteLearning));
    localStorage.setItem('autoPromoteLearned', String(S.autoPromoteLearned));
    localStorage.setItem('limitLearningEnabled', String(S.limitLearningEnabled));
    localStorage.setItem('maxConcurrentLearning', String(S.maxConcurrentLearning));
    localStorage.setItem('promotionThreshold', String(S.promotionThreshold));
    localStorage.setItem('retryFailed', String(S.retryFailedEnabled));
    localStorage.setItem('countdownMode', String(S.countdownModeEnabled));
    localStorage.setItem('countdownSeconds', String(S.countdownSeconds));
    localStorage.setItem('tpsFailEnabled', String(S.tpsFailEnabled));
    localStorage.setItem('tpsFailThreshold', String(S.tpsFailThreshold));
    localStorage.setItem('countdownFailThreshold', String(S.countdownFailThreshold));
    // Practice order
    localStorage.setItem('sortRandom', String(S.randomAlgorithms));
    localStorage.setItem('sortSlow', String(S.prioritizeSlowAlgs));
    localStorage.setItem('sortDifficult', String(S.prioritizeDifficultAlgs));
    localStorage.setItem('sortSmart', String(S.smartCaseSelection));
    localStorage.setItem('randomAUF', String(S.randomizeAUF));
    localStorage.setItem('prioritizeFailed', String(S.prioritizeFailedAlgs));
    localStorage.setItem('queueSize', String(S.queueSize));
    localStorage.setItem('colorRotationFrequency', String(S.colorRotationFrequency));
    localStorage.setItem('ignoreSelection', String(selectAllToggle.checked));
    // Features
    localStorage.setItem('showAlgName', String(S.showAlgNameEnabled));
    localStorage.setItem('alwaysScrambleTo', String(S.alwaysScrambleTo));
    localStorage.setItem('overrideAlgEnabled', String(S.overrideAlgEnabled));
    localStorage.setItem('resetPracticeEnabled', String(S.resetPracticeEnabled));
    localStorage.setItem('rotateColorsMode', S.colorRotationMode);
    localStorage.setItem('keepRotation', String(S.keepRotationEnabled));
    localStorage.setItem('phantomMode', String(S.phantomModeEnabled));
    // Statistics
    localStorage.setItem('showCompactGraph', String(S.showCompactGraphEnabled));
    localStorage.setItem('showLastCaseTile', String(S.showLastCaseTileEnabled));
    localStorage.setItem('showLastTime', String(S.showLastTimeEnabled));
    localStorage.setItem('showPrevStats', String(S.showPrevStatsEnabled));
    // Theme
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }

  // #random-order-toggle checkbox - randomizes the order of algorithm presentation (additive to other modes)
  randomOrderToggle.addEventListener('change', () => {
    S.randomAlgorithms = randomOrderToggle.checked;
    saveAllOptions();
  });

  // #random-auf-toggle checkbox - applies a random AUF (U/U'/U2) before each case
  randomAUFToggle.addEventListener('change', () => {
    S.randomizeAUF = randomAUFToggle.checked;
    saveAllOptions();
  });

  // #prioritize-slow-toggle checkbox - presents slower cases more frequently
  prioritizeSlowToggle.addEventListener('change', () => {
    clearSortingModes('slow');
    S.prioritizeSlowAlgs = prioritizeSlowToggle.checked;
    saveAllOptions();
  });

  // #prioritize-difficult-toggle checkbox - presents most-failed cases first
  prioritizeDifficultToggle.addEventListener('change', () => {
    clearSortingModes('difficult');
    S.prioritizeDifficultAlgs = prioritizeDifficultToggle.checked;
    saveAllOptions();
  });

  // #smart-case-toggle checkbox - smart mix of slow + difficult prioritisation
  smartCaseToggle.addEventListener('change', () => {
    clearSortingModes('smart');
    S.smartCaseSelection = smartCaseToggle.checked;
    saveAllOptions();
  });

  // #queue-size-select - fixed queue size per cycle
  const queueSizeSelect = document.getElementById('queue-size-select') as HTMLSelectElement;
  if (queueSizeSelect) {
    queueSizeSelect.addEventListener('change', () => {
      S.queueSize = parseInt(queueSizeSelect.value);
      saveAllOptions();
    });
  }

  // #color-rotation-freq-select - how often color rotation changes
  const colorRotFreqSelect = document.getElementById('color-rotation-freq-select') as HTMLSelectElement;
  if (colorRotFreqSelect) {
    colorRotFreqSelect.addEventListener('change', () => {
      S.colorRotationFrequency = parseInt(colorRotFreqSelect.value);
      S.colorRotationCounter = 0;
      saveAllOptions();
    });
  }

  // #prioritize-failed-toggle checkbox - presents failed cases more frequently
  prioritizeFailedToggle.addEventListener('change', () => {
    S.prioritizeFailedAlgs = prioritizeFailedToggle.checked;
    saveAllOptions();
  });

  // #phantom-mode-toggle checkbox - grays out all stickers after first move
  const phantomModeToggle = document.getElementById('phantom-mode-toggle') as HTMLInputElement;
  if (phantomModeToggle) {
    phantomModeToggle.checked = S.phantomModeEnabled;
    phantomModeToggle.addEventListener('change', () => {
      S.phantomModeEnabled = phantomModeToggle.checked;
      saveAllOptions();
    });
  }
}
