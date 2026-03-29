import $ from 'jquery';
import { S } from './state';
import { makeTimeFromTimestamp } from 'smartcube-web-bluetooth';
import {
  algToId, countMovesETM, getLastTimes, bestTimeNumber, bestTimeString,
  averageOfFiveTimeNumber, averageOf12TimeNumber, averageTimeString,
  learnedStatus, learnedSVG, createTimeGraph, createStatsGraph,
  getFailedCount, getSuccessCount, getPracticeCount,
} from './functions';
import { renderLastCaseTile } from './tile';
import { timingPrefix } from './timer';

/** Rebuilds the practice-page statistics panel: graphs, PB, averages, TPS, success/fail, and last-case tile. */
export function updateTimesDisplay() {
  const timesDisplay = $('#times-display');
  const algNameDisplay = $('#alg-name-display');
  const algNameDisplay2 = $('#alg-name-display2');

  // When showPrevStatsEnabled is on, div#alg-stats shows the previous case's data.
  // But p#alg-name-display (LEFT side) always shows the CURRENT case name.
  const usePrev = S.showPrevStatsEnabled && S.previousAlgId;
  const algId = usePrev ? S.previousAlgId : algToId(S.originalUserAlg.join(' '));
  const displayName = usePrev ? S.previousAlgName : S.currentAlgName;
  const prefix = timingPrefix();

  // Use the new function to get last times (mode-specific)
  const lastTimes = getLastTimes(algId, prefix);
  const bestTime = bestTimeNumber(algId, prefix);

  algNameDisplay.text(S.showAlgNameEnabled ? S.currentAlgName : '');
  algNameDisplay2.text(S.showAlgNameEnabled ? `${displayName}` : '');

  // Show mode label
  $('#stats-mode-label').text(S.countdownModeEnabled ? 'recognition + execution' : 'execution');

  // Show combined success/fail counts
  const failedCount = getFailedCount(algId);
  const successCount = getSuccessCount(algId);
  const combinedPracticeCount = getPracticeCount(algId);
  if (combinedPracticeCount > 0) {
    const failPart = failedCount > 0 ? `  ❌: ${failedCount}` : '';
    $('#stats-success-fail').html(`✅: ${successCount}${failPart}`);
  } else {
    $('#stats-success-fail').html('');
  }

  // Update learned state bookmark in the practice stats area
  $('#stats-bookmark-btn').html(learnedSVG(learnedStatus(algId))).attr('data-algid', algId);

  createTimeGraph(lastTimes.slice(-5));
  createStatsGraph(lastTimes);

  // Calculate average time
  const averageTime = lastTimes.reduce((a: number, b: number) => a + b, 0) / lastTimes.length;
  const avgTimeStr = averageTimeString(averageTime);
  $('#average-time-box').html(`Average Time<br />${avgTimeStr !== '-' ? avgTimeStr + ' s' : '-'}`);

  // Show last solve time below the timer (from the most recently completed case).
  // Visible when showLastTimeEnabled enabled and a time is available, independent of showLastCaseTileEnabled.
  if (S.lastSolveTime && S.showLastTimeEnabled) {
    const icon = S.lastSolveSuccess === false ? ' ❌' : S.lastSolveSuccess === true ? ' ✅' : '';
    $('#last-time-display').text(`Previous: ${bestTimeString(S.lastSolveTime)}${icon}`).show();
  } else {
    $('#last-time-display').hide();
  }

  // Tile is separately gated by showLastCaseTileEnabled.
  renderLastCaseTile();

  // Calculate average TPS
  const moveCount = countMovesETM(usePrev ? S.previousAlgMoves : S.userAlg.join(' '));
  const averageTPS = averageTime ? (moveCount / (averageTime / 1000)).toFixed(2) : '-';
  $('#average-tps-box').html(`Average TPS<br />${averageTPS}`);

  // check if the last item added to lastTimes is a PB
  const lastTime = lastTimes.slice(-1)[0];
  const isPB = lastTime === bestTime;

  // Get single PB
  const singlePB = isPB ? `${bestTimeString(bestTime)} 🎉` : bestTimeString(bestTime);
  $('#single-pb-box').html(`Single PB<br />${singlePB}`);

  // Ao12 and TPSo12
  const ao12 = averageOf12TimeNumber(algId, prefix);
  const ao12Str = ao12 ? averageTimeString(ao12) + ' s' : '-';
  $('#ao12-box').html(`Ao12<br />${ao12Str}`);
  const tpso12 = ao12 ? (moveCount / (ao12 / 1000)).toFixed(2) : '-';
  $('#tpso12-box').html(`TPSo12<br />${tpso12}`);


  if (lastTimes.length === 0) {
    timesDisplay.html('');
    $('#alg-stats').hide();
    $('#left-side-inner').hide();
    return;
  }

  const practiceCount: number = $('#' + algId).data('count') || 0;
  const timesHtml = lastTimes.slice(-5).map((time: number, index: number) => {
    const t = makeTimeFromTimestamp(time);
    let number = practiceCount < 5 ? index + 1 : practiceCount - 5 + index + 1;
    // Add emoji if the time is a PB
    const emojiPB = time === bestTime ? ' 🎉' : '';
    const minutesPart = t.minutes > 0 ? `${t.minutes}:` : '';
    return `<div class="text-right">Time ${number}:</div><div class="text-left">${minutesPart}${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}${emojiPB}</div>`;
  }).join('');

  const avgTime = averageOfFiveTimeNumber(algId, prefix) ?? 0;
  let averageHtml = '';
  if (avgTime > 0) {
    const avg = makeTimeFromTimestamp(avgTime);
    const avgMinutesPart = avg.minutes > 0 ? `${avg.minutes}:` : '';
    averageHtml = `<div id="average" class="font-bold text-right">Ao5:</div><div class="font-bold text-left">${avgMinutesPart}${avg.seconds.toString(10).padStart(2, '0')}.${avg.milliseconds.toString(10).padStart(3, '0')}</div>`;
  } else {
    averageHtml = `<div id="average" class="font-bold text-right">Ao5:</div><div class="font-bold text-left">-</div>`;
  }

  let bestTimeHtml = '';
  if (bestTime) {
    const best = makeTimeFromTimestamp(bestTime);
    const bestMinutesPart = best.minutes > 0 ? `${best.minutes}:` : '';
    bestTimeHtml = `<div id="best" class="text-right">Best:</div><div class="text-left">${bestMinutesPart}${best.seconds.toString(10).padStart(2, '0')}.${best.milliseconds.toString(10).padStart(3, '0')}</div>`;
  }

  const displayHtml = `<div class="grid grid-cols-2 items-center gap-1 pt-2">${timesHtml}${averageHtml}${bestTimeHtml}</div>`;
  timesDisplay.html(displayHtml);
}
