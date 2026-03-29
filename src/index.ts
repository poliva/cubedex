import './tailwind.css'
import './pwa-register'

import $ from 'jquery';
import { TwistyPlayer } from 'cubing/twisty';
import min2phase from './lib/min2phase';
import { fixOrientation, initializeDefaultAlgorithms, applyMaskToPlayer, buildStickeringMaskString } from './functions';
import { S } from './state';
import { amimateCubeOrientation } from './visualization';
import { resetAlg, updateAlgDisplay } from './trainer';
import { initTileHandlers } from './tile';
import { initDeviceHandlers } from './handlers/handlersDevice';
import { initStatsModalHandlers } from './handlers/handlersStatsModal';
import { initOverrideHandlers } from './handlers/handlersOverride';
import { initEditSaveHandlers } from './handlers/handlersEditSave';
import { initLoadHandlers } from './handlers/handlersLoad';
import { initOptionsHandlers, loadConfiguration, renameOldKeys, initRichTooltips } from './handlers/handlersOptions';
import { initMainHandlers } from './handlers/handlersMain';
import { initTestHarness } from './testHarness';

// ── Solver initialisation ──────────────────────────────────────────────
min2phase.initFull();

// ── TwistyPlayer setup ─────────────────────────────────────────────────
const savedCameraAngle = JSON.parse(localStorage.getItem('cameraAngle') || 'null');

S.twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  viewerLink: 'none',
  hintFacelets: 'floating',
  experimentalDragInput: 'auto',
  cameraLatitude: savedCameraAngle?.latitude ?? 30,
  cameraLongitude: savedCameraAngle?.longitude ?? -35,
  cameraLatitudeLimit: 50,
  tempoScale: 5,
});
applyMaskToPlayer(S.twistyPlayer, buildStickeringMaskString('full'));

S.twistyTracker = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  experimentalDragInput: 'none',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
  tempoScale: 5
});

$('#cube').append(S.twistyPlayer);

// Persist camera angle to localStorage when user drags the cube
S.twistyPlayer.experimentalModel.twistySceneModel.orbitCoordinates.addFreshListener(
  (coords: { latitude: number; longitude: number; distance: number }) => {
    localStorage.setItem('cameraAngle', JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }));
  }
);

requestAnimationFrame(amimateCubeOrientation);

// ── KPattern listener - keeps myKpattern current when idle, and detects
// "return to initial state" during practice.  During active algorithm
// execution, handleMoveEvent manages myKpattern (Layer 2).
S.twistyTracker.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  if (S.patternStates.length === 0) {
    // No algorithm loaded - keep myKpattern in sync with the physical cube.
    S.myKpattern = kpattern;
  } else if (S.currentMoveIndex === 0 && !S.stareDelayActive && S.initialPatternState && fixOrientation(kpattern).isIdentical(S.initialPatternState)) {
    console.log("Returning to initial state");
    S.myKpattern = S.initialstate;
    S.currentMoveIndex = -1;
    resetAlg();
    updateAlgDisplay();
  }
});

// ── Load default algorithm data ────────────────────────────────────────
initializeDefaultAlgorithms();

// ── Register all handler modules ───────────────────────────────────────
initDeviceHandlers();
initStatsModalHandlers();
initOverrideHandlers();
initEditSaveHandlers();
initLoadHandlers();
initOptionsHandlers();
initMainHandlers();
initTileHandlers();

// ── Apply persisted configuration after DOM is ready ───────────────────
$(function () {
  renameOldKeys();
  loadConfiguration();
  initRichTooltips();
});

// ── Test interface - allows Playwright tests to simulate cube moves ────
initTestHarness();
