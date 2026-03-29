import $ from 'jquery';
import { interval } from 'rxjs';
import { S } from './state';
import {
  now,
  makeTimeFromTimestamp,
  cubeTimestampLinearFit,
} from 'smartcube-web-bluetooth';
import {
  algToId, countMovesETM, bestTimeString, averageTimeString,
  averageOfFiveTimeNumber, learnedStatus, learnedSVG,
  getFailedCount, getSuccessCount,
} from './functions';
import { updateTimesDisplay } from './statsPanel';
import { switchToNextAlgorithm, transitionToNextCase, rebuildCheckedAlgorithms, updateAlgDisplay } from './trainer';

/** Formats and displays a timestamp (ms) as mm:ss.mmm in the #timer element. */
export function setTimerValue(timestamp: number) {
  let t = makeTimeFromTimestamp(timestamp);
  $('#timer').html(`${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`);
}

/** Starts a 30ms-interval local timer for keyboard/dumb-cube mode (no GAN connection). */
export function startLocalTimer() {
  stopLocalTimer();
  S.currentTimerValue = 0;
  var startTime = now();
  S.localTimer = interval(30).subscribe(() => {
    S.currentTimerValue = now() - startTime;
    setTimerValue(S.currentTimerValue);
  });
}

/** Stops the local interval timer. */
export function stopLocalTimer() {
  S.localTimer?.unsubscribe();
  S.localTimer = null;
}

/** Returns 'CD-' if countdown mode was used for the current solve, '' otherwise. */
export function timingPrefix(): string {
  return S.solveUsedCountdown ? 'CD-' : '';
}

/** Starts a visual countdown overlay (3-2-1) before the solve begins. */
export function startCountdown(onComplete: () => void) {
  const overlay = document.getElementById('countdown-overlay') as HTMLElement;
  const numberEl = document.getElementById('countdown-number') as HTMLElement;
  if (!overlay || !numberEl) { onComplete(); return; }
  $('#cube > twisty-player').css('visibility', 'hidden');
  overlay.classList.remove('hidden');
  let remaining = S.countdownSeconds;
  numberEl.textContent = String(remaining == 1 ? "ready..." : remaining);
  S.countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(S.countdownTimer!);
      S.countdownTimer = null;
      overlay.classList.add('hidden');
      $('#cube > twisty-player').css('visibility', '');
      updateAlgDisplay();
      onComplete();
    } else if (remaining == 1) {
      numberEl.textContent = "ready...";
    } else {
      numberEl.textContent = String(remaining);
    }
  }, 1000);
}

/** Cancels an in-progress countdown and restores normal cube display. */
export function cancelCountdown() {
  if (S.countdownTimer) {
    clearInterval(S.countdownTimer);
    S.countdownTimer = null;
  }
  const overlay = document.getElementById('countdown-overlay') as HTMLElement;
  if (overlay) overlay.classList.add('hidden');
  $('#cube > twisty-player').css('visibility', '');
}

/** Main timer state machine (IDLE->READY->RUNNING->STOPPED). Records times, updates stats, handles auto-promotion. */
export function setTimerState(state: typeof S.timerState, skipStats: boolean = false) {
  S.timerState = state;
  const algId = algToId(S.originalUserAlg.join(' '));
  if ($('#' + algId).length === 0) {
    $('#default-alg-id').append(`<div id="${algId}" class="hidden"></div>`);
  }

  const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;

  switch (state) {
    case "IDLE":
      stopLocalTimer();
      $('#timer-container').hide();
      $('#reset-practice-container').hide();
      $('#train-alg').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>');
      break;
    case 'READY':
      stopLocalTimer();
      cancelCountdown();
      S.solveUsedCountdown = S.countdownModeEnabled;
      $('#reset-practice-container').hide();
      $('#reset-practice-btn').addClass('hidden');
      setTimerValue(0);
      $('#timer-container').show();
      $('#timer').css('color', '#080');
      $('#train-alg').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>');
      if (S.countdownModeEnabled) {
        S.savedAlgDisplayHtml = $('#alg-display').html();
        $('#alg-display').html('');
        startCountdown(() => {
          updateTimesDisplay();
          setTimerState("RUNNING");
        });
      }
      break;
    case 'RUNNING':
      S.solutionMoves = [];
      startLocalTimer();
      $('#timer').css('color', '#999');
      $('#train-alg').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 32 32"><path d="M8 8h16v16H8z"/></svg>');
      break;
    case 'STOPPED': {
      // -- Stage 1: Stop timer & compute final time --------------------
      const localElapsed = S.currentTimerValue;
      stopLocalTimer();
      let finalTime = localElapsed;
      if (S.conn && !S.solveUsedCountdown) {
        const fittedMoves = cubeTimestampLinearFit(S.solutionMoves);
        const lastMove = fittedMoves[fittedMoves.length - 1];
        const fitted =
          lastMove != null &&
          lastMove.cubeTimestamp != null &&
          Number.isFinite(lastMove.cubeTimestamp)
            ? lastMove.cubeTimestamp
            : 0;
        if (fitted > 0) {
          finalTime = fitted;
        }
      }

      // -- Stage 2: Update timer UI ------------------------------------
      const stoppedColor = darkModeToggle.checked ? '#ccc' : '#333';
      $('#timer').css('color', stoppedColor);
      setTimerValue(finalTime);
      $('#train-alg').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>');

      // -- Stage 3: Determine outcome (TPS check) ---------------------
      if (!skipStats && finalTime > 0 && S.tpsFailEnabled && !S.hasFailedAlg) {
        const moveCount = countMovesETM(S.originalUserAlg.join(' '));
        const recognitionTime = S.solveUsedCountdown ? S.countdownFailThreshold * 1000 : 0;
        const targetTime = recognitionTime + (moveCount / S.tpsFailThreshold) * 1000;
        if (finalTime > targetTime) {
          // console.log(`[fail] TPS fail: finalTime=${finalTime}ms > targetTime=${targetTime.toFixed(0)}ms (${moveCount}moves @ ${S.tpsFailThreshold}tps) -> hasTPSFail=true`);
          S.hasFailedAlg = true;
          S.hasTPSFail = true;
        }
      }
      const solveSuccess = !S.hasFailedAlg && !S.hadBadMoveDuringExec;
      S.lastSolveSuccess = solveSuccess;
      // console.log(`[outcome] STOPPED: hasFailedAlg=${S.hasFailedAlg} hasTPSFail=${S.hasTPSFail} hadBadMoveDuringExec=${S.hadBadMoveDuringExec} -> lastSolveSuccess=${S.lastSolveSuccess}`);

      // -- Stage 4: Store results -------------------------------------
      if (!skipStats && finalTime > 0) {
        const prefix = timingPrefix();
        S.lastSolveTime = finalTime;

        // 4a. Append solve time (cap at 100)
        const lastTimesStorage = localStorage.getItem('LastTimes-' + prefix + algId);
        const lastTimes: number[] = lastTimesStorage
          ? lastTimesStorage.split(',').map(num => Number(num.trim()))
          : [];
        lastTimes.push(finalTime);
        if (lastTimes.length > 100) lastTimes.shift();
        localStorage.setItem('LastTimes-' + prefix + algId, lastTimes.join(','));

        // 4b. Update personal best
        const bestTime = localStorage.getItem('Best-' + prefix + algId);
        if (!bestTime || finalTime < Number(bestTime)) {
          localStorage.setItem('Best-' + prefix + algId, String(finalTime));
        }

        // 4c. Increment FailedCount on failure (wrong moves or TPS fail)
        if (!solveSuccess) {
          const newFailed = getFailedCount(algId) + 1;
          localStorage.setItem('FailedCount-' + algId, String(newFailed));
          $('#' + algId).data('failed', newFailed);
        }

        // 4d. Increment SuccessCount on success
        if (solveSuccess) {
          const prev = parseInt(localStorage.getItem('SuccessCount-' + algId) || '0');
          localStorage.setItem('SuccessCount-' + algId, String(prev + 1));
        }

        // 4e. Append to LastResults (S/F), cap at 100
        const prevResults = localStorage.getItem('LastResults-' + algId);
        const resultsArr = prevResults ? prevResults.split(',').filter(r => r === 'S' || r === 'F') : [];
        resultsArr.push(solveSuccess ? 'S' : 'F');
        if (resultsArr.length > 100) resultsArr.shift();
        localStorage.setItem('LastResults-' + algId, resultsArr.join(','));

        // -- Stage 5: Update streak & auto-promotion ------------------
        if (!S.hasFailedAlg) {
          const consecutive = parseInt(localStorage.getItem(`ConsecutiveCorrect-${algId}`) || '0') + 1;
          localStorage.setItem(`ConsecutiveCorrect-${algId}`, String(consecutive));
          if (S.autoPromoteLearned && consecutive >= S.promotionThreshold && learnedStatus(algId) === 1) {
            localStorage.setItem(`Learned-${algId}`, '2');
            $(`#bookmark-${algId}`).html(learnedSVG(2));
            rebuildCheckedAlgorithms();
          }
        } else {
          localStorage.setItem(`ConsecutiveCorrect-${algId}`, '0');
        }

        // -- Stage 6: Update displayed stats --------------------------
        $('#' + algId).removeClass('bg-red-400 dark:bg-red-400');
        const successCount = getSuccessCount(algId);
        const failedCount = getFailedCount(algId);
        $('#' + algId + '-success').html(`\u2705: ${successCount}`);
        if (failedCount > 0) $('#' + algId + '-failed').html(`\u274C: ${failedCount}`);
        $('#best-time-' + algId).html(`Best: ${bestTimeString(Number(localStorage.getItem('Best-' + prefix + algId)))}`);
        $('#ao5-time-' + algId).html(`Ao5: ${averageTimeString(averageOfFiveTimeNumber(algId, prefix))}`);

        // -- Stage 7: Transition to next case (keyboard mode) ---------
        if (!S.conn) {
          updateTimesDisplay();
          switchToNextAlgorithm();
          if (S.checkedAlgorithms.length > 0) {
            $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
          }
          S.lastCompletedAlgStr = S.userAlg.join(' ');
          transitionToNextCase();
        }
      }
      break;
    }
  }
}
