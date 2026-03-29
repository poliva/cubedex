import $ from 'jquery';
import { Alg } from 'cubing/alg';
import { S } from '../state';
import {
  algToId, saveAlgorithm, fixOrientation, setStickering, loadAlgorithms,
} from '../functions';
import { syncMirrorAlg, applyStickeringMask } from '../visualization';
import {
  cancelStareDelay, resetAlg, switchToNextAlgorithm, transitionToNextCase,
  updateAlgDisplay,
} from '../trainer';
import { setTimerState } from '../timer';
import { updateSelectionControls } from './handlersLoad';

/** Hides the override dialog and advances to the next algorithm in the practice queue. */
function proceedAfterOverride() {
  $('#alg-override-container').hide();
  resetAlg();
  S.currentMoveIndex = S.userAlg.length - 1;
  if (S.phantomModeActive) {
    S.phantomModeActive = false;
    applyStickeringMask(S.currentRotatedIgnore);
  }
  switchToNextAlgorithm();
  if (S.pendingOverridePattern) {
    S.initialstate = S.pendingOverridePattern;
    S.pendingOverridePattern = null;
  }
  S.keepInitialState = true;
  if (S.checkedAlgorithms.length > 0) {
    $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
  }
  S.lastCompletedAlgStr = S.userAlg.join(' '); // for orientation hint on next case
  transitionToNextCase();
}

/** Registers event handlers for the algorithm override confirmation dialog. */
export function initOverrideHandlers() {
  // #alg-override-btn button - saves the detected algorithm as an override, replacing the stored alg
  $('#alg-override-btn').on('click', () => {
    const category = $('#category-select').val()?.toString() || '';
    const newAlgorithm = $('#alg-override-new').text().trim();
    if (S.checkedAlgorithms.length > 0 && category && newAlgorithm) {
      const currentAlg = S.checkedAlgorithms[0];
      const oldAlgId = algToId(currentAlg.algorithm);
      const newAlgId = algToId(newAlgorithm);
      const subset = $('#' + oldAlgId).data('subset') || '';
      saveAlgorithm(category, subset, currentAlg.name, newAlgorithm, currentAlg.ignore);
      // Copy learning status and selection to new algId (preserving them across the alg change)
      const learnedVal = localStorage.getItem(`Learned-${oldAlgId}`);
      if (learnedVal) localStorage.setItem(`Learned-${newAlgId}`, learnedVal);
      const selectedVal = localStorage.getItem(`Selected-${oldAlgId}`);
      if (selectedVal) localStorage.setItem(`Selected-${newAlgId}`, selectedVal);
      // Reset timing data for new algId since the algorithm changed
      localStorage.removeItem(`Best-${newAlgId}`);
      localStorage.removeItem(`LastTimes-${newAlgId}`);
      localStorage.removeItem(`Best-CD-${newAlgId}`);
      localStorage.removeItem(`LastTimes-CD-${newAlgId}`);
      localStorage.removeItem(`ConsecutiveCorrect-${newAlgId}`);
      // Clean up old timing data
      localStorage.removeItem(`Best-${oldAlgId}`);
      localStorage.removeItem(`LastTimes-${oldAlgId}`);
      localStorage.removeItem(`Best-CD-${oldAlgId}`);
      localStorage.removeItem(`LastTimes-CD-${oldAlgId}`);
      localStorage.removeItem(`ConsecutiveCorrect-${oldAlgId}`);
      S.checkedAlgorithms[0] = { ...currentAlg, algorithm: newAlgorithm };
      loadAlgorithms(category);
      updateSelectionControls();
    }
    proceedAfterOverride();
  });

  // #alg-override-keep button - keeps the original algorithm and moves to the next case
  $('#alg-override-keep').on('click', () => {
    proceedAfterOverride();
  });

  // #alg-override-tryagain button - re-presents the same case using the current physical cube state
  $('#alg-override-tryagain').on('click', () => {
    $('#alg-override-container').hide();
    cancelStareDelay();
    resetAlg();
    S.initialstate = S.myKpattern;
    S.patternStates = [];
    S.algPatternStates = [];
    S.userAlg.forEach((move, index) => {
      move = move.replace(/[()]/g, "");
      if (index === 0) S.patternStates[index] = S.initialstate.applyMove(move);
      else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(move);
      S.algPatternStates[index] = S.patternStates[index];
      S.patternStates[index] = fixOrientation(S.patternStates[index]);
    });
    const invertedAlg = Alg.fromString(S.userAlg.join(' ')).invert().toString();
    S.twistyPlayer.alg = invertedAlg;
    syncMirrorAlg(invertedAlg);
    const currentCategory = $('#category-select').val()?.toString() || '';
    setStickering(currentCategory);
    setTimerState("READY");
    updateAlgDisplay();
  });

  // #alg-override-disable button - disables the override prompt for this specific case permanently
  $('#alg-override-disable').on('click', () => {
    if (S.checkedAlgorithms.length > 0) {
      const algId = algToId(S.checkedAlgorithms[0].algorithm);
      localStorage.setItem(`DisableOverride-${algId}`, 'true');
    }
    proceedAfterOverride();
  });

  // #alg-override-edit button - enters edit mode with the user's alternative algorithm
  $('#alg-override-edit').on('click', () => {
    const newAlg = $('#alg-override-new').text().trim();
    $('#alg-override-container').hide();
    // Set the input to the user's alternative algorithm and trigger edit mode
    $('#alg-input').val(newAlg);
    $('#alg-display').trigger('click');
  });
}
