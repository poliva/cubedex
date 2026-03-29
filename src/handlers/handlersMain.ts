import $ from 'jquery';
import { Alg } from 'cubing/alg';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { S } from '../state';
import { expandSliceDoubles } from '../algUtils';
import {
  expandNotation, fixOrientation, algToId, setStickering,
  learnedStatus, learnedSVG, buildStickeringMaskString, applyMaskToPlayer,
} from '../functions';
import {
  syncMirrorAlg, showFlashingIndicator, amimateCubeOrientation,
  updateOrientationHint, updateRotationIndicator, applyStickeringMask,
  resetmasterRepairFaceMap,
} from '../visualization';
import {
  cancelStareDelay, resetAlg, hideMistakes, updateAlgDisplay,
  fetchNextPatterns, countLearningCases, switchToNextAlgorithm, transitionToNextCase,
} from '../trainer';
import { setTimerState, setTimerValue } from '../timer';
import { updateTimesDisplay } from '../statsPanel';
import { getScrambleToSolution } from './moveHandler';

/** Toggles algorithm move masking on/off and updates the button icon. */
function toggleMoveMask() {
  S.isMoveMasked = !S.isMoveMasked;
  $('.move').each(function () {
    $(this).css('-webkit-text-security', S.isMoveMasked ? 'disc' : 'none');
  });
  $('#toggle-move-mask').toggleClass('bg-orange-500 hover:bg-orange-700', S.isMoveMasked).toggleClass('bg-blue-500 hover:bg-blue-700', !S.isMoveMasked);
  $('#toggle-move-mask').html(S.isMoveMasked ? '<svg fill="currentColor" class="h-6 w-6 inline-block" viewBox="-5.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M10.32 22.32c-5.6 0-9.92-5.56-10.12-5.8-0.24-0.32-0.24-0.72 0-1.040 0.2-0.24 4.52-5.8 10.12-5.8s9.92 5.56 10.12 5.8c0.24 0.32 0.24 0.72 0 1.040-0.2 0.24-4.56 5.8-10.12 5.8zM1.96 16c1.16 1.32 4.52 4.64 8.36 4.64s7.2-3.32 8.36-4.64c-1.16-1.32-4.52-4.64-8.36-4.64s-7.2 3.32-8.36 4.64zM10.32 20c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.84 4-4 4zM10.32 13.68c-1.28 0-2.32 1.040-2.32 2.32s1.040 2.32 2.32 2.32 2.32-1.040 2.32-2.32-1.040-2.32-2.32-2.32z"></path></svg> Unmask alg' : '<svg fill="currentColor" class="h-6 w-6 inline-block" viewBox="-5.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M20.44 15.48c-0.12-0.16-2.28-2.92-5.48-4.56l0.92-3c0.12-0.44-0.12-0.92-0.56-1.040s-0.92 0.12-1.040 0.56l-0.88 2.8c-0.96-0.32-2-0.56-3.080-0.56-5.6 0-9.92 5.56-10.12 5.8-0.24 0.32-0.24 0.72 0 1.040 0.16 0.24 4.2 5.36 9.48 5.76l-0.56 1.8c-0.12 0.44 0.12 0.92 0.56 1.040 0.080 0.040 0.16 0.040 0.24 0.040 0.36 0 0.68-0.24 0.8-0.6l0.72-2.36c5-0.68 8.8-5.48 9-5.72 0.24-0.28 0.24-0.68 0-1zM1.96 16c1.16-1.32 4.52-4.64 8.36-4.64 0.88 0 1.76 0.2 2.6 0.48l-0.28 0.88c-0.68-0.48-1.48-0.72-2.32-0.72-2.2 0-4 1.8-4 4s1.8 4 4 4c0.040 0 0.040 0 0.080 0l-0.2 0.64c-3.8-0.080-7.080-3.36-8.24-4.64zM10.88 18.24c-0.2 0.040-0.4 0.080-0.6 0.080-1.28 0-2.32-1.040-2.32-2.32s1.040-2.32 2.32-2.32c0.68 0 1.32 0.32 1.76 0.8l-1.16 3.76zM12 20.44l2.4-7.88c1.96 1.080 3.52 2.64 4.24 3.44-0.96 1.12-3.52 3.68-6.64 4.44z"></path></svg> Mask alg');
}

/** Resets the current practice drill from the live physical cube state (does not reset timer). */
function doResetPractice() {
  S.forceFix = true;
  requestAnimationFrame(amimateCubeOrientation);
  cancelStareDelay();
  resetAlg();
  // Recompute pattern states from current cube state (same as initial presentation)
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
  // Reset animation on both main and mirror players (use stored display alg which includes compensation + color rotation)
  const resetAlgStr = S.currentDisplayAlg || Alg.fromString(S.userAlg.join(' ')).invert().toString();
  S.twistyPlayer.alg = resetAlgStr;
  syncMirrorAlg(resetAlgStr);
  // Re-apply correct stickering with the same rotated ignore mask as the current case
  applyStickeringMask(S.currentRotatedIgnore);
  S.phantomModeActive = false;
  // Don't stop/reset the timer or trigger countdown - time keeps running
  updateAlgDisplay();
  // Hide reset button after reset
  $('#reset-practice-btn').addClass('hidden');
}

/** Toggles the local (keyboard/touch) timer between start and stop. */
function activateTimer() {
  if (S.timerState == "STOPPED" || S.timerState == "IDLE" || S.timerState == "READY") {
    showFlashingIndicator('gray', 200);
    setTimerState("RUNNING");
  } else {
    setTimerState("STOPPED");
  }
}

/** Registers event handlers for the main practice page (training, timer, navigation, keyboard). */
export function initMainHandlers() {
  // #train-alg button - parses the algorithm input and starts the practice session
  $('#train-alg').on('click', () => {
    const algInput = $('#alg-input').val()?.toString().trim();
    if (algInput) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      S.inputMode = false;
      const expandedNotation = expandNotation(algInput).split(/\s+/);
      S.displayAlg = [...expandedNotation];
      S.userAlg = expandSliceDoubles(expandedNotation);
      S.currentAlgName = S.checkedAlgorithms[0]?.name || '';
      $('#alg-display').text(S.displayAlg.join(' '));
      $('#alg-display-container').show();
      $('#timer-container').show();
      $('#alg-input').hide();
      $('#save-container').hide();
      $('#edit-controls').addClass('hidden');
      $('#apply-at-cursor-checkbox').prop('checked', false);
      hideMistakes();
      if (S.scrambleMode && !S.alwaysScrambleTo) {
        $('#alg-scramble').hide();
        $('#alg-help-info').hide();
        S.scrambleMode = false;
      }
      S.hasFailedAlg = false;
      S.hadBadMoveDuringExec = false;
      S.hasTPSFail = false;
      // Kill any pending visual timeouts from previous case
      if (S.pendingSliceVisTimeout) { clearTimeout(S.pendingSliceVisTimeout); S.pendingSliceVisTimeout = null; }
      S.pendingSliceVis = null;
      S.reverseSliceBuffer = null;
      // Auto-set unknown cases to "learning" when presented (respecting limit)
      const currentAlgId = algToId(algInput);
      if (S.autoPromoteLearning && learnedStatus(currentAlgId) === 0) {
        if (!S.limitLearningEnabled || countLearningCases() < S.maxConcurrentLearning) {
          localStorage.setItem(`Learned-${currentAlgId}`, '1');
          $(`#bookmark-${currentAlgId}`).html(learnedSVG(1));
        }
      }
      S.patternStates = [];
      S.algPatternStates = [];
      fetchNextPatterns();
      setTimerState("READY");
      if (!S.countdownModeEnabled) {
        updateTimesDisplay();
      }
      S.scrambleToAlg = [];
      if (S.alwaysScrambleTo) {
        $('#scramble-to').trigger('click');
      }
      $("#alg-name-display-container").show();
      $('#left-side-inner').show();
      $('#alg-stats').css("display", "flex");
    } else if ($('#subset-checkboxes-container input[type="checkbox"]').length > 0 && S.checkedAlgorithms.length === 0) {
      // No alg loaded but subsets are available - auto-select all subsets to start practice
      $('#select-all-subsets-toggle').prop('checked', true).trigger('change');
    } else {
      $('#alg-input').show();
      $('#alg-stats').hide();
      $('#left-side-inner').hide();
      $('#alg-input').get(0)?.focus();
    }
    resetAlg();
    if ($('#alg-display').text() !== '') {
      updateAlgDisplay();
    }
    updateOrientationHint();
    S.lastCompletedAlgStr = '';
  });

  // #input-alg nav button - switches to manual algorithm input mode, clearing the practice session
  $('#input-alg').on('click', () => {
    cancelStareDelay();
    applyMaskToPlayer(S.twistyPlayer, buildStickeringMaskString('full'));
    S.twistyPlayer.alg = '';
    syncMirrorAlg('');
    resetAlg();
    $('#alg-input').val('');
    S.inputMode = true;
    S.checkedAlgorithms = [];
    S.checkedAlgorithmsCopy = [];
    updateTimesDisplay();
    hideMistakes();
    S.scrambleMode = false;
    $('#alg-scramble').hide();
    $('#alg-help-info').hide();
    $('#alg-display-container').hide();
    $('#times-display').html('');
    $('#timer-container').hide();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    $('#alg-input').show();
    $('#alg-input').get(0)?.focus();
    $('#app-top').show();
    $('#help').hide();
    $('#options-container').hide();
    $('#load-container').hide();
    $('#save-container').hide();
    $('#info').hide();
  });

  // #show-help nav button - navigates to the help/instructions page
  $('#show-help').on('click', () => {
    $('#help').show();
    $('#app-top').hide();
    $('#options-container').hide();
    $('#load-container').hide();
    $('#save-container').hide();
    $('#info').hide();
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
  });

  // #scramble-to button - generates a scramble sequence to reach the algorithm's starting position
  $('#scramble-to').on('click', () => {
    (async () => {
      let cubePattern = await S.twistyTracker.experimentalModel.currentPattern.get();
      let scramble = getScrambleToSolution(S.userAlg.join(' '), cubePattern);
      if (scramble.length > 0) {
        S.scrambleMode = true;
        S.scrambleToAlg = [...S.userAlg];
        cancelStareDelay();
        resetAlg();
        $('#alg-scramble').show();
        $('#alg-scramble').text(scramble);
        // draw real cube state
        if (S.conn) {
          var solution = await experimentalSolve3x3x3IgnoringCenters(cubePattern);
          S.twistyPlayer.alg = solution.invert();
          syncMirrorAlg(solution.invert());
        }
      } else {
        S.scrambleMode = false;
        $('#alg-scramble').hide();
        $('#alg-help-info').hide();
      }
    })();
  });

  // #reset-practice-btn button - resets the current solve without stopping the timer
  $('#reset-practice-btn').on('click', (e) => { e.preventDefault(); doResetPractice(); });

  // #skip-case-btn - skip to next case without recording any statistics
  $('#skip-case-btn').on('click', () => {
    if (S.timerState === 'IDLE') return;
    // Hide any active red/error flashing indicator immediately
    const flashEl = document.getElementById('flashing-indicator');
    if (flashEl) flashEl.classList.add('hidden');
    cancelStareDelay();
    resetAlg();
    setTimerState('IDLE');
    S.phantomModeActive = false;
    switchToNextAlgorithm(true);
    if (S.checkedAlgorithms.length > 0) {
      $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
    }
    transitionToNextCase();
    $('#train-alg').trigger('click');
  });

  // #restart-case-btn - restart current case: reset timer and solve state
  $('#restart-case-btn').on('click', () => {
    if (S.timerState === 'IDLE') return;
    cancelStareDelay();
    resetAlg();
    S.hasFailedAlg = false;
    S.hadBadMoveDuringExec = false;
    S.hasTPSFail = false;
    S.phantomModeActive = false;
    // Rebuild pattern states from current initial state
    S.patternStates = [];
    S.algPatternStates = [];
    S.userAlg.forEach((move, index) => {
      const m = move.replace(/[()]/g, '');
      if (index === 0) S.patternStates[index] = S.initialstate.applyMove(m);
      else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(m);
      S.algPatternStates[index] = S.patternStates[index];
      S.patternStates[index] = fixOrientation(S.patternStates[index]);
    });
    const resetAlgStr = S.currentDisplayAlg || Alg.fromString(S.userAlg.join(' ')).invert().toString();
    S.twistyPlayer.alg = resetAlgStr;
    syncMirrorAlg(resetAlgStr);
    applyStickeringMask(S.currentRotatedIgnore);
    updateAlgDisplay();
    setTimerState('READY');
    $('#reset-practice-btn').addClass('hidden');
  });

  // #orientation-reset-btn button - fully resets cube state, errors, and timer to re-attempt the case
  $('#orientation-reset-btn').on('click', () => {
    S.forceFix = true;
    requestAnimationFrame(amimateCubeOrientation);
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
    updateAlgDisplay();
    S.hasFailedAlg = false;
    S.hadBadMoveDuringExec = false;
    S.hasTPSFail = false;
    setTimerState("READY");
    $('#orientation-reset-btn').addClass('hidden');
    $('#reset-practice-btn').addClass('hidden');
  });

  // #rotation-reset-btn button - clears the accumulated rotation and hides the indicator
  $('#rotation-reset-btn').on('click', () => {
    resetmasterRepairFaceMap();
    updateRotationIndicator();
  });

  // Numpad-0 hotkey - triggers practice reset when a solve is in progress
  $(document).on('keydown', (event) => {
    if (event.which === 96 /* Numpad 0 */ && !$('#reset-practice-btn').hasClass('hidden')) {
      event.preventDefault();
      doResetPractice();
    }
  });

  // Numpad-1 hotkey - toggles algorithm masking when in practice mode
  $(document).on('keydown', (event) => {
    if (event.which === 97 /* Numpad 1 */ && $('#alg-display-container').is(':visible')) {
      event.preventDefault();
      toggleMoveMask();
    }
  });

  // #toggle-move-mask button - toggles the algorithm text masking (hides/reveals moves)
  $('#toggle-move-mask').on('click', (event) => {
    event.preventDefault();
    toggleMoveMask();
  });

  // #menu-toggle hamburger button - toggles the navigation menu visibility
  const menuToggle = document.getElementById('menu-toggle');
  const menuItems = document.getElementById('menu-items');
  if (menuToggle && menuItems) {
    menuToggle.addEventListener('click', () => {
      menuItems.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!menuToggle.contains(target) && !menuItems.contains(target)) {
        menuItems.classList.add('hidden');
      }
    });
  }

  // Menu item buttons - highlights the selected menu item
  const menuButtons = document.querySelectorAll('#menu-items button');
  menuButtons.forEach(item => {
    item.addEventListener('click', () => {
      menuButtons.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });

  // Spacebar keydown - prepares the local timer (STOPPED->READY, RUNNING->STOPPED)
  $(document).on('keydown', (event) => {
    if (!S.conn && !S.inputMode && event.which === 32) {
      event.preventDefault();
      if (S.timerState == "STOPPED" || S.timerState == "IDLE") {
        setTimerValue(0);
        setTimerState("READY");
      } else if (S.timerState == "RUNNING") {
        setTimerState("STOPPED");
      } else if (S.timerState == "READY" && !S.isKeyboardTimerActive) {
        setTimerValue(0);
      }
    }
  });

  // Spacebar keyup - starts the local timer on release (prevents double-trigger)
  $(document).on('keyup', (event) => {
    if (!S.conn && !S.inputMode && event.which === 32) {
      event.preventDefault();
      if (S.timerState == "READY" && !S.isKeyboardTimerActive) {
        activateTimer();
        S.isKeyboardTimerActive = true;
      } else {
        S.isKeyboardTimerActive = false;
      }
    }
  });

  // Touch event tracking - distinguishes taps from scrolls for the touch timer
  $(document).on('touchstart', function () {
    S.isScrolling = false;
  });

  $(document).on('touchmove', function () {
    S.isScrolling = true;
  });

  // #touch-timer area touchend - activates the local timer on tap (not scroll)
  $("#touch-timer").on('touchend', () => {
    if (!S.conn && !S.inputMode && !S.isScrolling) {
      activateTimer();
    }
  });

  // #times-display area touchend - activates the local timer on tap (not scroll)
  $("#times-display").on('touchend', () => {
    if (!S.conn && !S.inputMode && !S.isScrolling) {
      activateTimer();
    }
  });

  // #cube area touchend - activates the local timer on tap (not scroll)
  $("#cube").on('touchend', () => {
    if (!S.conn && !S.inputMode && !S.isScrolling) {
      activateTimer();
    }
  });

  // #dumbcube-toggle link - switches help content between smart cube and non-smart cube instructions
  $('#dumbcube-toggle').on('click', () => {
    $('#help-content-smartcube').toggleClass('hidden');
    $('#help-content-dumbcube').toggleClass('hidden');
    if ($('#help-content-smartcube').hasClass('hidden')) {
      $('#help-title').text('DUMBCUBE HELP');
      $('#dumbcube-toggle').html('🛜 USING a smart cube? <a href="#" class="text-blue-500 hover:underline">CLICK HERE</a>');
    } else {
      $('#help-title').text('SMARTCUBE HELP');
      $('#dumbcube-toggle').html('🛜 NOT using a smart cube? <a href="#" class="text-blue-500 hover:underline">CLICK HERE</a>');
    }
  });
}
