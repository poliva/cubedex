import $ from 'jquery';
import * as THREE from 'three';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { SmartCubeEvent, MacAddressProvider, cubeTimestampCalcSkew, getCachedMacForDevice } from 'smartcube-web-bluetooth';
import { S, SOLVED_STATE, HOME_ORIENTATION, _visualMoveLog, SmartCubeMove } from '../state';
import { faceletsToPattern, patternToFacelets } from '../utils';
import {
  expandNotation, fixOrientation, partialStateEquals, buildAlgFaceMap,
  transformMoveByFaceMap, getInverseMove, isCubeRotation, composeFaceMaps,
  algToId, getSliceFaceComponents, getSliceForComponents, applyMaskToPlayer,
  notationallyAlgEquivalent, buildStickeringMaskFromFacelets, ALL_FACELETS,
  trailingWholeCubeRotationMoveCount, updateSliceOrientation, remapMoveForPlayer,
} from '../functions';
import { releaseWakeLock, updateHeaderResetGyroState } from './handlersDevice';
import { addVisualMove, syncMirrorAlg, applyStickeringMask } from '../visualization';
import { resetAlg, updateAlgDisplay, switchToNextAlgorithm, transitionToNextCase } from '../trainer';
import { setTimerState } from '../timer';
import { updateTimesDisplay } from '../statsPanel';
import { setGyroscopeUiFromSupported, setGyroscopeToggleDisabled } from './handlersOptions';
import min2phase from '../lib/min2phase.js';

/** Computes a scramble sequence to bring the cube from current state to the algorithm's start position. */
export function getScrambleToSolution(alg: string, state: import('cubing/kpuzzle').KPattern) {
  let faceCube = patternToFacelets(fixOrientation(state));
  var solvedcube = min2phase.solve(faceCube);
  let inverseAlg = Alg.fromString(expandNotation(alg).replace(/[()]/g, '')).invert();
  let finalState = Alg.fromString(solvedcube + ' ' + inverseAlg.toString()).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 });
  let result = Alg.fromString(min2phase.solve(patternToFacelets(fixOrientation(faceletsToPattern(SOLVED_STATE).applyAlg(finalState))))).invert();
  return result.experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().trim();
}

/** Simplifies an alg string (strip parens, cancel moves, normalize U2''U2). */
export function simplifyAlg(alg: string): string {
  return Alg.fromString(alg.replace(/[()]/g, '')).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().replace(/2'/g, '2').replace(/\s+/g, ' ').trim();
}

/** Processes gyroscope data from the GAN cube and updates the 3D scene quaternion. */
export async function handleGyroEvent(event: SmartCubeEvent) {
  if (event.type == "GYRO") {
    S.hasGyroData = true;
    if (S.conn?.capabilities.gyroscope && !S.gyroscopeEnabled) {
      setGyroscopeUiFromSupported(true);
    }
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
    if (!S.basis) {
      S.basis = quat.clone().conjugate();
    }
    S.cubeQuaternion.copy(quat.premultiply(S.basis).premultiply(HOME_ORIENTATION));
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

// Serialise move processing so that rapid GAN events (e.g. the two face
// moves that make up a slice move like S -> F' + B) cannot interleave at
// the async bug-detection await and corrupt shared state.
let _moveChain = Promise.resolve();

/** Set to true to enable verbose move-handler logging to the browser console. */
const __LOG_MOVES = false;

/** Logs a move-handler debug message to the console and to S.moveDebugLog. */
function log_move(msg: string) {
  if (__LOG_MOVES) console.log(`[MoveHandler] ${msg}`);
  S.moveDebugLog.push(msg);
  if (S.moveDebugLog.length > 200) S.moveDebugLog.splice(0, S.moveDebugLog.length - 200);
}

/** Flush the pending slice-vis buffer as a regular wrong move and clear timeout. */
function flushSliceVisBuffer() {
  if (S.pendingSliceVisTimeout) { clearTimeout(S.pendingSliceVisTimeout); S.pendingSliceVisTimeout = null; }
  if (S.pendingSliceVis) {
    addVisualMove(S.pendingSliceVis.visualMove, false);
    S.pendingSliceVis = null;
  }
}

/** Clear the pending slice-vis buffer silently (no visualization) and clear timeout. */
function clearSliceVisBuffer() {
  if (S.pendingSliceVisTimeout) { clearTimeout(S.pendingSliceVisTimeout); S.pendingSliceVisTimeout = null; }
  S.pendingSliceVis = null;
}

/** Buffer a slice-vis move and start auto-flush timeout (~400ms). */
function bufferSliceVis(logicalMove: string, visualMove: string, isUndo: boolean) {
  clearSliceVisBuffer();
  S.pendingSliceVis = { logicalMove, visualMove, isUndo };
  S.pendingSliceVisTimeout = setTimeout(() => {
    S.pendingSliceVisTimeout = null;
    if (S.pendingSliceVis) {
      log_move(`SLICE-VIS auto-flush after timeout: ${S.pendingSliceVis.visualMove}`);
      addVisualMove(S.pendingSliceVis.visualMove, false);
      S.pendingSliceVis = null;
    }
  }, 400);
}

/** Checks if a forward match from prevIndex to newIndex is a sequential step (only rotation moves in between). */
function isSequentialForward(prevIndex: number, newIndex: number): boolean {
  if (newIndex <= prevIndex) return false;
  for (let k = prevIndex + 1; k < newIndex; k++) {
    const m = S.userAlg[k]?.replace(/[()]/g, '');
    if (m && !isCubeRotation(m)) return false;
  }
  return true;
}

/**
 * Unified visualization handler - called AFTER logic has determined the match result.
 * Follows the decision tree from visu_plan.md:
 *   1. Forward match: wide/slice/double get their alg-name; single face moves pass through.
 *   2. Undo match: mirror of forward - inverse of the undone alg move.
 *   3. Error/wrong moves: transform through "core rotation" (buildAlgFaceMap),
 *      with slice buffering and partial-double special cases.
 *
 * @param logicalAlgMove  The GAN move (after masterRepairFaceMap transform) - used for matching/slice buffering
 * @param matchType     What the logic layer determined
 * @param prevIndex     S.currentMoveIndex BEFORE this move was processed
 */
function applyVisualization(
  logicalAlgMove: string,
  matchType: 'forward' | 'undo' | 'same' | 'undo-initial' | 'wrong',
  prevIndex: number,
) {
  // ── Forward match ──────────────────────────────────────────────────
  if (matchType === 'forward') {
    if (isSequentialForward(prevIndex, S.currentMoveIndex)) {
      // Send intermediate cube rotations (y, x, z) that were skipped
      for (let j = prevIndex + 1; j < S.currentMoveIndex; j++) {
        const m = S.userAlg[j]?.replace(/[()]/g, '');
        if (m && isCubeRotation(m)) addVisualMove(m);
      }
      const algMove = S.userAlg[S.currentMoveIndex]?.replace(/[()]/g, '');
      if (!algMove) return;
      if (algMove.includes('2')) {
        // Double move: follow user's actual turn direction (allow both directions)
        const algFace = algMove.replace(/[2']/g, '');
        const userPrime = logicalAlgMove.includes("'");
        addVisualMove(userPrime ? algFace + "'" : algFace);
      } else {
        // Wide, slice, single: send the alg move name directly
        // (wide/slice names move the cube visually and implicitly update the "core rotation")
        addVisualMove(algMove);
      }
    } else {
      // Jump match: user reached this state non-sequentially - use core rotation transform
      const faceMap = buildAlgFaceMap(S.userAlg, S.currentMoveIndex);
      addVisualMove(transformMoveByFaceMap(logicalAlgMove, faceMap));
    }
    return;
  }

  // ── Undo match ─────────────────────────────────────────────────────
  if (matchType === 'undo') {
    const undoneMove = S.userAlg[prevIndex]?.replace(/[()]/g, '');
    if (!undoneMove) return;
    if (undoneMove.includes('2')) {
      addVisualMove(getInverseMove(undoneMove.replace('2', '')), true);
    } else {
      addVisualMove(getInverseMove(undoneMove), true);
    }
    // Undo any intermediate cube rotations (in reverse order)
    for (let j = prevIndex - 1; j > S.currentMoveIndex; j--) {
      const m = S.userAlg[j]?.replace(/[()]/g, '');
      if (m && isCubeRotation(m)) addVisualMove(getInverseMove(m), true);
    }
    return;
  }

  // ── Same-index match (e.g. wrong move that loops back to same state) ──
  if (matchType === 'same') {
    const faceMap = buildAlgFaceMap(S.userAlg, S.currentMoveIndex);
    addVisualMove(transformMoveByFaceMap(logicalAlgMove, faceMap), true);
    return;
  }

  // ── Undo to initial (before first move) ────────────────────────────
  if (matchType === 'undo-initial') {
    const undoneMove = S.userAlg[prevIndex]?.replace(/[()]/g, '');
    if (!undoneMove) return;
    if (undoneMove.includes('2')) {
      addVisualMove(getInverseMove(undoneMove.replace('2', '')), true);
    } else {
      addVisualMove(getInverseMove(undoneMove), true);
    }
    // Undo all intermediate rotations back to the start
    for (let j = prevIndex - 1; j >= 0; j--) {
      const m = S.userAlg[j]?.replace(/[()]/g, '');
      if (m && isCubeRotation(m)) addVisualMove(getInverseMove(m), true);
    }
    return;
  }

  // ── Wrong / unmatched move ─────────────────────────────────────────
  // The "core rotation" is the accumulated orientation change from all
  // rotation-producing moves (wide, slice, rotation) up to currentMoveIndex.
  const nextExpected = S.userAlg[S.currentMoveIndex + 1]?.replace(/[()]/g, '') || '';

  // Partial double: user doing half of a double move - allow both directions
  const isPartialDouble = nextExpected.includes('2')
    && S.badAlg.length > 0 && S.badAlg.length <= 2
    && S.badAlg[0].charAt(0) === nextExpected.charAt(0);

  // Compute visual move through core rotation (buildAlgFaceMap)
  const faceMap = buildAlgFaceMap(S.userAlg, S.currentMoveIndex);
  const visMove = transformMoveByFaceMap(logicalAlgMove, faceMap);
  log_move(`VIS wrong/unmatch: logicalAlgMove=${logicalAlgMove}, visMove=${visMove}`);

  // Slice vis pairing: if a previous face move is buffered, check if pair forms a slice
  if (S.pendingSliceVis) {
    const sliceName = getSliceForComponents(S.pendingSliceVis.logicalMove, logicalAlgMove);
    if (sliceName) {
      log_move(`VIS slice-pair detected: ${S.pendingSliceVis.logicalMove} + ${logicalAlgMove} = ${sliceName}`);
      clearSliceVisBuffer();
      addVisualMove(sliceName);
      return;
    }
    // Not a slice pair - flush the buffered move as individual
    flushSliceVisBuffer();
  }

  // Partial double: user doing half of a double move - allow both directions
  if (isPartialDouble) {
    const algFace = nextExpected.replace(/[2']/g, '');
    const userPrime = logicalAlgMove.includes("'");
    const halfMove = userPrime ? algFace + "'" : algFace;
    log_move(`VIS partial-double: expected=${nextExpected}, half=${halfMove}`);
    addVisualMove(halfMove);
    return;
  }

  // Slice buffering: if next expected or current alg move is a slice,
  // buffer this face move as a potential first component (any direction)
  const nextAlgMove = S.userAlg[S.currentMoveIndex + 1]?.replace(/[()]/g, '');
  const currentAlgMove = S.currentMoveIndex >= 0
    ? S.userAlg[S.currentMoveIndex]?.replace(/[()]/g, '') : null;

  // Forward: next expected is a slice and this move is a component (forward OR reverse)
  const nextSliceComps = nextAlgMove ? getSliceFaceComponents(nextAlgMove) : null;
  const nextSliceInvComps = nextAlgMove ? getSliceFaceComponents(getInverseMove(nextAlgMove)) : null;
  // Undo: current alg move is a slice and this move is a component (forward OR reverse)
  const curSliceInvComps = currentAlgMove ? getSliceFaceComponents(getInverseMove(currentAlgMove)) : null;
  const curSliceComps = currentAlgMove ? getSliceFaceComponents(currentAlgMove) : null;

  const isSliceComponent = (nextSliceComps && nextSliceComps.includes(logicalAlgMove))
    || (nextSliceInvComps && nextSliceInvComps.includes(logicalAlgMove))
    || (curSliceInvComps && curSliceInvComps.includes(logicalAlgMove))
    || (curSliceComps && curSliceComps.includes(logicalAlgMove));

  if (isSliceComponent) {
    bufferSliceVis(logicalAlgMove, visMove, false);
  } else {
    addVisualMove(visMove);
  }
}

/** Returns true if the move is a single-face move (candidate for slice pairing). */
function isSliceCandidate(move: string): boolean {
  return 'RLFBUD'.includes(move.charAt(0));
}

/** Core move handler: pattern-matches the move, detects undo, forwards to visualization, controls timer. */
export function handleMoveEvent(event: SmartCubeEvent): Promise<void> {
  if (event.type !== "MOVE") return Promise.resolve();

  // Input-level slice buffering: when gyro is disabled, buffer a single face move
  // for up to 100ms to detect paired face moves that form a slice (e.g. F' + B = S).
  // This is separate from the visualization-level pendingSliceVis buffer.
  if (!S.gyroscopeEnabled) {
    const moveStr = event.move;
    if (isSliceCandidate(moveStr)) {
      if (S.sliceBuffer) {
        clearTimeout(S.sliceBuffer.timer);
        const bufferedEvent = S.sliceBuffer.event;
        S.sliceBuffer = null;
        const bufferedMove = bufferedEvent.type === "MOVE" ? bufferedEvent.move : '';
        const sliceMove = getSliceForComponents(bufferedMove, moveStr);
        if (sliceMove) {
          // Pair forms a slice: feed the buffered first
          if (!S.__testMode) {
            S.twistyTracker.experimentalAddMove(bufferedMove, { cancel: false });
          }
          _moveChain = _moveChain.then(() => _processMove(event as SmartCubeMove, sliceMove, bufferedEvent));
          return _moveChain;
        } else {
          // Not a slice pair: process buffered move first, then current
          _moveChain = _moveChain.then(() => _processMove(bufferedEvent as SmartCubeMove));
          _moveChain = _moveChain.then(() => _processMove(event as SmartCubeMove));
          return _moveChain;
        }
      } else {
        // Buffer this move and wait for a potential slice partner
        S.sliceBuffer = {
          event,
          timer: setTimeout(() => {
            if (S.sliceBuffer) {
              const ev = S.sliceBuffer.event;
              S.sliceBuffer = null;
              _moveChain = _moveChain.then(() => _processMove(ev as SmartCubeMove));
            }
          }, 100),
        };
        return Promise.resolve();
      }
    }
    // Non-face move while buffer exists: flush buffer first
    if (S.sliceBuffer) {
      clearTimeout(S.sliceBuffer.timer);
      const bufferedEvent = S.sliceBuffer.event;
      S.sliceBuffer = null;
      _moveChain = _moveChain.then(() => _processMove(bufferedEvent as SmartCubeMove));
    }
  }

  _moveChain = _moveChain.then(() => _processMove(event as SmartCubeMove));
  return _moveChain;
}

async function _processMove(event: SmartCubeMove, sliceVisualMove?: string, slicePairedFirst?: SmartCubeEvent) {

    // Layer 1 (physical): always feed the raw GAN move to the tracker.
    // The tracker mirrors the rotation-oblivious physical cube state and is only
    // used for real-scramble setup (S.scrambleMode).  Its listener also sets
    // S.myKpattern, but we overwrite that below " myKpattern is Layer 2.
    if (!S.__testMode) {
      S.twistyTracker.experimentalAddMove(event.move, { cancel: false });
    }

    // Layer 3 (cross-algorithm orientation): when keepRotation is active,
    // transform the raw GAN move through the accumulated repair face map.
    // This compensates for the user holding the cube in a rotated orientation
    // relative to the canonical frame after a previous algorithm ended with
    // a net rotation.
    const repairedMove = S.keepRotationEnabled
      ? transformMoveByFaceMap(event.move, S.masterRepairFaceMap)
      : event.move;

    log_move(`incoming=${event.move}, repaired=${repairedMove}, masterRepairFaceMap=${JSON.stringify(S.masterRepairFaceMap)}, keepRot=${S.keepRotationEnabled}, idx=${S.currentMoveIndex}, alg=[${S.userAlg.join(' ')}]`);

    // Ignore moves during stare delay period
    if (S.stareDelayActive) return;

    // Defer visual player move " will be added after pattern matching
    // so we can use instant animation for wide/slice moves
    let visualMoveAdded = false;

    if (S.scrambleMode) {
      if (sliceVisualMove) {
        updateSliceOrientation(S.sliceOrientation, sliceVisualMove);
        addVisualMove(sliceVisualMove);
      } else {
        addVisualMove(remapMoveForPlayer(repairedMove, S.sliceOrientation));
      }
      visualMoveAdded = true;

      const cubePattern = await S.twistyTracker.experimentalModel.currentPattern.get();
      let scramble = getScrambleToSolution(S.userAlg.join(' '), cubePattern);
      const currentScramble = $('#alg-scramble').text();
      const scrambleMoves = scramble.split(' ');
      const currentScrambleMoves = currentScramble.split(' ');
      const firstCurrentScrambleMove = currentScrambleMoves[0];
      const isDoubleTurn = firstCurrentScrambleMove.charAt(1) === '2';

      if (scrambleMoves.length >= currentScrambleMoves.length && scrambleMoves.length > 2) {
        if (repairedMove === firstCurrentScrambleMove || (repairedMove.charAt(0) === firstCurrentScrambleMove.charAt(0) && isDoubleTurn)) {
          scramble = currentScrambleMoves.slice(1).join(' ');
          if (isDoubleTurn) {
            scramble = repairedMove + " " + scramble;
          }
        }
      }
      if (scrambleMoves.length === currentScrambleMoves.length - 1 && scrambleMoves.length > 2 && repairedMove === firstCurrentScrambleMove) {
        scramble = currentScrambleMoves.slice(1).join(' ');
      }

      if (scrambleMoves.length > currentScrambleMoves.length) {
        $('#alg-help-info').removeClass('text-red-400 dark:text-red-500').addClass('text-green-400 dark:text-green-500').show();
      } else {
        $('#alg-help-info').hide();
      }

      $('#alg-scramble').text(scramble);

      if (scramble.length === 0) {
        $('#alg-scramble').hide();
        $('#alg-help-info').hide();
        S.scrambleMode = false;

        S.initialstate = cubePattern;
        S.keepInitialState = true;
        $('#train-alg').trigger('click');
      }
      return;
    }

    if (S.timerState === "READY"|| S.timerState === "STOPPED") {
      // During countdown, don't start the timer " the countdown callback will handle it.
      // Moves are still processed for pattern matching below.
      if (!S.countdownTimer) {
        setTimerState("RUNNING");
      }
    }
    // Phantom mode: gray out all stickers on first move (only when stare-at-cube is active)
    // Placed outside READY/STOPPED block so it also re-activates after reset (timer stays RUNNING)
    if (S.phantomModeEnabled && S.stareDelayEnabled && !S.phantomModeActive) {
      S.phantomModeActive = true;
      const allIgnored = buildStickeringMaskFromFacelets(new Set(ALL_FACELETS));
      const players = [S.twistyPlayer, ...(S.twistyMirror ? [S.twistyMirror] : [])];
      for (const player of players) {
        applyMaskToPlayer(player, allIgnored);
      }
    }
    // Push slice-paired first move data (if from a slice detection pair)
    if (slicePairedFirst?.type === "MOVE") {
      const firstData: SmartCubeMove = {
        face: slicePairedFirst.face,
        direction: slicePairedFirst.direction,
        move: slicePairedFirst.move,
        localTimestamp: slicePairedFirst.localTimestamp,
        cubeTimestamp: slicePairedFirst.cubeTimestamp,
      };
      S.lastMoves.push(firstData);
      if (S.timerState === "RUNNING") {
        S.solutionMoves.push(firstData);
      }
    }
    S.lastMoves.push({ ...event, move: repairedMove });
    if (S.timerState === "RUNNING") {
      S.solutionMoves.push({ ...event, move: repairedMove });
      if (!S.inputMode && !S.scrambleMode) {
        $('#reset-practice-btn').removeClass('hidden');
      }
      if ($('#orientation-hint').is(':visible')) {
        $('#orientation-reset-btn').removeClass('hidden');
      }
    }
    if (S.lastMoves.length > 256) {
      S.lastMoves = S.lastMoves.slice(-256);
    }
    if (S.lastMoves.length > 10) {
      var skew = cubeTimestampCalcSkew(S.lastMoves);
      $('#skew').val(skew + '%');
    }

    // GAN bug detection: if the tracker's pattern didn't change after a move,
    // the firmware missed it.  We detect this by comparing the tracker's
    // facelet string (physical state) against the previous value.
    if (!S.__testMode) {
      const trackerPattern = await S.twistyTracker.experimentalModel.currentPattern.get();
      const trackerFacelets = patternToFacelets(trackerPattern);
      if (trackerFacelets === S.previousFacelets && !S.isBugged) {
        S.isBugged = true;
      }
      S.previousFacelets = trackerFacelets;
    }

    if (S.inputMode) {
      if (!visualMoveAdded) {
        if (sliceVisualMove) {
          updateSliceOrientation(S.sliceOrientation, sliceVisualMove);
          addVisualMove(sliceVisualMove);
        } else {
          addVisualMove(remapMoveForPlayer(repairedMove, S.sliceOrientation));
        }
        visualMoveAdded = true;
      }
      if ($('#alg-input').is(':focus')) {
        const appended = slicePairedFirst?.type === "MOVE"
          ? slicePairedFirst.move + " " + event.move
          : S.lastMoves[S.lastMoves.length - 1].move;
        $('#alg-input').val(function (_, currentValue) {
          return Alg.fromString(currentValue + " " + appended).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString();
        });
      } else {
        S.editingSetupAlg += ' ' + repairedMove;
      }
      return;
    };

    var found: boolean = false;

    S.userActualMoves.push(repairedMove);
    const previousMoveIndex = S.currentMoveIndex;
    const testState = fixOrientation(S.myKpattern.applyMove(repairedMove));
    const testStateBugged = S.isBugged ? fixOrientation(S.myKpattern) : null;
    // Pre-compute slice undo info for deferral check inside the match loop.
    // If the current alg move is a slice, the incoming move might be the first
    // component of its inverse (an undo attempt in either component ordering).
    const _curAlgMoveForUndo = previousMoveIndex >= 0 ? S.userAlg[previousMoveIndex]?.replace(/[()]/g, '') : null;
    const _curSliceUndoComponents = _curAlgMoveForUndo ? getSliceFaceComponents(getInverseMove(_curAlgMoveForUndo)) : null;

    // Match preference: try nextExpectedIdx first before scanning all patternStates.
    // This avoids earlier identical patterns stealing the match after slice/sync quirks.
    const nextExpectedIdx = previousMoveIndex + 1;
    let preferredMatchIdx: number | null = null;
    if (nextExpectedIdx >= 0 && nextExpectedIdx < S.patternStates.length) {
      if (testState.isIdentical(S.patternStates[nextExpectedIdx]) || (S.isBugged && testStateBugged?.isIdentical(S.patternStates[nextExpectedIdx]))) {
        preferredMatchIdx = nextExpectedIdx;
      }
    }

    S.patternStates.forEach((pattern, index) => {
      if (found) return;
      // When preferred match exists (next expected index matched), skip other indices.
      if (preferredMatchIdx !== null && index !== preferredMatchIdx) return;
      if (testState.isIdentical(pattern) || (S.isBugged && testStateBugged!.isIdentical(pattern))) {
        // Deferral: if this is a JUMP match (not a sequential forward step) and
        // the move could be the first component of a slice undo for the current
        // alg move, prefer the undo interpretation.  The wrong-move path below
        // will buffer the move; if the second component arrives, the buffer
        // completes the slice undo.  If not, the buffer flushes it as a wrong
        // move (the jump-match completion is lost, but undo intent is more
        // likely than a non-sequential jump in this scenario).
        if (_curSliceUndoComponents && !S.pendingSliceVis && _curSliceUndoComponents.includes(repairedMove)) {
          let isJumpMatch = false;
          if (index > previousMoveIndex) {
            isJumpMatch = true;
            for (let k = previousMoveIndex + 1; k < index; k++) {
              const m = S.userAlg[k]?.replace(/[()]/g, '');
              if (m && !isCubeRotation(m)) { /* intermediate non-rotation: genuine jump */ }
              else { isJumpMatch = k < index - 1; } // only rotations between
            }
            // Recompute: sequential if ALL intermediates are rotations
            let allRots = true;
            for (let k = previousMoveIndex + 1; k < index; k++) {
              const m = S.userAlg[k]?.replace(/[()]/g, '');
              if (m && !isCubeRotation(m)) { allRots = false; break; }
            }
            isJumpMatch = !allRots;
          }
          if (isJumpMatch) {
            log_move(`DEFER slice-undo: move=${repairedMove} matched idx=${index} but deferring to undo buffer`);
            return; // Skip this match; let the wrong-move path buffer it
          }
        }
        // When a pending slice-vis buffer exists and the buffered move + current
        // move form a complete slice, skip this undo match - the pair should be
        // treated as a single wrong slice move, not as an undo.
        if (S.pendingSliceVis && index < previousMoveIndex) {
          const sliceName = getSliceForComponents(S.pendingSliceVis.logicalMove, repairedMove);
          if (sliceName) {
            log_move(`SKIP-UNDO: pendingSliceVis ${S.pendingSliceVis.logicalMove} + ${repairedMove} = ${sliceName}, skipping undo to idx=${index}`);
            return; // Skip this match; let wrong-move path handle the slice pair
          }
        }

        S.isBugged = false;
        S.currentMoveIndex = index;
        found = true;
        log_move(`MATCH idx=${index} (prev=${previousMoveIndex}), ${index > previousMoveIndex ? 'FORWARD' : index < previousMoveIndex ? 'UNDO' : 'SAME'}`);

        // Reverse-direction slice double: check if this match completes a buffered
        // reverse-direction execution (e.g. M'M' matching [M,M] from M2 expansion).
        let reverseSliceCompleted = false;
        if (S.reverseSliceBuffer) {
          const prevSlice = S.userAlg[previousMoveIndex + 1]?.replace(/[()]/g, '');
          const matchedSlice = S.userAlg[index]?.replace(/[()]/g, '');
          if (prevSlice && matchedSlice && prevSlice === matchedSlice && getSliceFaceComponents(prevSlice)) {
            reverseSliceCompleted = true;
            log_move(`REVERSE-SLICE complete: buffer=[${S.reverseSliceBuffer.join(',')}], matched idx=${index}`);
            S.reverseSliceBuffer = null;
          } else {
            // Not a reverse-slice completion - flush buffer as wrong moves
            log_move(`REVERSE-SLICE flush at match: buffer=[${S.reverseSliceBuffer.join(',')}]`);
            for (const m of S.reverseSliceBuffer) S.badAlg.push(m);
            S.reverseSliceBuffer = null;
          }
        }

        const hadBadMoves = S.hadBadMoveDuringExec || S.badAlg.length > 0;
        S.badAlg = [];
        // If the pending slice buffer + current move complete a slice pair,
        // emit the slice name for reverse-completions, or consume silently for normal matches.
        if (S.pendingSliceVis) {
          const sliceName = getSliceForComponents(S.pendingSliceVis.logicalMove, repairedMove);
          if (sliceName) {
            if (reverseSliceCompleted || index <= previousMoveIndex) {
              // Emit slice name for:
              // - reverse-slice completion (M'M' for M M)
              // - same-index / undo matches (wrong slice move returning to same/prior state)
              addVisualMove(sliceName, !reverseSliceCompleted);
              visualMoveAdded = true;
            }
            clearSliceVisBuffer();
          } else {
            flushSliceVisBuffer();
          }
        }        S.myKpattern = S.myKpattern.applyMove(repairedMove);

        // Reverse-slice completion: the vis buffer already emitted slice names
        // for each pair of face moves, so skip adding alg move names here.
        if (reverseSliceCompleted && !visualMoveAdded) {
          visualMoveAdded = true;
        }

        if (!visualMoveAdded) {
          const matchType = index > previousMoveIndex ? 'forward'
            : index < previousMoveIndex ? 'undo' : 'same';
          applyVisualization(repairedMove, matchType as any, previousMoveIndex);
          visualMoveAdded = true;
        }

        if (S.currentMoveIndex === S.userAlg.length - 1 || (() => {
          const tailRotations = trailingWholeCubeRotationMoveCount(S.userAlg);
          const lastLayerMoveIndex = S.userAlg.length - 1 - tailRotations;
          const finishedIncludingIgnoredRotations = tailRotations > 0 && lastLayerMoveIndex >= 0 && S.currentMoveIndex === lastLayerMoveIndex;
          return finishedIncludingIgnoredRotations || (S.currentMoveIndex >= 0 && S.userAlg.slice(S.currentMoveIndex + 1).every(m => isCubeRotation(m)));
        })()) {
          log_move(`COMPLETE alg=[${S.userAlg.join(' ')}], hadBadMoves=${hadBadMoves}`);
          if (S.overrideAlgEnabled && S.userActualMoves.length > 0 && hadBadMoves) {
            const origAlgId = algToId(S.checkedAlgorithms[0]?.algorithm || '');            
            // check if user used an alternative alg, suggestion to replace the case
            if (localStorage.getItem(`DisableOverride-${origAlgId}`) !== 'true') {
              const userMovesStr = S.userActualMoves.join(' ');
              const originalAlg = S.checkedAlgorithms[0]?.algorithm || S.originalUserAlg.join(' ');
              // Never suggest identical or notationally equivalent algs
              if (!notationallyAlgEquivalent(simplifyAlg(userMovesStr), originalAlg)) {
                const simplifiedUserMoves = simplifyAlg(userMovesStr);
                setTimerState("STOPPED");
                S.pendingOverridePattern = pattern;
                $('#alg-override-original').text(S.displayAlg.join(' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim());
                $('#alg-override-new').text(simplifiedUserMoves);
                $('#alg-override-container').removeClass('hidden').show();
                $('#reset-practice-container').hide();
                return;
              }
            }
          }
          const isRetry = S.retryFailedEnabled && S.hasFailedAlg;
          setTimerState("STOPPED", isRetry);
          resetAlg();
          S.currentMoveIndex = S.userAlg.length - 1;
          if (!isRetry) {
            switchToNextAlgorithm();
            updateTimesDisplay();
            if (S.checkedAlgorithms.length > 0) {
              $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
            }
          }
          S.initialstate = pattern;
          S.keepInitialState = true;
          S.lastCompletedAlgStr = S.userAlg.join(' ');
          // Accumulate net orientation change into masterRepairFaceMap.
          // buildAlgFaceMap gives within-alg (GAN -> alg-frame) map;
          if (S.keepRotationEnabled) {
            const algMoves = S.lastCompletedAlgStr.split(/\s+/).filter(m => m.length > 0);
            const algoFaceMap = buildAlgFaceMap(algMoves, algMoves.length - 1);
            S.masterRepairFaceMap = composeFaceMaps(S.masterRepairFaceMap, algoFaceMap);
          }
          // Deactivate phantom mode: restore original stickering when solved
          if (S.phantomModeActive) {
            S.phantomModeActive = false;
            applyStickeringMask(S.currentRotatedIgnore);
          }
          transitionToNextCase();
          return;
        }
        return;
      }
    });
    if (!found && S.currentMoveIndex >= 0 && S.initialPatternState) {
      if (testState.isIdentical(S.initialPatternState) || (S.isBugged && testStateBugged?.isIdentical(S.initialPatternState))) {
        S.isBugged = false;
        found = true;
        log_move(`UNDO-TO-INITIAL (prev=${S.currentMoveIndex})`);
        const prevIdx = S.currentMoveIndex;
        S.currentMoveIndex = -1;
        S.badAlg = [];
        // If the pending slice buffer + current move complete a slice undo,
        // consume silently. Otherwise flush as wrong.
        if (S.pendingSliceVis) {
          const sliceName = getSliceForComponents(S.pendingSliceVis.logicalMove, repairedMove);
          if (sliceName) {
            clearSliceVisBuffer();
          } else {
            flushSliceVisBuffer();
          }
        }
        S.myKpattern = S.myKpattern.applyMove(repairedMove);
        if (!visualMoveAdded) {
          applyVisualization(repairedMove, 'undo-initial', prevIdx);
          visualMoveAdded = true;
        }
      }
    }
    if (!found) {
      // Off-path: advance myKpattern by the canonical move so override
      // detection (desiredEndState comparison) sees the correct state.
      S.myKpattern = S.myKpattern.applyMove(repairedMove);
      if (slicePairedFirst?.type === "MOVE") {
        S.badAlg.push(slicePairedFirst.move);
      }
      S.badAlg.push(repairedMove);
      log_move(`WRONG move=${repairedMove}, badAlg=[${S.badAlg.join(',')}], expected=${S.userAlg[S.currentMoveIndex + 1] || 'END'}`);

      // Handle slice-vis BEFORE reverse buffer (which may return early)
      if (!visualMoveAdded) {
        applyVisualization(repairedMove, 'wrong', previousMoveIndex);
        visualMoveAdded = true;
      }

      // Reverse-direction slice double detection: for M2 (expanded to [M, M]),
      // accept M'M' as equivalent since M^2 = M'^2 (both 180deg rotations).
      const nextExpSlice = S.userAlg[S.currentMoveIndex + 1]?.replace(/[()]/g, '');
      const nextNextExpSlice = S.userAlg[S.currentMoveIndex + 2]?.replace(/[()]/g, '');
      if (nextExpSlice && nextNextExpSlice === nextExpSlice && getSliceFaceComponents(nextExpSlice)) {
        const inverseComps = getSliceFaceComponents(getInverseMove(nextExpSlice));
        if (inverseComps && inverseComps.includes(repairedMove)) {
          if (!S.reverseSliceBuffer && S.badAlg.length === 1) {
            // Start new reverse-direction buffer
            S.reverseSliceBuffer = [repairedMove];
            S.badAlg.pop();
            log_move(`REVERSE-SLICE buffer start: move=${repairedMove}, expected=${nextExpSlice}`);
            return;
          } else if (S.reverseSliceBuffer) {
            // Continue existing buffer
            S.reverseSliceBuffer.push(repairedMove);
            S.badAlg.pop();
            log_move(`REVERSE-SLICE buffer continue: move=${repairedMove}, buffer=[${S.reverseSliceBuffer.join(',')}]`);
            return;
          }
        }
      }

      // hadBadMoveDuringExec is set by showMistakesWithDelay after 300ms
      // (not immediately) so that fast corrections and wide-move face-components
      // that resolve within milliseconds don't falsely flag the execution.
      // If reverse buffer exists but current move doesn't continue it, flush as wrong moves
      if (S.reverseSliceBuffer) {
        log_move(`REVERSE-SLICE flush: buffer=[${S.reverseSliceBuffer.join(',')}], breaking move=${repairedMove}`);
        S.badAlg.pop(); // remove current move temporarily
        for (const m of S.reverseSliceBuffer) {
          S.badAlg.push(m);
          // vis already emitted via slice-vis buffer during earlier applyVisualization calls
        }
        S.badAlg.push(repairedMove); // re-add current move
        S.reverseSliceBuffer = null;
      }

      if (S.currentMoveIndex === 0 && S.badAlg.length === 1 && repairedMove === getInverseMove(S.userAlg[S.currentMoveIndex].replace(/[()]/g, ""))) {
        S.currentMoveIndex--;
        S.badAlg.pop();
      } else if (S.lastMoves[S.lastMoves.length - 1].move === getInverseMove(S.badAlg[S.badAlg.length - 2])) {
        S.badAlg.pop();
        S.badAlg.pop();
      } else if (S.badAlg.length > 3 && S.lastMoves.length > 3 && S.lastMoves[S.lastMoves.length - 1].move === S.lastMoves[S.lastMoves.length - 2].move && S.lastMoves[S.lastMoves.length - 2].move === S.lastMoves[S.lastMoves.length - 3].move && S.lastMoves[S.lastMoves.length - 3].move === S.lastMoves[S.lastMoves.length - 4].move) {
        S.badAlg.pop();
        S.badAlg.pop();
        S.badAlg.pop();
        S.badAlg.pop();
      }

      const nextExpectedMove = S.userAlg[S.currentMoveIndex + 1]?.replace(/[()]/g, '') || '';
      const isPartialDouble = nextExpectedMove.includes('2') && S.badAlg.length > 0 && S.badAlg.length <= 2
        && S.badAlg[0].charAt(0) === nextExpectedMove.charAt(0);
      if (!(S.overrideAlgEnabled && S.desiredEndState && !isPartialDouble)) {
        if (__LOG_MOVES) log_move(`OVERRIDE skipped: overrideEnabled=${S.overrideAlgEnabled}, hasEndState=${!!S.desiredEndState}, isPartialDouble=${isPartialDouble}`);
      }
      if (S.overrideAlgEnabled && S.desiredEndState && !isPartialDouble) {
        const stateAfterMove = testState;
        const category = $('#category-select').val()?.toString().toLowerCase() || '';
        const effectiveCategory = S.checkedAlgorithms[0]?.masking?.toLowerCase() || category;
        // Use UNrotated ignore pieces: both testState and desiredEndState are
        // fixOrientation-normalized (canonical reference frame), so the ignore
        // piece names must also be in the canonical frame.
        const currentIgnore = S.checkedAlgorithms[0]?.ignore || '';
        const overrideMatch = partialStateEquals(stateAfterMove, S.desiredEndState, effectiveCategory, currentIgnore);
        if (__LOG_MOVES) log_move(`OVERRIDE check: match=${overrideMatch}, category=${effectiveCategory}, ignore=${currentIgnore}, isPartialDouble=${isPartialDouble}`);
        if (!overrideMatch) {
          if (__LOG_MOVES) {
            try {
              const f1 = patternToFacelets(stateAfterMove);
              const f2 = patternToFacelets(S.desiredEndState);
              const diffs: string[] = [];
              for (let fi = 0; fi < 54; fi++) { if (f1[fi] !== f2[fi]) diffs.push(`${fi}:${f1[fi]} ${f2[fi]}`); }
              log_move(`OVERRIDE facelets diff (${diffs.length}): ${diffs.join(' ')}`);
              log_move(`OVERRIDE actual=${f1} desired=${f2}`);
            } catch (e) { log_move(`OVERRIDE diag error: ${e}`); }
          }
        }
        if (overrideMatch) {
          const origAlgId = algToId(S.checkedAlgorithms[0]?.algorithm || '');
          if (localStorage.getItem(`DisableOverride-${origAlgId}`) === 'true') {
            setTimerState("STOPPED");
            resetAlg();
            S.currentMoveIndex = S.userAlg.length - 1;
            if (S.phantomModeActive) {
              S.phantomModeActive = false;
              applyStickeringMask(S.currentRotatedIgnore);
            }
            switchToNextAlgorithm();
            updateTimesDisplay();
            S.initialstate = stateAfterMove;
            S.pendingOverridePattern = null;
            S.keepInitialState = true;
            if (S.checkedAlgorithms.length > 0) {
              $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
            }
            S.lastCompletedAlgStr = S.userAlg.join(' ');
            transitionToNextCase();
          } else {
            const userMovesStr = S.userActualMoves.join(' ');
            const originalAlg = S.checkedAlgorithms[0]?.algorithm || S.originalUserAlg.join(' ');
            // Never suggest identical or notationally equivalent algs
            if (!notationallyAlgEquivalent(simplifyAlg(userMovesStr), originalAlg)) {
              const simplifiedUserAlg = simplifyAlg(userMovesStr);
              setTimerState("STOPPED");
              S.pendingOverridePattern = stateAfterMove;
              $('#alg-override-original').text(S.displayAlg.join(' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim());
              $('#alg-override-new').text(simplifiedUserAlg);
              $('#alg-override-container').removeClass('hidden').show();
              $('#reset-practice-container').hide();
            } else {
              // Equivalent alg " complete without showing override dialog
              setTimerState("STOPPED");
              resetAlg();
              S.currentMoveIndex = S.userAlg.length - 1;
              if (S.phantomModeActive) {
                S.phantomModeActive = false;
                applyStickeringMask(S.currentRotatedIgnore);
              }
              switchToNextAlgorithm();
              updateTimesDisplay();
              S.initialstate = stateAfterMove;
              S.pendingOverridePattern = null;
              S.keepInitialState = true;
              if (S.checkedAlgorithms.length > 0) {
                $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
              }
              S.lastCompletedAlgStr = S.userAlg.join(' ');
              transitionToNextCase();
            }
          }
        }
      }
    }
    if (!visualMoveAdded) {
      applyVisualization(repairedMove, 'wrong', previousMoveIndex);
      visualMoveAdded = true;
    }
    updateAlgDisplay();
}

/** Syncs the initial cube state from the GAN cube's facelet report on first connection. */
export async function handleFaceletsEvent(event: SmartCubeEvent) {
  if (event.type == "FACELETS" && !S.cubeStateInitialized) {
    Object.assign(S.sliceOrientation, { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
    if (!S.inputMode || S.timerState !== "IDLE") {
      S.cubeStateInitialized = true;
      console.log("Practice active, skipping initial cube state sync", event.facelets);
      return;
    }
    if (event.facelets != SOLVED_STATE) {
      var kpattern = faceletsToPattern(event.facelets);
      var solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      var scramble = solution.invert();
      S.twistyTracker.alg = scramble;
      S.twistyPlayer.alg = scramble;
      syncMirrorAlg(scramble);
    } else {
      S.twistyTracker.alg = '';
      S.twistyPlayer.alg = '';
      syncMirrorAlg('');
    }
    S.cubeStateInitialized = true;
    console.log("Initial cube state is applied successfully", event.facelets);
  }
}

/** Top-level GAN event dispatcher " routes to GYRO/MOVE/FACELETS/HARDWARE/BATTERY/DISCONNECT handlers. */
export function handleCubeEvent(event: SmartCubeEvent) {
  if (event.type == "GYRO") {
    handleGyroEvent(event);
  } else if (event.type == "MOVE") {
    handleMoveEvent(event);
  } else if (event.type == "FACELETS") {
    handleFaceletsEvent(event);
  } else if (event.type == "HARDWARE") {
    $('#hardwareName').val(event.hardwareName || '- n/a -');
    $('#hardwareVersion').val(event.hardwareVersion || '- n/a -');
    $('#softwareVersion').val(event.softwareVersion || '- n/a -');
    $('#productDate').val(event.productDate || '- n/a -');
    setGyroscopeUiFromSupported(event.gyroSupported === true);
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
    $('#bluetooth-indicator').hide();
    $('#battery-indicator').attr('title', event.batteryLevel + '%');
    if (event.batteryLevel >= 75) {
      $('#battery-indicator').html('<svg fill="none" class="h-8 w-8 inline-block" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 7.5L3.5 7.50001V16.5L18.5 16.5V14.3571H20.5V9.21429H18.5V7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/><path d="M9.5 10.5C9.5 9.94772 9.94772 9.5 10.5 9.5H11.5C12.0523 9.5 12.5 9.94772 12.5 10.5V13.5C12.5 14.0523 12.0523 14.5 11.5 14.5H10.5C9.94772 14.5 9.5 14.0523 9.5 13.5V10.5Z" fill="currentColor"/><path d="M13.5 10.5C13.5 9.94772 13.9477 9.5 14.5 9.5H15.5C16.0523 9.5 16.5 9.94772 16.5 10.5V13.5C16.5 14.0523 16.0523 14.5 15.5 14.5H14.5C13.9477 14.5 13.5 14.0523 13.5 13.5V10.5Z" fill="currentColor"/></svg>');
      $('#battery-indicator').css('color', 'green');
    }
    else if (event.batteryLevel >= 50) {
      $('#battery-indicator').html('<svg fill="none" class="h-8 w-8 inline-block" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 7.5L3.5 7.50001V16.5L18.5 16.5V14.3571H20.5V9.21429H18.5V7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/><path d="M9.5 10.5C9.5 9.94772 9.94772 9.5 10.5 9.5H11.5C12.0523 9.5 12.5 9.94772 12.5 10.5V13.5C12.5 14.0523 12.0523 14.5 11.5 14.5H10.5C9.94772 14.5 9.5 14.0523 9.5 13.5V10.5Z" fill="currentColor"/></svg>');
      $('#battery-indicator').css('color', 'yellow');
    }
    else if (event.batteryLevel >= 20) {
      $('#battery-indicator').html('<svg fill="none" class="h-8 w-8 inline-block" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 7.5L3.5 7.50001V16.5L18.5 16.5V14.3571H20.5V9.21429H18.5V7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5C5.5 9.94772 5.94772 9.5 6.5 9.5H7.5C8.05228 9.5 8.5 9.94772 8.5 10.5V13.5C8.5 14.0523 8.05228 14.5 7.5 14.5H6.5C5.94772 14.5 5.5 14.0523 5.5 13.5V10.5Z" fill="currentColor"/></svg>');
      $('#battery-indicator').css('color', 'orange');
    }
    else if (event.batteryLevel < 20) {
      $('#battery-indicator').html('<svg fill="none" class="h-8 w-8 inline-block" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 7.5L3.5 7.50001V16.5L18.5 16.5V14.3571H20.5V9.21429H18.5V7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 10V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.75 14.25C11.75 14.6642 11.4142 15 11 15C10.5858 15 10.25 14.6642 10.25 14.25C10.25 13.8358 10.5858 13.5 11 13.5C11.4142 13.5 11.75 13.8358 11.75 14.25Z" fill="currentColor"/></svg>');
      $('#battery-indicator').css('color', 'red');
    }
  } else if (event.type == "DISCONNECT") {
    deviceDisconnected();
  }
}

/** Prompts for MAC address when the browser can't auto-detect the GAN cube. */
export const customMacAddressProvider: MacAddressProvider = async (device, isFallbackCall): Promise<string | null> => {
  const promptDefault = getCachedMacForDevice(device) ?? '';
  if (!isFallbackCall) {
    // Let the library try cache, request-device advertisement data, waitForAdvertisements,
    // and MoYu32/QiYi MAC candidate probing (enableAddressSearch) first. Prompting here when
    // watchAdvertisements is missing was redundant: those paths often succeed without it.
    return null;
  }
  const flagHint =
    typeof device.watchAdvertisements !== 'function'
      ? `\n\nOn Chrome, automatic discovery may work if you enable\nchrome://flags/#enable-experimental-web-platform-features`
      : '';
  return prompt(
    `Unable to determine cube MAC address!\nPlease enter MAC address manually:${flagHint}`,
    promptDefault
  );
};

/** Cleans up UI and state when the GAN cube disconnects. */
export function deviceDisconnected() {
  S.conn = null;
  S.twistyPlayer.alg = '';
  syncMirrorAlg('');
  S.twistyTracker.alg = '';
  releaseWakeLock();
  $('#reset-gyro').prop('disabled', true);
  $('#reset-state').prop('disabled', true);
  $('#device-info').prop('disabled', true);
  updateHeaderResetGyroState();
  $('.info input').val('- n/a -');
  setGyroscopeToggleDisabled(false);
  $('#connect').html('Connect');
  $('#battery-indicator').hide();
  $('#bluetooth-indicator').show();
}
