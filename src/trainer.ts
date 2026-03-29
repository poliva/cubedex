import $ from 'jquery';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { S, _visualMoveLog } from './state';
import {
  fixOrientation, getInverseMove, getOppositeMove,
  isCaseSymmetric, isCaseSemiSymmetric, algToId, countMovesETM, getLastTimes,
  bestTimeNumber, averageOf12TimeNumber, learnedStatus,
  getOrientationCompensation,
  buildAlgFaceMap, transformMoveByFaceMap, invertFaceMap, composeFaceMaps,
  SLICE_ROTATION,
  getFailedCount, getPracticeCount, getFailRateAo12,
} from './functions';
import { expandSliceDoubles } from './algUtils';
import { applyStickeringMask, syncMirrorAlg, updateOrientationHint, showFlashingIndicator, resetVirtualOrientation } from './visualization';

/** Cancels the stare-delay timer so the next case can begin immediately. */
export function cancelStareDelay() {
  if (S.stareDelayTimer) { clearTimeout(S.stareDelayTimer); S.stareDelayTimer = null; }
  S.stareDelayActive = false;
}

/** Resets move tracking to the beginning and hides mistake/hint overlays. */
export function resetAlg() {
  S.currentMoveIndex = -1;
  S.badAlg = [];
  S.userActualMoves = [];
  S.reverseSliceBuffer = null;
  Object.assign(S.sliceOrientation, { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" });
  $('#alg-override-container').hide();
  $('#orientation-hint').hide();
  $('#orientation-reset-btn').addClass('hidden');
  hideMistakes();
  if (!S.hasGyroData) {
    resetVirtualOrientation();
  }
}

/** Hides the bad-move correction display and clears the flashing-indicator flag. */
export function hideMistakes() {
  clearTimeout(S.showMistakesTimeout);
  $('#alg-help-info').hide();
  $('#alg-fix').hide();
  $('#alg-fix').html("");
  $('#reset-practice-container').hide();
  S.hasShownFlashingIndicator = false;
}

/** Shows bad-move correction hints after a short delay; marks case as failed if applicable. */
export function showMistakesWithDelay(fixHtml: string) {
  if (fixHtml.length > 0) {
    $('#alg-fix').html(fixHtml);
    clearTimeout(S.showMistakesTimeout);
    S.showMistakesTimeout = setTimeout(function () {
      $('#alg-fix').show();
      if (S.resetPracticeEnabled) $('#reset-practice-container').show();
      let fixHtmlLength = countMovesETM(fixHtml);
      if (fixHtmlLength > S.previousFixHtmlLength && fixHtmlLength > 1) {
        $('#alg-help-info').removeClass('text-green-400 dark:text-green-500').addClass('text-red-400 dark:text-red-500').show();
      } else {
        $('#alg-help-info').hide();
      }
      S.previousFixHtmlLength = fixHtmlLength;
      if (!S.hasShownFlashingIndicator) {
        // console.log('[flash] RED: wrong move visible for 300ms -> red flash');
        showFlashingIndicator('red', 600);
        S.hasShownFlashingIndicator = true;
      }
      S.hadBadMoveDuringExec = true;
      if (S.checkedAlgorithms.length > 0 && S.badAlg.length > 0) {
        if (S.prioritizeFailedAlgs && !S.checkedAlgorithmsCopy.includes(S.checkedAlgorithms[0])) {
          // console.log(`[fail] prioritizeFailedAlgs: unshifting "${S.checkedAlgorithms[0].name}" to front of copy for early retry`);
          S.checkedAlgorithmsCopy.unshift(S.checkedAlgorithms[0]);
        }
        if (S.checkedAlgorithms[0].algorithm) {
          let algId = algToId(S.checkedAlgorithms[0].algorithm);
          if (algId && !S.hasFailedAlg) {
            $('#' + algId).removeClass('bg-gray-50 bg-gray-200 dark:bg-gray-700 dark:bg-gray-800');
            $('#' + algId).addClass('bg-red-400 dark:bg-red-400');
            // console.log(`[fail] hasFailedAlg=true for "${S.checkedAlgorithms[0].name}" (badAlg still present after 300ms)`);
            S.hasFailedAlg = true;
          }
        }
      }
    }, 300);
  } else {
    hideMistakes();
  }
}

/** Renders the color-coded algorithm HTML (green=done, white=next, red=bad, blue=partial). */
export function updateAlgDisplay() {
  let displayHtml = '';
  let color = '';
  let previousColor = '';
  let simplifiedBadAlg: string[] = [];
  let fixHtml = '';

  if (S.badAlg.length > 0) {
    const faceMap = buildAlgFaceMap(S.userAlg, S.currentMoveIndex);
    for (let i = 0; i < S.badAlg.length; i++) {
      const inverseMove = getInverseMove(S.badAlg[S.badAlg.length - 1 - i]);
      fixHtml += transformMoveByFaceMap(inverseMove, faceMap) + " ";
    }
    simplifiedBadAlg = Alg.fromString(fixHtml).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().split(/\s+/);
    fixHtml = simplifiedBadAlg.join(' ').trim();
    if (fixHtml.length === 0) {
      S.badAlg = [];
    }
  }

  const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;
  let parenthesisColor = darkModeToggle.checked ? 'white' : 'black';
  var isDoubleTurn = false;
  var isOppositeMove = false;
  var isAUF = false;
  let skipNext = false;
  S.userAlg.forEach((move, index) => {
    if (skipNext) { skipNext = false; return; }

    // Detect expanded slice/rotation double: two consecutive identical slice/rotation moves
    const bare = move.replace(/[()]/g, '');
    const base = bare.replace(/[2']/g, '');
    const isSliceOrRot = /^[MESxyz]$/.test(base);
    const nextBare = S.userAlg[index + 1]?.replace(/[()]/g, '');
    const isExpandedPair = isSliceOrRot && bare === nextBare;
    const displayMove = isExpandedPair ? (bare.includes("'") ? base + "2'" : base + "2") : move;
    const effLast = isExpandedPair ? index + 1 : index;
    if (isExpandedPair) skipNext = true;

    color = darkModeToggle.checked ? 'white' : 'black';
    if (effLast <= S.currentMoveIndex) {
      color = 'green';
    } else if (index <= S.currentMoveIndex) {
      color = 'blue';
    } else if (index < 1 + S.currentMoveIndex + simplifiedBadAlg.length) {
      color = 'red';
    }
    if (index === S.currentMoveIndex + 1 && color !== 'red') {
      color = 'white';
    }
    let cleanMove = displayMove.replace(/[()']/g, "").trim();
    if (index === 0 && S.currentMoveIndex === -1 && S.randomizeAUF) {
      if (simplifiedBadAlg.length === 1 && simplifiedBadAlg[0][0] === "U" && cleanMove.length > 0 && cleanMove[0].charAt(0) === "U") {
        color = 'blue';
        isAUF = true;
      }
    }
    if (index === S.currentMoveIndex + 1 && cleanMove.length > 1) {
      const isSingleBadAlg = simplifiedBadAlg.length === 1;
      const isDoubleBadAlg = simplifiedBadAlg.length === 2;
      const isTripleBadAlg = simplifiedBadAlg.length === 3;
      const rawExpected = cleanMove[0];
      const expectedFace = rawExpected.toUpperCase();
      const isWideMove = rawExpected >= 'a' && rawExpected <= 'z';
      const OPPOSITE_FACE: Record<string, string> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };
      let localOrientation: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
      for (let i = 0; i <= S.currentMoveIndex; i++) {
        const m = S.userAlg[i].replace(/[()]/g, '').trim();
        const rot = SLICE_ROTATION[m];
        if (rot) localOrientation = composeFaceMaps(localOrientation, rot);
      }
      const inv = invertFaceMap(localOrientation);
      const badFace = simplifiedBadAlg[0]?.[0];
      const remappedBadFace = badFace && 'UDFRBL'.includes(badFace) ? inv[badFace] : badFace;
      const faceMatch = badFace === expectedFace || remappedBadFace === expectedFace
        || (isWideMove && (badFace === OPPOSITE_FACE[expectedFace] || remappedBadFace === OPPOSITE_FACE[expectedFace]));
      if ((isSingleBadAlg && faceMatch) ||
        (isDoubleBadAlg && 'MES'.includes(cleanMove[0])) ||
        (isTripleBadAlg && 'MES'.includes(cleanMove[0]))) {
        color = 'blue';
        isDoubleTurn = true;
      }
    }
    let inverseMove = getInverseMove(simplifiedBadAlg[0]);
    let currentMove = S.userAlg[index]?.replace(/[()']/g, "");
    if (index === S.currentMoveIndex + 1 && simplifiedBadAlg.length === 1) {
      let oppositeMove = getOppositeMove(inverseMove?.replace(/[()'2]/g, ""));
      let nextMove = S.userAlg[isExpandedPair ? index + 2 : index + 1]?.replace(/[()]/g, "");
      if ((inverseMove === nextMove || (inverseMove?.charAt(0) === nextMove?.charAt(0) && nextMove?.charAt(1) == '2')) &&
        (oppositeMove === currentMove || (oppositeMove === currentMove?.charAt(0) && currentMove?.charAt(1) == '2'))) {
        color = 'white';
        isOppositeMove = true;
      }
    }
    if (index === S.currentMoveIndex + 2 && isOppositeMove) color = displayMove.endsWith('2') && inverseMove != currentMove ? 'blue' : 'green';
    if (previousColor === 'blue' || (previousColor !== 'blue' && color !== 'blue' && isDoubleTurn)) color = darkModeToggle.checked ? 'white' : 'black';

    let circleHtml = '';
    let preCircleHtml = '';
    let postCircleHtml = '';
    for (let char of displayMove) {
      if (char === '(') {
        preCircleHtml += `<span style="color: ${parenthesisColor};">${char}</span>`;
      } else if (char === ')') {
        postCircleHtml += `<span style="color: ${parenthesisColor};">${char}</span>`;
      } else {
        circleHtml += `<span class="move" style="color: ${color}; -webkit-text-security: ${S.isMoveMasked ? 'disc' : 'none'};">${char}</span>`;
      }
    }
    if (index === S.currentMoveIndex + 1) {
      displayHtml += `${preCircleHtml}<span class="circle">${circleHtml}</span>${postCircleHtml} `;
    } else {
      displayHtml += `${preCircleHtml}${circleHtml}${postCircleHtml} `;
    }
    previousColor = color;
  });

  if (!S.countdownTimer) {
    $('#alg-display').html(displayHtml);
  }

  if (isDoubleTurn || isAUF || isOppositeMove) fixHtml = '';
  if (fixHtml.length > 0) {
    showMistakesWithDelay(fixHtml);
  } else {
    hideMistakes();
  }

  if (S.currentMoveIndex === S.userAlg.length - 1) S.currentMoveIndex = 0;
}

/** Sets up the 3D cube with the inverse algorithm, applying random AUF and color rotation. */
export function drawAlgInCube() {
  S.originalUserAlg = [...S.userAlg];
  if (S.randomizeAUF && S.scrambleToAlg.length === 0) {
    const category = $('#category-select').val()?.toString() || '';
    const effectiveCategory = S.checkedAlgorithms[0]?.masking || category;
    const ignore = S.checkedAlgorithms[0]?.ignore || '';
    const algStr = S.userAlg.join(' ');

    // Add post-AUF for PLL/ZBLL (user must also solve U-layer permutation after)
    if (effectiveCategory.toLowerCase().includes("pll") || effectiveCategory.toLowerCase().includes("zbll")) {
      const postAUF = ["U", "U'", "U2", ""];
      const randomPostAUF = postAUF[Math.floor(Math.random() * postAUF.length)];
      if (randomPostAUF.length > 0) {
        S.userAlg.push(randomPostAUF);
      }
    }

    // Determine pre-AUF based on case symmetry
    const fullSym = isCaseSymmetric(algStr, effectiveCategory, ignore);
    if (!fullSym) {
      const semiSym = isCaseSemiSymmetric(algStr, effectiveCategory, ignore);
      // Semi-symmetric: only "" or "U" matter (U2 = "", U' = U)
      // Full asymmetric: all 4 AUFs are distinct
      const aufOptions = semiSym ? ["U", ""] : ["U", "U'", "U2", ""];
      const randomAUF = aufOptions[Math.floor(Math.random() * aufOptions.length)];
      if (randomAUF.length > 0) {
        S.userAlg.unshift(randomAUF);
        const simplified = Alg.fromString(S.userAlg.join(' ')).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().split(/\s+/);
        S.displayAlg = [...simplified];
        S.userAlg = expandSliceDoubles(simplified);
        $('#alg-display').text(S.displayAlg.join(' '));
      }
    }
  }
  if (S.randomizeAUF && S.scrambleToAlg.length > 0) {
    S.userAlg = [...S.scrambleToAlg];
    S.displayAlg = [...S.userAlg];
    $('#alg-display').text(S.displayAlg.join(' '));
    S.scrambleToAlg = [];
  }
  const invertedAlg = Alg.fromString(S.userAlg.join(' ')).invert().toString();
  const currentYRotation = S.rotateColorsEnabled ? S.currentColorRotation : "";
  const compensation = getOrientationCompensation(invertedAlg);
  const compensatedAlg = compensation ? `${compensation} ${invertedAlg}` : invertedAlg;
  const displayAlg = currentYRotation ? `${currentYRotation} ${compensatedAlg}` : compensatedAlg;
  S.currentDisplayAlg = displayAlg;
  S.twistyPlayer.alg = displayAlg;
  syncMirrorAlg(displayAlg);
  // Store the color rotation face map for transforming visual moves.
  S.colorRotationFaceMap = currentYRotation
    ? buildAlgFaceMap([currentYRotation], 0)
    : null;
  const rawIgnore = S.checkedAlgorithms[0]?.ignore;
  S.currentRotatedIgnore = rawIgnore;
  S.currentMasking = S.checkedAlgorithms[0]?.masking;
  applyStickeringMask(rawIgnore);
}

/** Pre-computes target KPattern states for each move of the current algorithm. */
export function fetchNextPatterns() {
  drawAlgInCube();
  if (S.keepInitialState) {
    S.keepInitialState = false;
  } else {
    S.initialstate = S.patternStates.length === 0 ? S.myKpattern : S.patternStates[S.patternStates.length - 1];
  }
  S.initialPatternState = fixOrientation(S.initialstate);
  S.userAlg.forEach((move, index) => {
    move = move.replace(/[()]/g, "");
    if (index === 0) S.patternStates[index] = S.initialstate.applyMove(move);
    else S.patternStates[index] = S.algPatternStates[index - 1].applyMove(move);
    S.algPatternStates[index] = S.patternStates[index];
    S.patternStates[index] = fixOrientation(S.patternStates[index]);
  });
  if (S.patternStates.length > 0) {
    S.desiredEndState = S.patternStates[S.patternStates.length - 1];
  }
  // Always reset myKpattern to initialstate for the new algorithm.
  // M/E sync can leave non-identity centers in myKpattern from a previous
  // algorithm; fixOrientation would mask this, letting the stale centers
  // corrupt the ME-COMP transform for the next algorithm.
  S.myKpattern = S.initialstate;
  S.userActualMoves = [];
}

/** Returns the set of color rotations to pick from based on the current mode. */
function getColorRotationOptions(): string[] {
  switch (S.colorRotationMode) {
    case 'vertical': return ["", "y", "y2", "y'"];
    case 'upside':   return ["", "z2"];
    case 'vertical+upside': return ["", "y", "y2", "y'", "z2", "z2 y", "z2 y2", "z2 y'"];
    case 'any':      return [
      "", "y", "y2", "y'",
      "x", "x y", "x y2", "x y'",
      "x2", "x2 y", "x2 y2", "x2 y'",
      "x'", "x' y", "x' y2", "x' y'",
      "z", "z y", "z y2", "z y'",
      "z'", "z' y", "z' y2", "z' y'",
    ];
    default: return [""];  // 'none'
  }
}

/** Rebuilds the practice queue from currently checked case checkboxes.
 *  Picks a new color rotation, applies priority sorting, and logs the queue. */
export function rebuildCheckedAlgorithms() {
  S.checkedAlgorithms = [];
  S.checkedAlgorithmsCopy = [];

  // Pick a new random color rotation for this queue iteration
  const rotOpts = getColorRotationOptions();
  S.currentColorRotation = rotOpts[Math.floor(Math.random() * rotOpts.length)];

  const ignoreSelection = ($('#select-all-toggle') as JQuery<HTMLInputElement>).prop('checked');
  $('#alg-cases input[type="checkbox"].case-toggle').each(function () {
    const el = this as HTMLInputElement;
    // Skip cases hidden by search filter
    if (!$(el).closest('.case-wrapper').is(':visible')) return;
    const algorithm = $(el).data('algorithm');
    const name = $(el).data('name');
    const cdPrefix = S.countdownModeEnabled ? 'CD-' : '';
    const bestTime = bestTimeNumber(algToId(algorithm), cdPrefix) ?? $(el).data('best');
    const ignore = $(el).data('ignore') || undefined;
    const masking = $(el).data('masking') || undefined;
    const isSelected = ignoreSelection || el.checked;
    if (!isSelected) return;
    S.checkedAlgorithms.push({ algorithm, name, bestTime, ignore, masking });
  });
  sortAndShuffleQueue();
  skipToNextPresentableCase();
  if (S.checkedAlgorithms.length > 0) {
    $('#alg-input').val(S.checkedAlgorithms[0].algorithm);
  }
}

/** Calculates average turns-per-second over the last 12 solves for an algorithm. 
 * Falls back to average of all times if AO12 is not available, to allow prioritization even for less practiced cases.
*/
export function getAverageTPSo12WithFallback(algorithm: string, cdPrefix: string): number {
  const algId = algToId(algorithm);
  const moveCount = countMovesETM(algorithm);
  const ao12 = averageOf12TimeNumber(algId, cdPrefix);
  if (ao12 && ao12 > 0) {
    return moveCount / (ao12 / 1000);
  }
  // Fallback to average of all times if AO12 is not available, to allow prioritization even for less practiced cases.
  const times = getLastTimes(algId, cdPrefix);
  if (times.length === 0) return 0.1;
  const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
  if (avgTimeMs <= 0) return 0.1;
  return moveCount / (avgTimeMs / 1000);
}

/** Returns the overall fail rate for a case: fail/(fail+success), or 0 if never practiced. */
export function getFailRate(algorithm: string): number {
  const algId = algToId(algorithm);
  const practiceCount = getPracticeCount(algId);
  if (practiceCount === 0) return 0;
  return getFailedCount(algId) / practiceCount;
}

/** Checks whether a case should be skipped based on learning filters and limits. */
export function shouldSkipCase(alg: { algorithm: string }): boolean {
  const algId = algToId(alg.algorithm);
  const status = learnedStatus(algId);
  const selectLearningEnabled = $('#select-learning-toggle').is(':checked');
  const selectLearnedEnabled = $('#select-learned-toggle').is(':checked');
  if (selectLearningEnabled && status !== 1) return true;
  if (selectLearnedEnabled && status !== 2) return true;
  if (status === 0 && S.autoPromoteLearning && S.limitLearningEnabled) {
    const learningCount = countLearningCases();
    if (learningCount >= S.maxConcurrentLearning) return true;
  }
  return false;
}

/** Advances the practice queue past any cases that should be skipped. */
export function skipToNextPresentableCase() {
  const totalCases = S.checkedAlgorithms.length + S.checkedAlgorithmsCopy.length;
  let skipped = 0;
  while (S.checkedAlgorithms.length > 0 && skipped < totalCases && shouldSkipCase(S.checkedAlgorithms[0])) {
    const skippedAlg = S.checkedAlgorithms.shift()!;
    S.checkedAlgorithmsCopy.push(skippedAlg);
    if (S.checkedAlgorithms.length === 0) {
      S.checkedAlgorithms = [...S.checkedAlgorithmsCopy];
      S.checkedAlgorithmsCopy = [];
    }
    skipped++;
  }
}

/** Counts how many selected cases are currently in "Learning" state. */
export function countLearningCases(): number {
  let count = 0;
  const ignoreSelection = ($('#select-all-toggle') as JQuery<HTMLInputElement>).prop('checked');
  $('#alg-cases input[type="checkbox"].case-toggle').each(function () {
    const el = this as HTMLInputElement;
    const isSelected = ignoreSelection || el.checked;
    if (!isSelected) return;
    const algId = algToId($(el).data('algorithm'));
    if (learnedStatus(algId) === 1) count++;
  });
  return count;
}

/** Applies the active sorting/priority mode, shuffles if random, caps queue size, and logs. */
function sortAndShuffleQueue() {
  if (S.prioritizeSlowAlgs) {
    // -- Prioritize slow-first --
    // Cases with lower TPS are prioritized, as they may require more focus. 
    // This is a simple way to surface cases that might need more attention without relying on fail rate, which can be noisy for less practiced cases.
    const cdPrefix = S.countdownModeEnabled ? 'CD-' : '';
    S.checkedAlgorithms.sort((a, b) => {
      const aTPS = getAverageTPSo12WithFallback(a.algorithm, cdPrefix);
      const bTPS = getAverageTPSo12WithFallback(b.algorithm, cdPrefix);
      return aTPS - bTPS;
    });
    const maxSlowCases = S.queueSize > 0 ? S.queueSize : Math.min(10, Math.ceil(S.checkedAlgorithms.length / 2));
    if (S.checkedAlgorithms.length > maxSlowCases) {
      const overflow = S.checkedAlgorithms.splice(maxSlowCases);
      S.checkedAlgorithmsCopy.push(...overflow);
    }
    // console.log(`[Selection] slow-first | total=${S.checkedAlgorithms.length + S.checkedAlgorithmsCopy.length} queued=${S.checkedAlgorithms.length} max=${maxSlowCases}`);
    // S.checkedAlgorithms.forEach((a, i) => {
    //   const tps = getAverageTPSo12WithFallback(a.algorithm, cdPrefix);
    //   const fr = getFailRateAo12(algToId(a.algorithm));
    //   console.log(`  ${i + 1}. ${a.name} | TPS=${tps.toFixed(2)} failRateAo12=${(fr * 100).toFixed(0)}%`);
    // });
  } else if (S.prioritizeDifficultAlgs) {
    // -- Prioritize difficult-first --
    // Cases with higher fail rates (ao12) are prioritized, as they may indicate cases that need more practice.
    S.checkedAlgorithms.sort((a, b) => {
      return getFailRateAo12(algToId(b.algorithm)) - getFailRateAo12(algToId(a.algorithm));
    });
    const total = S.checkedAlgorithms.length;
    const maxDifficultCases = S.queueSize > 0 ? S.queueSize : Math.max(5, Math.min(12, Math.ceil(total / 2)));
    if (total > maxDifficultCases) {
      const overflow = S.checkedAlgorithms.splice(maxDifficultCases);
      S.checkedAlgorithmsCopy.push(...overflow);
    }
    // console.log(`[Selection] difficult-first | total=${S.checkedAlgorithms.length + S.checkedAlgorithmsCopy.length} queued=${S.checkedAlgorithms.length} max=${maxDifficultCases}`);
    // S.checkedAlgorithms.forEach((a, i) => {
    //   const fr = getFailRateAo12(algToId(a.algorithm));
    //   console.log(`  ${i + 1}. ${a.name} | failRateAo12=${(fr * 100).toFixed(0)}%`);
    // });
  } else if (S.smartCaseSelection) {
    // -- Smart selection --
    // Score = (failRate / avgFailRate) - (TPS / avgTPS), so cases above average fail rate and below average TPS are prioritized.
    const cdPrefix = S.countdownModeEnabled ? 'CD-' : '';
    const failRates = S.checkedAlgorithms.map(a => getFailRateAo12(algToId(a.algorithm)));
    const tpsValues = S.checkedAlgorithms.map(a => getAverageTPSo12WithFallback(a.algorithm, cdPrefix));
    // compute avg fail rate from non-zero fail rates 
    const nonZeroFailRates = failRates.filter(r => r > 0);
    const avgFailRate = nonZeroFailRates.length > 0
      ? nonZeroFailRates.reduce((a, b) => a + b, 0) / nonZeroFailRates.length : 1;
    // compute avg TPS from non-zero TPS
    const nonZeroTPS = tpsValues.filter(t => t > 0);
    const avgTPS = nonZeroTPS.length > 0
      ? nonZeroTPS.reduce((a, b) => a + b, 0) / nonZeroTPS.length : 1;
    // compute scores
    const scored = S.checkedAlgorithms.map((alg, i) => {
      const fr = failRates[i];
      const tps = tpsValues[i] || 0.1;
      const score = (avgFailRate > 0 ? fr / avgFailRate : 0) - (avgTPS > 0 ? tps / avgTPS : 0);
      return { alg, score, fr, tps };
    });
    scored.sort((a, b) => b.score - a.score);
    S.checkedAlgorithms = scored.map(s => s.alg);
    const total = S.checkedAlgorithms.length;
    const maxSmartCases = S.queueSize > 0 ? S.queueSize : Math.max(5, Math.min(15, Math.ceil(total / 2)));
    
    // Cap the number of smart-selected cases to avoid overwhelming the user. 
    if (total > maxSmartCases) {
      // move to checkedAlgorithmsCopy
      const overflow = S.checkedAlgorithms.splice(maxSmartCases);
      S.checkedAlgorithmsCopy.push(...overflow);
    }
    // console.log(`[Selection] smart | total=${S.checkedAlgorithms.length + S.checkedAlgorithmsCopy.length} queued=${S.checkedAlgorithms.length} max=${maxSmartCases} avgFailRate=${(avgFailRate * 100).toFixed(0)}% avgTPS=${avgTPS.toFixed(2)}`);
    // scored.slice(0, S.checkedAlgorithms.length).forEach((s, i) => {
    //   console.log(`  ${i + 1}. ${s.alg.name} | TPS=${s.tps.toFixed(2)} failRate=${(s.fr * 100).toFixed(0)}% score=${s.score.toFixed(3)}`);
    // });

    // console.log(`[Selection] smart | remaining cases stats:`);
    // scored.slice(S.checkedAlgorithms.length).forEach((s, i) => {
    //   // print the non selected algs stats, if they are not status>0
    //   if (s.fr > 0 || s.tps > 1.0) {
    //     console.log(`  ${i + 1 + S.checkedAlgorithms.length}. ${s.alg.name} | TPS=${s.tps.toFixed(2)} failRate=${(s.fr * 100).toFixed(0)}% score=${s.score.toFixed(3)}`);
    //   }
    // });

  }
  if (S.randomAlgorithms) {
    // console.log(`[Selection] shuffling queue of ${S.checkedAlgorithms.length} cases`);
    S.checkedAlgorithms.sort(() => Math.random() - 0.5);
  //   if (!S.prioritizeSlowAlgs && !S.prioritizeDifficultAlgs && !S.smartCaseSelection) {
  //     console.log(`[Selection] random | queued=${S.checkedAlgorithms.length}`);
  //     S.checkedAlgorithms.forEach((a, i) => {
  //       console.log(`  ${i + 1}. ${a.name}`);
  //     });
  //   } else {
  //     console.log(`[Selection] (shuffled after priority sort)`);
  //     S.checkedAlgorithms.forEach((a, i) => {
  //       console.log(`  ${i + 1}. ${a.name}`);
  //     });
  //   }
  // } else if (!S.prioritizeSlowAlgs && !S.prioritizeDifficultAlgs && !S.smartCaseSelection) {
  //   console.log(`[Selection] sequential | queued=${S.checkedAlgorithms.length}`);
  //   S.checkedAlgorithms.forEach((a, i) => {
  //     console.log(`  ${i + 1}. ${a.name}`);
  //   });
  }
}

/** Rotates to the next algorithm in the practice queue, applying priority/random sorting.
 *  @param skipFlashing If true, does not show flashing indicator (used for skip-case). */
export function switchToNextAlgorithm(skipFlashing = false) {
  // Save previous case info for "show stats of previous case" feature
  S.previousAlgId = algToId(S.originalUserAlg.join(' '));
  S.previousAlgName = S.currentAlgName;
  S.previousAlgMoves = S.userAlg.join(' ');

  if (!skipFlashing) {
    const flashColor = S.hasTPSFail ? 'yellow'
      : (S.hasFailedAlg || S.hadBadMoveDuringExec) ? 'orange'
      : 'green';
    // console.log(`[flash] switchToNextAlgorithm: color=${flashColor} | hasTPSFail=${S.hasTPSFail} hasFailedAlg=${S.hasFailedAlg} hadBadMoveDuringExec=${S.hadBadMoveDuringExec}`);
    showFlashingIndicator(flashColor, flashColor === 'green' ? 400 : 600);
  }
  if (S.checkedAlgorithms.length > 0) {
    S.lastCompletedCase = S.checkedAlgorithms[0];
  }
  if (S.checkedAlgorithms.length + S.checkedAlgorithmsCopy.length > 1) {
    const currentAlg = S.checkedAlgorithms.shift();
    // Always push to copy (end of queue for next cycle).
    // When prioritizeFailedAlgs is active, showMistakesWithDelay also unshift-ed the case
    // to the front of copy, so it appears twice -- once at the front (retry priority)
    // and once at the back (normal position). This intentional duplication ensures the
    // failed case is seen again soon AND still cycles through the full set.
    if (currentAlg) {
      S.checkedAlgorithmsCopy.push(currentAlg);
    }
    if (S.checkedAlgorithms.length === 0) {
      S.checkedAlgorithms = [...S.checkedAlgorithmsCopy];
      S.checkedAlgorithmsCopy = [];
      // New iteration: pick new color rotation (if on-queue-rotation mode) and re-sort
      if (S.colorRotationFrequency === 0) {
        const rotOpts = getColorRotationOptions();
        S.currentColorRotation = rotOpts[Math.floor(Math.random() * rotOpts.length)];
      }
      sortAndShuffleQueue();
    }
    // Frequency-based color rotation: pick new rotation every N cases
    if (S.colorRotationFrequency > 0) {
      S.colorRotationCounter++;
      if (S.colorRotationCounter >= S.colorRotationFrequency) {
        S.colorRotationCounter = 0;
        const rotOpts = getColorRotationOptions();
        S.currentColorRotation = rotOpts[Math.floor(Math.random() * rotOpts.length)];
      }
    }
  }
  skipToNextPresentableCase();
}

/** Triggers the next case after a solve, respecting stare delay if enabled. */
export function transitionToNextCase() {
  if (S.stareDelayTimer) { clearTimeout(S.stareDelayTimer); S.stareDelayTimer = null; }
  if (S.stareDelayEnabled && S.stareDelaySeconds > 0) {
    S.stareDelayActive = true;
    updateOrientationHint();
    S.stareDelayTimer = setTimeout(() => {
      S.stareDelayTimer = null;
      S.stareDelayActive = false;
      $('#train-alg').trigger('click');
    }, S.stareDelaySeconds * 1000);
  } else {
    $('#train-alg').trigger('click');
  }
}
