import $ from 'jquery';
import { TwistyPlayer } from 'cubing/twisty';
import * as THREE from 'three';
import { S, _visualMoveLog, _flashLog, HOME_ORIENTATION } from './state';
import {
  buildStickeringMaskString, buildStickeringMaskFromFacelets,
} from './faceMasking';
import {
  getOrientationChange, isIdentityFaceMap, invertFaceMap,
} from './faceMap';

// ── Stickering helpers ─────────────────────────────────────────────────

/** Returns the stickering mask for a category. If fullStickeringEnabled, returns all-regular mask. */
export function getStickeringMaskForCategory(category: string): any {
  if (S.fullStickeringEnabled) return buildStickeringMaskFromFacelets(new Set<number>());
  return buildStickeringMaskString(category);
}

/** Sets the stickering mask on a TwistyPlayer element using the per-facelet object API. */
export function applyMaskToPlayer(player: any, mask: any): void {
  player.experimentalStickeringMaskOrbits = mask;
  // Store as data attribute for test access (the JS property is write-only)
  if (player.dataset) player.dataset.stickeringMask = JSON.stringify(mask);
}

/** Applies the correct stickering mask to all TwistyPlayers for a given category. */
export function setStickering(category: string): void {
  const mask = getStickeringMaskForCategory(category);
  $('#cube > twisty-player').each(function () {
    applyMaskToPlayer(this as HTMLElement, mask);
  });
}

// ── Mirror view ────────────────────────────────────────────────────────

/** Creates a mirror TwistyPlayer beside the main cube and syncs its camera angle. */
export function createMirrorView() {
  if (S.twistyMirror) return;
  const hf = localStorage.getItem('hintFacelets') === 'floating' ? 'floating' : 'none';
  const currentCategory = ($('#category-select').val() as string) || '';
  const currentMask = getStickeringMaskForCategory(currentCategory);
  const savedViz = localStorage.getItem('visualization') || 'PG3D';
  const mirrorViz = (savedViz === '3D' || savedViz === 'PG3D') ? savedViz : 'PG3D';
  S.twistyMirror = new TwistyPlayer({
    puzzle: '3x3x3',
    visualization: mirrorViz as any,
    alg: '',
    experimentalSetupAnchor: 'start',
    background: 'none',
    controlPanel: 'none',
    viewerLink: 'none',
    hintFacelets: hf,
    experimentalDragInput: 'none',
    cameraLatitude: 30,
    cameraLongitude: 35,
    tempoScale: 5,
  });
  applyMaskToPlayer(S.twistyMirror, currentMask);
  $('#cube').prepend(S.twistyMirror);
  S.twistyMirrorScene = null;
  S.twistyMirrorVantage = null;
  const savedZoom = localStorage.getItem('cubeZoom');
  const zoomPct = savedZoom ? parseInt(savedZoom) : 100;
  const sz = Math.round(384 * zoomPct / 100);
  (S.twistyMirror as any).style.width = sz + 'px';
  (S.twistyMirror as any).style.height = sz + 'px';

  const orbitCoords = S.twistyPlayer.experimentalModel.twistySceneModel.orbitCoordinates;
  const listener = (coords: { latitude: number; longitude: number; distance: number }) => {
    if (S.twistyMirror) {
      S.twistyMirror.cameraLatitude = coords.latitude;
      S.twistyMirror.cameraLongitude = -coords.longitude;
      S.twistyMirror.cameraDistance = coords.distance;
    }
  };
  orbitCoords.addFreshListener(listener);
  S.mirrorOrbitListener = () => orbitCoords.removeFreshListener(listener);

  // Restart animation loop for mirror gyroscope orientation
  requestAnimationFrame(amimateCubeOrientation);

  // Sync mirror with the current display algorithm (may be non-empty if a case is active)
  if (S.currentDisplayAlg) {
    syncMirrorAlg(S.currentDisplayAlg);
  }
}

/** Removes the mirror TwistyPlayer and cleans up the camera-sync listener. */
export function removeMirrorView() {
  if (S.mirrorOrbitListener) {
    S.mirrorOrbitListener();
    S.mirrorOrbitListener = null;
  }
  if (S.twistyMirror) {
    S.twistyMirror.remove();
    S.twistyMirror = null;
    S.twistyMirrorScene = null;
    S.twistyMirrorVantage = null;
  }
}

/** Syncs the mirror player's displayed algorithm with the main player. */
export function syncMirrorAlg(alg: any) {
  if (S.twistyMirror) S.twistyMirror.alg = alg;
}

// ── Visual move logging / forwarding ───────────────────────────────────

/** Sends a move to visual player(s) 
 The visual cube's displayAlg already includes the color y-rotation,
 so moves are sent in the alg frame without further color-rotation transformation. */
export async function addVisualMove(move: string, cancel = false) {
  if (S.__testMode) 
    {
    // for test we just log the moves
    _visualMoveLog.push({ move, cancel }); 
    return;
  }

  S.twistyPlayer.experimentalAddMove(move, { cancel });
  if (S.twistyMirror) S.twistyMirror.experimentalAddMove(move, { cancel });
}

// ── Stickering mask ────────────────────────────────────────────────────

/** Inverts a rotation algorithm string: reverses move order, inverts each move. */
function invertRotationString(s: string): string {
  return s.trim().split(/\s+/).reverse().map(move => {
    if (move.includes("2")) return move; // double moves are self-inverse
    if (move.includes("'")) return move.replace("'", "");
    return move + "'";
  }).join(" ");
}

/** Applies stickering mask to all active TwistyPlayers, using our own facelet-based masks. */
export function applyStickeringMask(ignorePiecesStr?: string) {
  const players = [S.twistyPlayer, ...(S.twistyMirror ? [S.twistyMirror] : [])];
  const category = $('#category-select').val()?.toString() || '';
  const effectiveCategory = S.currentMasking || category;
  // The display alg prepends currentColorRotation with setupAnchor='start'.
  // The mask facelets are defined in the canonical (solved) frame, so we need to
  // rotate them by the inverse of the visual rotation to match the displayed cube.
  const rawRot = (S.rotateColorsEnabled && S.currentColorRotation) ? S.currentColorRotation : undefined;
  const invertedRot = rawRot ? invertRotationString(rawRot) : undefined;
  const mask = S.fullStickeringEnabled
    ? buildStickeringMaskString('full')
    : buildStickeringMaskString(effectiveCategory, ignorePiecesStr, invertedRot);
  for (const player of players) {
    applyMaskToPlayer(player, mask);
  }
}

// ── Orientation hint ───────────────────────────────────────────────────

const ROTATION_AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
];

/** Computes the net orientation change of an algorithm and returns a readable rotation hint (e.g. "x y'"), or null if no rotation. */
export function getAlgOrientationHint(algString: string): string | null {
  if (!algString) return null;
  const netQ = new THREE.Quaternion();
  const moves = algString.split(/\s+/).filter(m => m.length > 0);
  for (const move of moves) {
    const clean = move.replace(/[()]/g, '');
    const change = getOrientationChange(clean);
    if (change) {
      const angle = -(Math.PI / 2) * change[1];
      const rotation = new THREE.Quaternion().setFromAxisAngle(ROTATION_AXES[change[0]], angle);
      netQ.multiply(rotation);
    }
  }
  if (Math.abs(netQ.dot(new THREE.Quaternion())) > 0.999) return null;

  const inv = netQ.clone().invert();

  const r = (ax: number, qt: number) => new THREE.Quaternion().setFromAxisAngle(ROTATION_AXES[ax], -(Math.PI / 2) * qt);
  const qx = r(0, 1), qxp = r(0, -1), qx2 = r(0, 2);
  const qy = r(1, 1), qyp = r(1, -1), qy2 = r(1, 2);
  const qz = r(2, 1), qzp = r(2, -1);
  const mul = (a: THREE.Quaternion, b: THREE.Quaternion) => a.clone().multiply(b);

  const candidates: [string, THREE.Quaternion][] = [
    ["y", qy], ["y'", qyp], ["y2", qy2],
    ["x", qx], ["x y", mul(qx, qy)], ["x y'", mul(qx, qyp)], ["x y2", mul(qx, qy2)],
    ["x'", qxp], ["x' y", mul(qxp, qy)], ["x' y'", mul(qxp, qyp)], ["x' y2", mul(qxp, qy2)],
    ["x2", qx2], ["x2 y", mul(qx2, qy)], ["x2 y'", mul(qx2, qyp)], ["x2 y2", mul(qx2, qy2)],
    ["z", qz], ["z y", mul(qz, qy)], ["z y'", mul(qz, qyp)], ["z y2", mul(qz, qy2)],
    ["z'", qzp], ["z' y", mul(qzp, qy)], ["z' y'", mul(qzp, qyp)], ["z' y2", mul(qzp, qy2)],
  ];
  for (const [label, q] of candidates) {
    if (Math.abs(inv.dot(q)) > 0.999) return label;
  }
  return null;
}

/** Shows the orientation-hint bar with a flashing red/orange animation. */
export function showOrientationHint() {
  const el = $('#orientation-hint');
  el.show();
  el.css('background-color', 'orange');
  setTimeout(() => el.css('background-color', 'red'), 150);
  setTimeout(() => el.css('background-color', 'orange'), 300);
  setTimeout(() => el.css('background-color', 'red'), 550);
  setTimeout(() => el.css('background-color', 'orange'), 700);
}

/** Color map from canonical face name to CSS color. */
const FACE_COLORS: Record<string, string> = {
  U: '#ffffff', D: '#ffdf3f', F: '#06bb00', B: '#1472ff', R: '#ff4c3ff1', L: '#ff9532',
};

/** Resets the masterRepairFaceMap to identity (no rotation).  */
export function resetmasterRepairFaceMap() {
    S.masterRepairFaceMap = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
}

/** Updates the rotation indicator showing current top/front colors. */
export function updateRotationIndicator() {
  if (!S.keepRotationEnabled || isIdentityFaceMap(S.masterRepairFaceMap)) {
    $('#rotation-indicator').addClass('hidden');
    return;
  }
  // masterRepairFaceMap[ganFace] = canonical face.
  // The user's physical top/front = GAN U/F -> that canonical face's color.
  const invertedMasterRepairFaceMap = invertFaceMap(S.masterRepairFaceMap)
  const topFace = invertedMasterRepairFaceMap["U"];
  const frontFace = invertedMasterRepairFaceMap["F"];
  $('#rotation-top-color').css('background-color', FACE_COLORS[topFace] || '#ccc');
  $('#rotation-front-color').css('background-color', FACE_COLORS[frontFace] || '#ccc');
  $('#rotation-indicator').removeClass('hidden');
}

/** Updates the orientation-hint display based on the last completed algorithm. */
export function updateOrientationHint() {
  updateRotationIndicator();
  const hint = getAlgOrientationHint(S.lastCompletedAlgStr);
  if (hint && !S.keepRotationEnabled) {
    $('#orientation-hint-moves').text(hint);
    $('#orientation-reset-btn').addClass('hidden');
    showOrientationHint();
  } else {
    $('#orientation-hint').hide();
    $('#orientation-reset-btn').addClass('hidden');
  }
}

// ── Orientation animation ──────────────────────────────────────────────

/** Resets the software-rendered cube orientation back to identity (home position). */
export function resetVirtualOrientation() {
  S.virtualOrientation.copy(HOME_ORIENTATION);
  S.cubeQuaternion.copy(HOME_ORIENTATION);
  if (!S.hasGyroData && S.twistyScene) {
    S.twistyScene.quaternion.copy(HOME_ORIENTATION);
    S.twistyVantage?.render();
  }
}

/** Main animation loop: constantly slerps the 3D scene toward the gyroscope quaternion. */
export async function amimateCubeOrientation() {
  if (!S.twistyScene || !S.twistyVantage || S.forceFix) {
    var vantageList = await S.twistyPlayer.experimentalCurrentVantages();
    const vantageArr = [...vantageList];
    if (vantageArr.length > 0) {
      S.twistyVantage = vantageArr[0];
      S.twistyScene = await S.twistyVantage.scene.scene();
    }
    if (S.forceFix) S.forceFix = false;
  }
  if (S.twistyScene) {
    if (S.gyroscopeEnabled) {
      S.twistyScene.quaternion.slerp(S.cubeQuaternion, 0.25);
    } else {
      S.twistyScene.quaternion.slerp(HOME_ORIENTATION, 0.25);
    }
    S.twistyVantage.render();
  }

  if (S.twistyMirror) {
    if (!S.twistyMirrorScene || !S.twistyMirrorVantage) {
      var mirrorVantageList = await S.twistyMirror.experimentalCurrentVantages();
      const mirrorArr = [...mirrorVantageList];
      if (mirrorArr.length > 0) {
        const vantage = mirrorArr[0]!;
        S.twistyMirrorVantage = vantage;
        S.twistyMirrorScene = await vantage.scene!.scene();
      }
    }
    if (S.twistyMirrorScene && S.twistyMirrorVantage) {
      if (S.gyroscopeEnabled) {
        S.twistyMirrorScene.quaternion.slerp(S.cubeQuaternion, 0.25);
      } else {
        S.twistyMirrorScene.quaternion.slerp(HOME_ORIENTATION, 0.25);
      }
      S.twistyMirrorVantage.render();
    }
  }

  requestAnimationFrame(amimateCubeOrientation);
}

// ── Flashing indicator ─────────────────────────────────────────────────

let _flashHideTimeout: ReturnType<typeof setTimeout> | null = null;

/** Briefly flashes a colored fullscreen indicator (green=success, red=fail, yellow=TPS-fail). */
export function showFlashingIndicator(color: string, duration: number) {
  _flashLog.push({ color, duration });
  const flashingIndicator = document.getElementById('flashing-indicator');
  if (flashingIndicator && S.flashingIndicatorEnabled) {
    if (_flashHideTimeout) { clearTimeout(_flashHideTimeout); _flashHideTimeout = null; }
    flashingIndicator.style.backgroundColor = color;
    flashingIndicator.classList.remove('hidden');
    _flashHideTimeout = setTimeout(() => {
      flashingIndicator.classList.add('hidden');
      _flashHideTimeout = null;
    }, duration);
  }
}