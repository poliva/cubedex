import $ from 'jquery';
import { Alg } from 'cubing/alg';
import { S } from '../state';
import {
  expandNotation, algToId, saveAlgorithm, getOrientationCompensation,
  splitAlgAtCursor, loadCategories, loadSubsets,
} from '../functions';
import { syncMirrorAlg, applyStickeringMask } from '../visualization';
import { rebuildCheckedAlgorithms } from '../trainer';
import { setTimerState, setTimerValue } from '../timer';
import { updateSelectionControls } from './handlersLoad';

/** Computes the display algorithm with orientation compensation prepended so the pattern stays correct. */
export function compensatedDisplayAlg(algStr: string): string {
  const compensation = getOrientationCompensation(algStr);
  return compensation ? `${compensation} ${algStr}` : algStr;
}

/** Registers event handlers for the algorithm editing and saving workflow. */
export function initEditSaveHandlers() {
  // #alg-display container click - enters edit mode for the currently displayed algorithm
  $('#alg-display').on('click', () => {
    S.inputMode = true;
    $('#alg-override-container').hide();
    $('#alg-display-container').hide();
    $('#alg-input').show();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    $('#app-top').show();
    $('#save-success').hide();
    $('#save-error').hide();
    $('#alg-fix').hide();
    $('#alg-help-info').hide();
    $('#edit-controls').removeClass('hidden');
    let algId = algToId(S.checkedAlgorithms[0]?.algorithm) || algToId($('#alg-input').val() as string);
    S.editingAlgId = algId; // track which alg is being edited
    const rawAlg = S.checkedAlgorithms[0]?.algorithm || ($('#alg-input').val() as string) || '';
    S.editingOriginalAlg = Alg.fromString(rawAlg).invert().toString();
    S.editingSetupAlg = S.editingOriginalAlg;
    let subset = $('#' + algId).data('subset') || '';
    let category = $('#' + algId).data('category') || '';
    $('#subset-input').val(subset);
    $('#category-input').val(category);
    $('#alg-name-input').val(S.currentAlgName);
    $('#ignore-input').val($('#' + algId).data('ignore') || '');
    const isLocked = localStorage.getItem(`DisableOverride-${algId}`) === 'true';
    ($('#override-locked-checkbox').get(0) as HTMLInputElement).checked = isLocked;
    // Restore case state and apply ignore mask
    S.currentMasking = $('#' + algId).data('masking') || undefined;
    const display = compensatedDisplayAlg(S.editingOriginalAlg);
    S.twistyPlayer.alg = display;
    syncMirrorAlg(display);
    applyStickeringMask($('#' + algId).data('ignore') || '');
    $('#save-container').show();
  });

  // .edit-case-btn on #alg-cases tiles - opens edit mode for a specific algorithm case
  $('#alg-cases').on('click', '.edit-case-btn', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const btn = $(this);
    const algorithm = btn.data('algorithm') as string;
    const name = btn.data('name') as string;
    const algId = algToId(algorithm);
    const category = btn.data('category') || '';
    const subset = btn.data('subset') || '';
    // Stop and reset timer
    setTimerState("IDLE");
    setTimerValue(0);
    S.inputMode = true;
    $('#alg-display-container').hide();
    $('#alg-input').show();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    $('#app-top').show();
    $('#save-success').hide();
    $('#save-error').hide();
    $('#alg-fix').hide();
    $('#alg-help-info').hide();
    S.editingAlgId = algId;
    S.editingOriginalAlg = Alg.fromString(algorithm).invert().toString();
    S.editingSetupAlg = S.editingOriginalAlg;
    $('#subset-input').val(subset);
    $('#category-input').val(category);
    $('#alg-name-input').val(name);
    $('#alg-input').val(algorithm);
    $('#ignore-input').val($('#' + algId).data('ignore') || '');
    const isLocked = localStorage.getItem(`DisableOverride-${algId}`) === 'true';
    ($('#override-locked-checkbox').get(0) as HTMLInputElement).checked = isLocked;
    $('#edit-controls').removeClass('hidden');
    // Restore case state and apply ignore mask
    S.currentMasking = $('#' + algId).data('masking') || undefined;
    const display = compensatedDisplayAlg(S.editingOriginalAlg);
    S.twistyPlayer.alg = display;
    syncMirrorAlg(display);
    applyStickeringMask($('#' + algId).data('ignore') || '');
    $('#save-container').show();
  });

  // #cancel-save button - discards edits and re-presents the current case without saving
  $('#cancel-save').on('click', () => {
    $('#save-container').hide();
    $('#edit-controls').addClass('hidden');
    $('#apply-at-cursor-checkbox').prop('checked', false);
    // Re-present the current case by triggering train with the original alg
    if (S.checkedAlgorithms.length > 0) {
      $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
    }
    $('#train-alg').trigger('click');
  });

  // #edit-reset-btn button - restores the cube to the saved setup state during editing
  $('#edit-reset-btn').on('click', () => {
    if (S.editingOriginalAlg) {
      S.editingSetupAlg = S.editingOriginalAlg;
      const display = compensatedDisplayAlg(S.editingSetupAlg);
      S.twistyPlayer.alg = display;
      syncMirrorAlg(display);
    }
  });

  // #ignore-input text field - applies the ignore-pieces stickering mask live as user types
  $('#ignore-input').on('input', () => {
    const ignorePieces = $('#ignore-input').val()?.toString() || '';
    applyStickeringMask(ignorePieces);
    // Restore setup to get a clean initial state with the new masking
    if (S.editingOriginalAlg) {
      S.editingSetupAlg = S.editingOriginalAlg;
      const display = compensatedDisplayAlg(S.editingSetupAlg);
      S.twistyPlayer.alg = display;
      syncMirrorAlg(display);
    }
  });

  // #edit-setup-btn button - saves the current visual cube state as the new "original" setup
  $('#edit-setup-btn').on('click', () => {
    S.editingOriginalAlg = S.editingSetupAlg;
    const display = compensatedDisplayAlg(S.editingSetupAlg);
    S.twistyPlayer.alg = display;
    syncMirrorAlg(display);
    // If apply-at-cursor is checked, blur the input to show full setup
    if (($('#apply-at-cursor-checkbox').get(0) as HTMLInputElement)?.checked) {
      ($('#alg-input').get(0) as HTMLInputElement)?.blur();
    }
  });

  // #apply-at-cursor-checkbox toggle - when unchecked, restores the full case setup view
  $('#apply-at-cursor-checkbox').on('change', function () {
    if (!(this as HTMLInputElement).checked) {
      if (S.editingSetupAlg) {
        const display = compensatedDisplayAlg(S.editingSetupAlg);
        S.twistyPlayer.alg = display;
        syncMirrorAlg(display);
      }
    }
  });

  // #alg-input text field click/keyup - updates the cube visualization to show partial execution at cursor
  $('#alg-input').on('click keyup', function () {
    if (!($('#apply-at-cursor-checkbox').get(0) as HTMLInputElement)?.checked) return;
    if (!$('#save-container').is(':visible')) return;
    const input = this as HTMLInputElement;
    const fullAlg = input.value || '';
    const cursorPos = input.selectionStart ?? fullAlg.length;

    // Split at cursor respecting move boundaries
    const [leftMoves] = splitAlgAtCursor(fullAlg, cursorPos);

    // Display = setup + partial execution of the typed alg
    const partialDisplay = leftMoves ? `${S.editingSetupAlg} ${leftMoves}` : S.editingSetupAlg;
    const display = compensatedDisplayAlg(partialDisplay);
    S.twistyPlayer.alg = display;
    syncMirrorAlg(display);
  });

  // #alg-input text field blur - restores the full setup view when the input loses focus
  $('#alg-input').on('blur', function () {
    if (!($('#apply-at-cursor-checkbox').get(0) as HTMLInputElement)?.checked) return;
    if (!$('#save-container').is(':visible')) return;
    // Small delay to allow button clicks to register first
    setTimeout(() => {
      if (!$('#alg-input').is(':focus')) {
        if (S.editingSetupAlg) {
          const display = compensatedDisplayAlg(S.editingSetupAlg);
          S.twistyPlayer.alg = display;
          syncMirrorAlg(display);
        }
      }
    }, 100);
  });

  // #confirm-save button - validates inputs and saves the algorithm to localStorage
  $('#confirm-save').on('click', () => {
    const category = $('#category-input').val()?.toString().trim() || '';
    const subset = $('#subset-input').val()?.toString().trim() || '';
    const name = $('#alg-name-input').val()?.toString().trim() || '';
    const algorithm = expandNotation($('#alg-input').val()?.toString().trim() || '');
    if (category.length > 0 && subset.length > 0 && name.length > 0 && algorithm.length > 0) {
      const newAlgId = algToId(algorithm);
      // Preserve learning/selection status from the old alg if we were editing an existing case
      if (S.editingAlgId && S.editingAlgId !== newAlgId) {
        const learnedVal = localStorage.getItem(`Learned-${S.editingAlgId}`);
        if (learnedVal) localStorage.setItem(`Learned-${newAlgId}`, learnedVal);
        const selectedVal = localStorage.getItem(`Selected-${S.editingAlgId}`);
        if (selectedVal) localStorage.setItem(`Selected-${newAlgId}`, selectedVal);
        const disableOverrideVal = localStorage.getItem(`DisableOverride-${S.editingAlgId}`);
        if (disableOverrideVal) localStorage.setItem(`DisableOverride-${newAlgId}`, disableOverrideVal);
        else localStorage.removeItem(`DisableOverride-${newAlgId}`);
        // Reset timing data since the algorithm changed
        localStorage.removeItem(`Best-${newAlgId}`);
        localStorage.removeItem(`LastTimes-${newAlgId}`);
        localStorage.removeItem(`Best-CD-${newAlgId}`);
        localStorage.removeItem(`LastTimes-CD-${newAlgId}`);
        localStorage.removeItem(`ConsecutiveCorrect-${newAlgId}`);
      }
      // Save locked (disable override) state from checkbox
      const lockedAlgId = S.editingAlgId || newAlgId;
      const isLockedChecked = ($('#override-locked-checkbox').get(0) as HTMLInputElement).checked;
      if (isLockedChecked) {
        localStorage.setItem(`DisableOverride-${lockedAlgId}`, 'true');
      } else {
        localStorage.removeItem(`DisableOverride-${lockedAlgId}`);
      }
      S.editingAlgId = '';
      const ignoreRaw = $('#ignore-input').val()?.toString() || '';
      // Normalize: uppercase, split on ; / , / whitespace, join with ;
      const ignoreNormalized = ignoreRaw.split(/[;,\s]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0).join(';');
      const ignore = ignoreNormalized.length > 0 ? ignoreNormalized : undefined;
      saveAlgorithm(category, subset, name, algorithm, ignore);
      $('#category-input').val('');
      $('#alg-name-input').val('');
      $('#subset-input').val('');
      $('#ignore-input').val('');
      $('#save-error').hide();
      $('#save-success').text('Algorithm saved successfully');
      $('#save-success').show();
      setTimeout(() => {
        $('#save-success').fadeOut();
      }, 3000);
      $('#save-container').hide();
      // Refresh category dropdown and case list WITHOUT resetting the practice session
      loadCategories();
      $('#category-select').val(category);
      loadSubsets(category);
      rebuildCheckedAlgorithms();
      updateSelectionControls();
      // Resume practice - present the just-saved algorithm next so user can test it out
      if (S.checkedAlgorithms.length > 0) {
        // Find the just-saved alg in the rotation and move it to front
        const savedIdx = S.checkedAlgorithms.findIndex(a => a.algorithm === algorithm);
        if (savedIdx > 0) {
          const [savedAlg] = S.checkedAlgorithms.splice(savedIdx, 1);
          S.checkedAlgorithms.unshift(savedAlg);
        }
        S.inputMode = false;
        $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
        $('#alg-input').hide();
        $('#train-alg').trigger('click');
      }
    } else {
      $('#save-success').hide();
      $('#save-error').text('Please fill in all fields');
      $('#save-error').show();
      setTimeout(() => {
        $('#save-error').fadeOut();
      }, 3000);
    }
  });

  // #save-alg nav button - shows the save form for entering a new algorithm
  $('#save-alg').on('click', () => {
    S.inputMode = true;
    $('#alg-display-container').hide();
    $('#times-display').html('');
    $('#timer-container').hide();
    $('#left-side-inner').hide();
    $('#alg-stats').hide();
    $('#alg-scramble').hide();
    $('#alg-help-info').hide();
    $('#last-case-tile').hide();
    // Note: #last-time-display is intentionally kept visible (handled by updateTimesDisplay)
    $('#alg-input').show();
    $('#alg-input').get(0)?.focus();
    $('#app-top').show();
    $('#save-success').hide();
    $('#save-error').hide();
    $('#save-container').show();
    $('#load-container').hide();
    $('#options-container').hide();
    $('#help').hide();
    $('#info').hide();
  });
}
