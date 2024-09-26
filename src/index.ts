import './style.css'

import $ from 'jquery';
import { Subscription, interval } from 'rxjs';
import { TwistyPlayer } from 'cubing/twisty';
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { KPattern } from 'cubing/kpuzzle';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import * as THREE from 'three';

import {
  now,
  connectGanCube,
  GanCubeConnection,
  GanCubeEvent,
  GanCubeMove,
  MacAddressProvider,
  makeTimeFromTimestamp,
  cubeTimestampCalcSkew,
  cubeTimestampLinearFit
} from 'gan-web-bluetooth';

//import { faceletsToPattern, patternToFacelets } from './utils';
import { faceletsToPattern } from './utils';
import { expandNotation, fixOrientation, getInverseMove, getOppositeMove, requestWakeLock, releaseWakeLock, initializeDefaultAlgorithms, saveAlgorithm, deleteAlgorithm, exportAlgorithms, importAlgorithms, loadAlgorithms, loadCategories, isSymmetricOLL, algToId, setStickering, loadSubsets } from './functions';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

var twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  viewerLink: 'none',
  hintFacelets: 'floating',
  experimentalDragInput: 'auto',
  cameraLatitude: 0,
  cameraLongitude: 0,
  tempoScale: 5,
  experimentalStickering: 'full'
});

var twistyTracker = new TwistyPlayer({
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

$('#cube').append(twistyPlayer);

var conn: GanCubeConnection | null;
var lastMoves: GanCubeMove[] = [];
var solutionMoves: GanCubeMove[] = [];

var twistyScene: THREE.Scene;
var twistyVantage: any;

const HOME_ORIENTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0));
var cubeQuaternion: THREE.Quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0));

async function amimateCubeOrientation() {
  if (!gyroscopeEnabled) {
    return;
  }
  if (!twistyScene || !twistyVantage || forceFix) {
    var vantageList = await twistyPlayer.experimentalCurrentVantages();
    twistyVantage = [...vantageList][0];
    twistyScene = await twistyVantage.scene.scene();
    if (forceFix) forceFix = false;
  }
  twistyScene.quaternion.slerp(cubeQuaternion, 0.25);
  twistyVantage.render();
  requestAnimationFrame(amimateCubeOrientation);
}
requestAnimationFrame(amimateCubeOrientation);

var basis: THREE.Quaternion | null;

async function handleGyroEvent(event: GanCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
    if (!basis) {
      basis = quat.clone().conjugate();
    }
    cubeQuaternion.copy(quat.premultiply(basis).premultiply(HOME_ORIENTATION));
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

// Define the type of userAlg explicitly as an array of strings
var userAlg: string[] = [];
var OriginalUserAlg: string[] = [];
var badAlg: string[] = [];
var patternStates: KPattern[] = [];
var algPatternStates: KPattern[] = [];
var currentMoveIndex = 0;
var inputMode: boolean = true;

function resetAlg() {
  currentMoveIndex = -1; // Reset the move index
  badAlg = [];
  hideMistakes();
}

$('#alg-input').on('input', () => {
  const algInput = $('#alg-input').val()?.toString().trim();
  if (algInput && algInput.length > 0) {
    $('#save-alg').prop('disabled', false);
    if (conn) {
      $('#train-alg').prop('disabled', false);
    }
  } else {
    $('#save-alg').prop('disabled', true);
    $('#train-alg').prop('disabled', true);
  }
});

$('#input-alg').on('click', () => {
  twistyPlayer.experimentalStickering = 'full';
  twistyPlayer.alg = '';
  resetAlg();
  $('#alg-input').val('');
  if (conn) {
    inputMode = true;
    $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    $('#train-alg').prop('disabled', false);
    $('#save-alg').prop('disabled', false);
  } else {
    $('#alg-input').attr('placeholder', 'Please connect the smartcube first');
  }
  checkedAlgorithms = [];
  checkedAlgorithmsCopy = [];
  updateTimesDisplay();
  $('#alg-display-container').hide();
  $('#times-display').html('');
  $('#timer').hide();
  $('#alg-input').show();
  $('#alg-input').get(0)?.focus();
});

$('#train-alg').on('click', () => {
  const algInput = $('#alg-input').val()?.toString().trim();
  if (algInput) {
    inputMode = false;
    userAlg = expandNotation(algInput).split(/\s+/); // Split the input string into moves
    currentAlgName = checkedAlgorithms[0]?.name || '';
    $('#alg-display').text(userAlg.join(' ')); // Display the alg
    $('#alg-display-container').show();
    $('#timer').show();
    $('#alg-input').hide();
    hideMistakes();
    requestWakeLock();
    hasFailedAlg = false;
    patternStates = [];
    algPatternStates = [];
    fetchNextPatterns();
    setTimerState("READY");
    updateTimesDisplay();
  } else {
    $('#alg-input').show();
    if (conn) {
      $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    } else {
      $('#alg-input').attr('placeholder', "Please connect the smartcube first");
    }
    $('#alg-input').get(0)?.focus();
  }
  resetAlg();
  if ($('#alg-display').text() !== '') {
    updateAlgDisplay();
  }
});

function fetchNextPatterns() {
  drawAlgInCube();
  if (keepInitialState) {
    keepInitialState = false;
  } else {
    initialstate = patternStates.length === 0 ? myKpattern : patternStates[patternStates.length - 1];
  }
  userAlg.forEach((move, index) => {
    move = move.replace(/[()]/g, "");
    if (index === 0) patternStates[index] = initialstate.applyMove(move);
    else patternStates[index] = algPatternStates[index - 1].applyMove(move);
    algPatternStates[index]=patternStates[index];
    patternStates[index]=fixOrientation(patternStates[index]);
    //console.log("patternStates[" + index + "]=" + JSON.stringify(patternStates[index].patternData));
  });
}

function drawAlgInCube() {
  OriginalUserAlg = [...userAlg];
  if (randomizeAUF) {
    let AUF = ["U", "U'", "U2", ""];
    let randomAUF = AUF[Math.floor(Math.random() * AUF.length)];
    if (randomAUF.length > 0) {
      // check if we can add randomAUF to the beginning of the alg, as there are some tricky cases like Na, Nb, E, OLL-21, OLL-57, etc..
      // Eg: Na + U' == U + Na but Sune + U' != U + Sune
      let kpattern = faceletsToPattern(SOLVED_STATE);

      let algWithStartU = Alg.fromString("U " + userAlg.join(' '));
      let resultWithStartU = kpattern.applyAlg(algWithStartU);

      let algWithEndU = Alg.fromString(userAlg.join(' ') + " U'");
      let resultWithEndU = kpattern.applyAlg(algWithEndU);

      let algWithStartU2 = Alg.fromString("U2 " + userAlg.join(' '));
      let resultWithStartU2 = kpattern.applyAlg(algWithStartU2);

      let algWithEndU2 = Alg.fromString(userAlg.join(' ') + " U2'");
      let resultWithEndU2 = kpattern.applyAlg(algWithEndU2);

      let category = $('#category-select').val()?.toString().toLowerCase();
      let isOLL = category?.includes("oll");
      let areNotIdentical = !resultWithStartU.isIdentical(resultWithEndU) && !resultWithStartU2.isIdentical(resultWithEndU2);

      // post AUF for pll and zbll
      if (category?.includes("pll") || category?.includes("zbll")) {
        let randomPostAUF = AUF[Math.floor(Math.random() * AUF.length)];
        if (randomPostAUF.length > 0) {
          userAlg.push(randomPostAUF);
        }
      }

      if ((areNotIdentical && !isOLL) || isOLL && !isSymmetricOLL(userAlg.join(' '))) {
        userAlg.unshift(randomAUF); // add randomAUF to the beginning of the alg
        userAlg = Alg.fromString(userAlg.join(' ')).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().split(/\s+/); // simplify alg by cancelling possible U moves at the beginning
        $('#alg-display').text(userAlg.join(' '));
      }
    }
  }
  twistyPlayer.alg = Alg.fromString(userAlg.join(' ')).invert().toString();
}

var showMistakesTimeout: number;
let hasShownFlashingIndicator = false;
let hasFailedAlg = false;

function showMistakesWithDelay(fixHtml: string) {
  if (fixHtml.length > 0) {
    $('#alg-fix').html(fixHtml);
    clearTimeout(showMistakesTimeout);
    showMistakesTimeout = setTimeout(function() {
      $('#alg-fix').show();
      // Show the red flashing indicator if enabled and not already shown
      const flashingIndicator = document.getElementById('flashing-indicator');
      if (flashingIndicator && flashingIndicatorEnabled && !hasShownFlashingIndicator) {
        flashingIndicator.style.backgroundColor = 'red';
        flashingIndicator.classList.remove('hidden');
        setTimeout(() => {
          flashingIndicator.classList.add('hidden');
        }, 300); // Hide after 0.3 seconds
        hasShownFlashingIndicator = true; // Set the flag to true
      }
      // if the user fails the current alg, make the case appear more often
      if (checkedAlgorithms.length > 0) {
        if (prioritizeFailedAlgs && !checkedAlgorithmsCopy.includes(checkedAlgorithms[0])) {
          checkedAlgorithmsCopy.push(checkedAlgorithms[0]);
          //console.log("+++ Pushing failed alg " + checkedAlgorithms[0].name + " to checkedAlgorithmsCopy: " + JSON.stringify(checkedAlgorithmsCopy));
        }
        // mark the failed alg in red
        if (checkedAlgorithms[0].algorithm) {
          let algId = algToId(checkedAlgorithms[0].algorithm);
          if (algId && !hasFailedAlg) {
            // defined in loadAlgorithms()
            $('#' + algId).removeClass('bg-gray-50 bg-gray-400 dark:bg-gray-600 dark:bg-gray-800');
            $('#' + algId).addClass('bg-red-400 dark:bg-red-400');
            // Increase the data-failed count
            let failedCount = parseInt($('#' + algId).data('failed')) || 0;
            //console.log("+++ failedCount for " + algId + " is " + failedCount + " at currentMoveIndex: " + currentMoveIndex);
            $('#' + algId).data('failed', failedCount + 1);
            hasFailedAlg = true;
          }
        }
      }
    }, 300);  // 0.3 second
  } else {
    hideMistakes();
  }
}

function hideMistakes() {
  // Clear the timeout if hide is called before the div is shown
  clearTimeout(showMistakesTimeout);
  $('#alg-fix').hide();
  $('#alg-fix').html("");
  hasShownFlashingIndicator = false; // Reset the flag
}

function updateAlgDisplay() {
  let displayHtml = '';
  let color = '';
  let previousColor = '';
  let simplifiedBadAlg: string[] = [];
  let fixHtml  = '';

  if (badAlg.length > 0) {
    for (let i=0 ; i < badAlg.length; i++){
      fixHtml += getInverseMove(badAlg[badAlg.length - 1 - i])+" ";
    }

    // simplfy badAlg
    simplifiedBadAlg = Alg.fromString(fixHtml).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString().split(/\s+/);
    fixHtml = simplifiedBadAlg.join(' ').trim();
    if (fixHtml.length === 0) {
      badAlg = [];
    }
  }

  let parenthesisColor = darkModeToggle.checked ? 'white' : 'black';
  var isDoubleTurn = false;
  var isOppositeMove = false;
  var isAUF = false;
  userAlg.forEach((move, index) => {
    color = darkModeToggle.checked ? 'white' : 'black'; // Default color

    // Determine the color based on the move index
    if (index <= currentMoveIndex) {
      color = 'green'; // Correct moves
    } else if (index < 1 + currentMoveIndex + simplifiedBadAlg.length) {
      color = 'red'; // Incorrect moves
    }

    // Highlight the next move
    if (index === currentMoveIndex + 1 && color !== 'red') {
      color = 'white';
    }

    let cleanMove = move.replace(/[()']/g, "").trim();

    // don't mark initial AUF as incorrect when randomAUF is enabled
    if (index === 0 && currentMoveIndex === -1 && randomizeAUF){
      if (simplifiedBadAlg.length === 1 && simplifiedBadAlg[0][0] === 'U' && cleanMove.length > 0 && cleanMove[0].charAt(0) === 'U') {
        color = 'blue';
        isAUF = true;
      }
    }

    // Don't mark double turns and slices as errors when they are not yet completed
    if (index === currentMoveIndex + 1 && cleanMove.length > 1) {
        const isSingleBadAlg = simplifiedBadAlg.length === 1;
        const isDoubleBadAlg = simplifiedBadAlg.length === 2;
        const isTripleBadAlg = simplifiedBadAlg.length === 3;
        // when we have a U2 on an alg that contains slices or wide moves, the U turn is not really a U, but a different move depending on the orientation of the cube
        // TODO: this is could be done better by checking the center state, but it works for now
        const isSliceOrWideMove = /[MESudlrbfxyz]/.test(userAlg.slice(0, currentMoveIndex + 1).join(' '));

        if ((isSingleBadAlg && simplifiedBadAlg[0][0] === cleanMove[0]) ||
            (isSingleBadAlg && isSliceOrWideMove) ||
            (isDoubleBadAlg && 'MES'.includes(cleanMove[0])) ||
            (isTripleBadAlg && 'MES'.includes(cleanMove[0]))) {
            color = 'blue';
            isDoubleTurn = true;
        }
    }

    // don't mark a R as incorrect if it's followed by a L move, or a U as incorrect if it's followed by a D move
    if (index === currentMoveIndex + 1 && simplifiedBadAlg.length === 1) {
      const inverseMove = getInverseMove(simplifiedBadAlg[0]);
      if (inverseMove === userAlg[index + 1]?.replace(/[()]/g, "") &&
          getOppositeMove(inverseMove) === userAlg[index]?.replace(/[()]/g, "")) {
        color = 'white';
        isOppositeMove = true;
      }
    }
    if (index === currentMoveIndex + 2 && isOppositeMove) {
      color = 'green';
    }

    if (previousColor === 'blue') color = darkModeToggle.checked ? 'white' : 'black';
    if (previousColor !== 'blue' && color !== 'blue' && isDoubleTurn) color = darkModeToggle.checked ? 'white' : 'black';

    // Build moveHtml excluding parentheses
    let circleHtml = '';
    let preCircleHtml = '';
    let postCircleHtml = '';

    for (let char of move) {
      if (char === '(') {
        preCircleHtml += `<span style="color: ${parenthesisColor};">${char}</span>`;
      } else if (char === ')') {
        postCircleHtml += `<span style="color: ${parenthesisColor};">${char}</span>`;
      } else {
        circleHtml += `<span class="move" style="color: ${color}; -webkit-text-security: ${isMoveMasked ? 'disc' : 'none'};">${char}</span>`;
      }
    }

    // Wrap non-parenthesis characters in circle class if it's the current move
    if (index === currentMoveIndex + 1) {
      displayHtml += `${preCircleHtml}<span class="circle">${circleHtml}</span>${postCircleHtml} `;
    } else {
      displayHtml += `${preCircleHtml}${circleHtml}${postCircleHtml} `;
    }
    previousColor = color;
  });

  // Update the display with the constructed HTML
  $('#alg-display').html(displayHtml);

  if (isDoubleTurn || isAUF || isOppositeMove) fixHtml = '';
  if (fixHtml.length > 0) {
    showMistakesWithDelay(fixHtml);
  } else {
    hideMistakes();
  }

  // set the index to 0 when the alg is finished, displays the circle on the first move
  if (currentMoveIndex === userAlg.length - 1) currentMoveIndex = 0;
}

let keepInitialState: boolean = false;

async function handleMoveEvent(event: GanCubeEvent) {
  if (event.type === "MOVE") {
    if (timerState === "READY") {
      setTimerState("RUNNING");
    }
    if (timerState === "STOPPED") {
      setTimerState("RUNNING");
    }
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    twistyTracker.experimentalAddMove(event.move, { cancel: false });
    lastMoves.push(event);
    if (timerState === "RUNNING") {
      solutionMoves.push(event);
    }
    if (lastMoves.length > 256) {
      lastMoves = lastMoves.slice(-256);
    }
    if (lastMoves.length > 10) {
      var skew = cubeTimestampCalcSkew(lastMoves);
      $('#skew').val(skew + '%');
    }

    //console.log("MOVE: " + event.move + " Index: " + currentMoveIndex + " currentValue: " + userAlg[currentMoveIndex]);
    if (inputMode) {
      $('#alg-input').val(function(_, currentValue) {
        return Alg.fromString(currentValue + " " + lastMoves[lastMoves.length - 1].move).experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 }).toString();
      });
      $('#train-alg').prop('disabled', false);
      $('#save-alg').prop('disabled', false);
      return;
    };

    // Check if the current move matches the user's alg
    var found: boolean = false;
    patternStates.forEach((pattern, index) => {
      if ((myKpattern.applyMove(event.move).isIdentical(pattern)) || (myKpattern.applyMove(event.move).isIdentical(initialstate.applyAlg(Alg.fromString(userAlg.join(' ')))) && index === patternStates.length - 1)) {
        currentMoveIndex=index;
        found = true;
        badAlg = [];
        if (currentMoveIndex === userAlg.length - 1){
          setTimerState("STOPPED");
          resetAlg();
          fetchNextPatterns();
          currentMoveIndex = userAlg.length - 1;

          // Show the flashing indicator
          const flashingIndicator = document.getElementById('flashing-indicator');
          if (flashingIndicator && flashingIndicatorEnabled) {
            flashingIndicator.style.backgroundColor = 'green';
            flashingIndicator.classList.remove('hidden');
            setTimeout(() => {
              flashingIndicator.classList.add('hidden');
            }, 200); // Hide after 0.2 seconds
          }

          // Switch to next algorithm
          if (checkedAlgorithms.length + checkedAlgorithmsCopy.length > 1) {
            const currentAlg = checkedAlgorithms.shift(); // Remove the first algorithm
            if (checkedAlgorithms.length === 0) {
              checkedAlgorithms = [...checkedAlgorithmsCopy]; // Copy remaining algorithms
              checkedAlgorithmsCopy = [];
            }
            // Randomize checkedAlgorithms if random is enabled
            if (randomAlgorithms) {
              checkedAlgorithms.sort(() => Math.random() - 0.5);
            }
            if (currentAlg) {
              checkedAlgorithmsCopy.push(currentAlg); // Add current algorithm to the copy
            }

          }
          // this is the initial state for the new algorithm
          initialstate = pattern;
          keepInitialState = true;
          if (checkedAlgorithms.length > 0) {
            $('#alg-input').val(checkedAlgorithms[0].algorithm);
          }
          $('#train-alg').trigger('click');
          return;
        }
        return;
      }
    });
    if (!found) {
      badAlg.push(event.move);
      //console.log("Pushing 1 incorrect move. badAlg: " + badAlg)

      if (currentMoveIndex === 0 && badAlg.length === 1 && lastMoves[lastMoves.length - 1].move === getInverseMove(userAlg[currentMoveIndex].replace(/[()]/g, ""))) { 
        currentMoveIndex--;
        badAlg.pop();
        //console.log("Cancelling first correct move");
      }  else if (lastMoves[lastMoves.length - 1].move === getInverseMove(badAlg[badAlg.length -2])) { 
        badAlg.pop();
        badAlg.pop();
        //console.log("Popping last incorrect move. badAlg=" + badAlg);
      } else if (badAlg.length > 3 && lastMoves.length > 3 && lastMoves[lastMoves.length - 1].move === lastMoves[lastMoves.length - 2].move && lastMoves[lastMoves.length - 2].move === lastMoves[lastMoves.length - 3].move && lastMoves[lastMoves.length - 3].move === lastMoves[lastMoves.length - 4].move ) {
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        //console.log("Popping a turn (4 incorrect moves)");
      }
    }
    updateAlgDisplay();
  }
}

var cubeStateInitialized = false;

async function handleFaceletsEvent(event: GanCubeEvent) {
  if (event.type == "FACELETS" && !cubeStateInitialized) {
    if (event.facelets != SOLVED_STATE) {
      var kpattern = faceletsToPattern(event.facelets);
      var solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      var scramble = solution.invert();
      twistyTracker.alg = scramble;
      twistyPlayer.alg = scramble;
    } else {
      twistyTracker.alg = '';
      twistyPlayer.alg = '';
    }
    cubeStateInitialized = true;
    console.log("Initial cube state is applied successfully", event.facelets);
  }
}

function handleCubeEvent(event: GanCubeEvent) {
  //if (event.type != "GYRO") console.log("GanCubeEvent", event);
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
    $('#gyroSupported').val(event.gyroSupported ? "YES" : "NO");
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    twistyPlayer.alg = '';
    twistyTracker.alg = '';
    $('.info input').val('- n/a -');
    $('#connect').html('Connect');
  }
}

const customMacAddressProvider: MacAddressProvider = async (device, isFallbackCall): Promise<string | null> => {
  const lastConnectedMAC = localStorage.getItem('lastConnectedDeviceMAC') || '';
  if (isFallbackCall) {
    return prompt(`Unable to determine cube MAC address!\nPlease enter MAC address manually:`, lastConnectedMAC);
  } else {
    return typeof device.watchAdvertisements == 'function' ? null :
      prompt(`Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:`, lastConnectedMAC);
  }
};

$('#show-help').on('click', () => {
  const helpDiv = $('#help');
  helpDiv.toggle();
  if (helpDiv.css('display') === 'none') {
    $('#show-help').html('Show Help');
  } else {
    $('#show-help').html('Hide Help');
    $('#options-container').hide();
    $('#load-container').hide();
    $('#save-container').hide();
    $('#info').hide();
    $('#show-options').html('Show Options');
  }
});

$('#device-info').on('click', () => {
  const infoDiv = $('#info');
  if (infoDiv.css('display') === 'none') {
    infoDiv.css('display', 'grid');
    $('#options-container').hide();
    $('#load-container').hide();
    $('#save-container').hide();
    $('#help').hide();
    $('#show-options').html('Show Options');
    $('#show-help').html('Show Help');
  } else {
    infoDiv.css('display', 'none');
  }
});

$('#reset-state').on('click', async () => {
  await conn?.sendCubeCommand({ type: "REQUEST_RESET" });
  twistyPlayer.alg = '';
  drawAlgInCube();
});

$('#reset-gyro').on('click', async () => {
  basis = null;
});

$('#connect').on('click', async () => {
  if (conn) {
    conn.disconnect();
    conn = null;
    releaseWakeLock();
    $('#reset-gyro').prop('disabled', true);
    $('#reset-state').prop('disabled', true);
    $('#device-info').prop('disabled', true);
    $('#train-alg').prop('disabled', true);
  } else {
    conn = await connectGanCube(customMacAddressProvider);
    conn.events$.subscribe(handleCubeEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
    // save conn.deviceMAC in localStorage
    localStorage.setItem('lastConnectedDeviceMAC', conn.deviceMAC);
    $('#deviceName').val(conn.deviceName);
    $('#deviceMAC').val(conn.deviceMAC);
    $('#connect').html('Disconnect');
    $('#reset-gyro').prop('disabled', false);
    $('#reset-state').prop('disabled', false);
    $('#device-info').prop('disabled', false);
    if (($('#alg-input').val()?.toString().trim().length ?? 0) > 0) {
      $('#train-alg').prop('disabled', false);
    }
    $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    $('#alg-input').get(0)?.focus();
  }
});

var timerState: "IDLE" | "READY" | "RUNNING" | "STOPPED" = "IDLE";

function updateTimesDisplay() {
  const timesDisplay = $('#times-display');
  const algId = algToId(OriginalUserAlg.join(' '));

  const lastFiveTimes: number[] = $('#' + algId).data('lastFiveTimes') || [];
  if (lastFiveTimes.length === 0) {
    timesDisplay.html(showAlgNameEnabled ? `${currentAlgName}` : '');
    return;
  }

  const practiceCount: number = $('#' + algId).data('count') || 0;
  const timesHtml = lastFiveTimes.map((time: number, index: number) => {
    const t = makeTimeFromTimestamp(time);
    let number = practiceCount < 5 ? index + 1 : practiceCount - 5 + index + 1;
    return `<div>Time ${number}: ${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}</div>`;
  }).join('');

  const averageTime = lastFiveTimes.reduce((a: number, b: number) => a + b, 0) / lastFiveTimes.length;
  const avg = makeTimeFromTimestamp(averageTime);
  const averageHtml = `<div id="average" class="font-bold">Average: ${avg.minutes}:${avg.seconds.toString(10).padStart(2, '0')}.${avg.milliseconds.toString(10).padStart(3, '0')}</div>`;

  const displayHtml = showAlgNameEnabled ? `<p>${currentAlgName}</p>${timesHtml}${averageHtml}` : `${timesHtml}${averageHtml}`;
  timesDisplay.html(displayHtml);
}

function setTimerState(state: typeof timerState) {
  timerState = state;
  const algId = algToId(OriginalUserAlg.join(' '));
  // check if the algId exists in the DOM, create it if it doesn't
  if ($('#' + algId).length === 0) {
    $('#default-alg-id').append(`<div id="${algId}" class="hidden"></div>`);
  }
  let lastFiveTimes = $('#' + algId).data('lastFiveTimes') || [];
  let practiceCount = $('#' + algId).data('count') || 0;

  switch (state) {
    case "IDLE":
      stopLocalTimer();
      $('#timer').hide();
      break;
    case 'READY':
      stopLocalTimer();
      setTimerValue(0);
      $('#timer').show();
      $('#timer').css('color', '#080');
      break;
    case 'RUNNING':
      solutionMoves = [];
      startLocalTimer();
      $('#timer').css('color', '#999');
      break;
    case 'STOPPED':
      stopLocalTimer();
      let stoppedcolor = darkModeToggle.checked ? '#ccc' : '#333';
      $('#timer').css('color', stoppedcolor);
      var fittedMoves = cubeTimestampLinearFit(solutionMoves);
      var lastMove = fittedMoves.slice(-1).pop();
      const finalTime = lastMove ? lastMove.cubeTimestamp! : 0;
      setTimerValue(finalTime);

      // Store the time and update the display
      if (finalTime > 0) {
        lastFiveTimes.push(finalTime);
        if (lastFiveTimes.length > 5) {
          lastFiveTimes.shift(); // Keep only the last 5 times
        }
        practiceCount++; // Increment the practice count
        $('#' + algId).data('lastFiveTimes', lastFiveTimes);
        $('#' + algId).data('count', practiceCount);
        //console.log("[setTimerState] Setting lastFiveTimes to " + lastFiveTimes + " for algId " + algId);
        //console.log("[setTimerState] Setting practiceCount to " + practiceCount + " for algId " + algId);

        let failedCount: number = $('#' + algId).data('failed') || 0;
        if (failedCount < 0) failedCount = 0;
        let successCount: number = practiceCount - failedCount;
        $('#' + algId + '-success').html(`✅: ${successCount}`);
        if (failedCount > 0) $('#' + algId + '-failed').html(`❌: ${failedCount}`);
      }
      break;
  }
}

var myKpattern: KPattern;
var initialstate: KPattern;

twistyTracker.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  myKpattern = kpattern;
  if (patternStates.length > 0 && currentMoveIndex === 0 && myKpattern.isIdentical(initialstate)) {
    console.log("Returning to initial state")
    resetAlg();
    updateAlgDisplay();
  }
});

function setTimerValue(timestamp: number) {
  let t = makeTimeFromTimestamp(timestamp);
  $('#timer').html(`${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`);
}

var localTimer: Subscription | null = null;
function startLocalTimer() {
  var startTime = now();
  localTimer = interval(30).subscribe(() => {
    setTimerValue(now() - startTime);
  });
}

function stopLocalTimer() {
  localTimer?.unsubscribe();
  localTimer = null;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (confirm('New version available. Refresh now?')) {
      window.location.reload();
    }
  });
}

// Call the function to initialize default algorithms
initializeDefaultAlgorithms();

interface Algorithm {
  algorithm: string;
  name: string;
}

let checkedAlgorithms: Algorithm[] = [];
let checkedAlgorithmsCopy: Algorithm[] = [];
let currentAlgName: string = '';

// Collect checked algorithms using event delegation
$('#alg-cases').on('change', 'input[type="checkbox"]', function() {
  const algorithm = $(this).data('algorithm');
  const name = $(this).data('name');
  if ((this as HTMLInputElement).checked) {
    checkedAlgorithms.push({ algorithm, name });
  } else {
    // remove all occurrences of this algorithm from checkedAlgorithms and checkedAlgorithmsCopy
    checkedAlgorithms = checkedAlgorithms.filter(alg => alg.algorithm !== algorithm || alg.name !== name);
    checkedAlgorithmsCopy = checkedAlgorithmsCopy.filter(alg => alg.algorithm !== algorithm || alg.name !== name);
  }
  if (checkedAlgorithms.length > 0) {
    $('#save-alg').prop('disabled', false);
    if (conn) {
      $('#train-alg').prop('disabled', false);
    }
    $('#alg-input').val(checkedAlgorithms[0].algorithm);
    $('#train-alg').trigger('click');
  }
  //console.log("checkedAlgorithms: " + JSON.stringify(checkedAlgorithms));
  //console.log("checkedAlgorithmsCopy: " + JSON.stringify(checkedAlgorithmsCopy));
});

// Event listener for Delete Mode toggle
$('#delete-mode-toggle').on('change', () => {
  const isDeleteModeOn = $('#delete-mode-toggle').is(':checked');
  $('#delete-alg').prop('disabled', !isDeleteModeOn);
});

// Event listener for Delete button
$('#delete-alg').on('click', () => {
  const category = $('#category-select').val()?.toString() || '';
  if (checkedAlgorithms.length > 0) {
    if (confirm('Are you sure you want to delete the selected algorithms?')) {
      for (const algorithm of checkedAlgorithms) {
        if (algorithm && category) {
          deleteAlgorithm(category, algorithm.algorithm);
        }
      }
      loadAlgorithms(category); // Refresh the algorithm list
      // make sure delete mode is off
      const deleteModeToggle = $('#delete-mode-toggle');
      deleteModeToggle.prop('checked', false);
      deleteModeToggle.toggle();
      $('#delete-alg').prop('disabled', true);
      checkedAlgorithms = [];
      checkedAlgorithmsCopy = [];
      // only re-load subsets if there are no more alg-cases (subset has been deleted)
      if ($('#alg-cases').children().length === 0) {
        loadSubsets(category);
      }
      // only re-load categories if there are no more subsets (category has been deleted)
      if ($('#subset-checkboxes-container').children().length === 0) {
        loadCategories();
      }
      $('#delete-success').text('Algorithms deleted successfully');
      $('#delete-success').show();
      setTimeout(() => {
        $('#delete-success').fadeOut();
      }, 3000); // Disappears after 3 seconds
    }
  }
});

// Event listener for Confirm Save button
$('#confirm-save').on('click', () => {
  const category = $('#category-input').val()?.toString().trim() || '';
  const subset = $('#subset-input').val()?.toString().trim() || '';
  const name = $('#alg-name-input').val()?.toString().trim() || '';
  const algorithm = expandNotation($('#alg-input').val()?.toString().trim() || '');
  if (category.length > 0 && subset.length > 0 && name.length > 0 && algorithm.length > 0) {
    saveAlgorithm(category, subset, name, algorithm);
    $('#category-input').val('');
    $('#alg-name-input').val('');
    $('#subset-input').val('');
    $('#save-error').hide();
    $('#save-success').text('Algorithm saved successfully');
    $('#save-success').show();
    setTimeout(() => {
      $('#save-success').fadeOut();
    }, 3000); // Disappears after 3 seconds
    loadCategories();
    // select the new category
    $('#category-select').val(category).trigger('change');
  } else {
    $('#save-success').hide();
    $('#save-error').text('Please fill in all fields');
    $('#save-error').show();
    setTimeout(() => {
      $('#save-error').fadeOut();
    }, 3000); // Disappears after 3 seconds
  }
});

// Event listener for Load button
$('#load-alg').on('click', () => {
  const categorySelect = $('#category-select');
  if (categorySelect.val() === null || categorySelect.val() === '') {
    loadCategories();
  }
  $('#load-container').toggle();
  $('#save-container').hide();
  $('#options-container').hide();
  $('#help').hide();
  $('#info').hide();
  $('#show-options').html('Show Options');
  $('#show-help').html('Show Help');
});

// Event listener for Save button
$('#save-alg').on('click', () => {
  $('#save-success').hide();
  $('#save-error').hide();
  $('#save-container').toggle();
  $('#load-container').hide();
  $('#options-container').hide();
  $('#help').hide();
  $('#info').hide();
  $('#show-options').html('Show Options');
  $('#show-help').html('Show Help');
});

// Event listener for Category select change
$('#category-select').on('change', () => {
  const category = $('#category-select').val()?.toString();
  if (category) {
    loadSubsets(category);
  }
  // uncheck all checkboxes
  checkedAlgorithms = [];
  checkedAlgorithmsCopy = [];
  $('#select-all-toggle').prop('checked', false);
  $('#select-all-subsets-toggle').prop('checked', false);
  //$('#random-order-toggle').prop('checked', false);
  //randomAlgorithms = false;
  //$('#random-auf-toggle').prop('checked', false);
  //randomizeAUF = false;
  //$('#prioritize-failed-toggle').prop('checked', false);
  //prioritizeFailedAlgs = false;
  // reset cube alg
  twistyPlayer.alg = '';
  // selecting a new category should reset the current practice drill
  $('#times-display').html('');
  $('#alg-display-container').hide();
  $('#alg-display').html('');
  $('#alg-input').val('');
  $('#alg-input').show();
});

// Add event listener for subset checkboxes
$('#subset-checkboxes').on('change', 'input[type="checkbox"]', () => {
  const selectedCategory = $('#category-select').val() as string;
  loadAlgorithms(selectedCategory);
  // check the checkboxes of all algorithms in #alg-cases
  checkedAlgorithms = [];
  checkedAlgorithmsCopy = [];
  $('#alg-cases input[type="checkbox"]').prop('checked', true);
  $('#alg-cases input[type="checkbox"]').trigger('change');
});


// Event listener for Export button
$('#export-algs').on('click', () => {
  exportAlgorithms();
});

// Event listener for Import button
$('#import-algs').on('click', () => {
  $('#import-file').trigger('click');
});

// Event listener for file input change
$('#import-file').on('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    importAlgorithms(file);
  }
});

// Add event listener for Options button
$('#show-options').on('click', () => {
  const optionsDiv = $('#options-container');
  optionsDiv.toggle();
  if (optionsDiv.css('display') === 'none') {
    $('#show-options').html('Show Options');
  } else {
    $('#show-options').html('Hide Options');
    $('#load-container').hide();
    $('#save-container').hide();
    $('#info').hide();
    $('#help').hide();
    $('#show-help').html('Show Help');
  }
});

$(function() {
  loadConfiguration();
});

function loadConfiguration() {
  const visualization = localStorage.getItem('visualization');
  if (visualization) {
    $('#visualization-select').val(visualization).trigger('change');
  }

  const hintFacelets = localStorage.getItem('hintFacelets');
  if (hintFacelets) {
    hintFaceletsToggle.checked = hintFacelets === 'floating';
    twistyPlayer.hintFacelets = hintFacelets === 'floating' ? 'floating' : 'none';
  } else {
    hintFaceletsToggle.checked = false;
    twistyPlayer.hintFacelets = 'none';
  }

  const fullStickering = localStorage.getItem('fullStickering');
  if (fullStickering) {
    fullStickeringToggle.checked = fullStickering === 'true';
    fullStickeringEnabled = fullStickering === 'true';
  } else {
    fullStickeringToggle.checked = false;
    fullStickeringEnabled = false;
  }

  const backview = localStorage.getItem('backview');
  if (backview) {
    $('#backview-select').val(backview).trigger('change');
  }

  const gyroscopeValue = localStorage.getItem('gyroscope');
  if (gyroscopeValue) {
    gyroscopeToggle.checked = gyroscopeValue === 'enabled';
    gyroscopeEnabled = gyroscopeValue === 'enabled';
  } else {
    gyroscopeToggle.checked = true;
    gyroscopeEnabled = true;
  }

  const controlPanel = localStorage.getItem('control-panel');
  if (controlPanel) {
    controlPanelToggle.checked = controlPanel === 'bottom-row';
    twistyPlayer.controlPanel = controlPanel === 'bottom-row' ? 'bottom-row' : 'none';
  } else {
    controlPanelToggle.checked = false;
    twistyPlayer.controlPanel = 'none';
  }

  const flashingIndicatorState = localStorage.getItem('flashingIndicatorEnabled');
  if (flashingIndicatorState) {
    flashingIndicatorToggle.checked = flashingIndicatorState === 'true';
    flashingIndicatorEnabled = flashingIndicatorState === 'true';
  } else {
    flashingIndicatorToggle.checked = true;
    flashingIndicatorEnabled = true;
  }

  const showAlgnameState = localStorage.getItem('showAlgName');
  if (showAlgnameState) {
    showAlgNameToggle.checked = showAlgnameState === 'true';
    showAlgNameEnabled = showAlgnameState === 'true';
  } else {
    showAlgNameToggle.checked = true;
    showAlgNameEnabled = true;
  }

}

// Add event listener for the gyroscope toggle
var gyroscopeEnabled: boolean = true;
const gyroscopeToggle = document.getElementById('gyroscope-toggle') as HTMLInputElement;
gyroscopeToggle.addEventListener('change', () => {
  gyroscopeEnabled = gyroscopeToggle.checked;
  localStorage.setItem('gyroscope', gyroscopeEnabled ? 'enabled' : 'disabled');
  requestAnimationFrame(amimateCubeOrientation);
});

// Add event listener for the control panel toggle
const controlPanelToggle = document.getElementById('control-panel-toggle') as HTMLInputElement;
controlPanelToggle.addEventListener('change', () => {
  localStorage.setItem('control-panel', controlPanelToggle.checked ? 'bottom-row' : 'none');
  twistyPlayer.controlPanel = controlPanelToggle.checked ? 'bottom-row' : 'none';
});

// Add event listener for the hint facelets toggle
const hintFaceletsToggle = document.getElementById('hintFacelets-toggle') as HTMLInputElement;
hintFaceletsToggle.addEventListener('change', () => {
  localStorage.setItem('hintFacelets', hintFaceletsToggle.checked ? 'floating' : 'none');
  twistyPlayer.hintFacelets = hintFaceletsToggle.checked ? 'floating' : 'none';
});

// Add event listener for the full sticker toggle
export var fullStickeringEnabled: boolean = false;
const fullStickeringToggle = document.getElementById('full-stickering-toggle') as HTMLInputElement;
fullStickeringToggle.addEventListener('change', () => {
  fullStickeringEnabled = fullStickeringToggle.checked;
  localStorage.setItem('fullStickering', fullStickeringToggle.checked.toString());
  if (fullStickeringEnabled) {
    twistyPlayer.experimentalStickering = 'full';
  } else {
    let category = $('#category-select').val()?.toString().toLowerCase() || 'pll';
    setStickering(category);
  }
});

var flashingIndicatorEnabled: boolean = true;
const flashingIndicatorToggle = document.getElementById('flashing-indicator-toggle') as HTMLInputElement;
flashingIndicatorToggle.addEventListener('change', () => {
  flashingIndicatorEnabled = flashingIndicatorToggle.checked;
  localStorage.setItem('flashingIndicatorEnabled', flashingIndicatorToggle.checked.toString());
});

var showAlgNameEnabled: boolean = true;
const showAlgNameToggle = document.getElementById('show-alg-name-toggle') as HTMLInputElement;
showAlgNameToggle.addEventListener('change', () => {
  showAlgNameEnabled = showAlgNameToggle.checked;
  localStorage.setItem('showAlgName', showAlgNameToggle.checked.toString());
  updateTimesDisplay(); // Update display immediately when toggled
});

// Add event listeners for the selectors to update twistyPlayer settings
var forceFix: boolean = false;
$('#visualization-select').on('change', () => {
  const visualizationValue = $('#visualization-select').val() || 'PG3D';
  localStorage.setItem('visualization', visualizationValue as string);
  switch (visualizationValue) {
    case '2D':
      twistyPlayer.visualization = '2D';
      break;
    case '3D':
      twistyPlayer.visualization = '3D';
      break;
    case 'PG3D':
      twistyPlayer.visualization = 'PG3D';
      break;
    case 'experimental-2D-LL':
      twistyPlayer.visualization = 'experimental-2D-LL';
      break;
    case 'experimental-2D-LL-face':
      twistyPlayer.visualization = 'experimental-2D-LL-face';
      break;
    default:
      twistyPlayer.visualization = 'PG3D';
  }
  // fix for 3D visualization not animating after visualization change
  if (conn && (visualizationValue as string).includes('3D')) {
    forceFix = true;
    requestAnimationFrame(amimateCubeOrientation);
  } else {
    forceFix = false;
  }
});

$('#backview-select').on('change', () => {
  const backviewValue = $('#backview-select').val();
  localStorage.setItem('backview', backviewValue as string);
  switch (backviewValue) {
    case 'none':
      twistyPlayer.backView = 'none';
      break;
    case 'side-by-side':
      twistyPlayer.backView = 'side-by-side';
      break;
    case 'top-right':
      twistyPlayer.backView = 'top-right';
      break;
    default:
      twistyPlayer.backView = 'none';
  }
});

const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;

// Check for saved user preference
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
  darkModeToggle.checked = true; // Set checkbox to checked if dark mode is active
} else {
  document.documentElement.classList.remove('dark');
  darkModeToggle.checked = false; // Set checkbox to unchecked if dark mode is not active
}

// Add event listener for the dark mode toggle checkbox
darkModeToggle.addEventListener('change', () => {
  document.documentElement.classList.toggle('dark', darkModeToggle.checked);
  if (darkModeToggle.checked) {
    localStorage.setItem('theme', 'dark');
  } else {
    localStorage.setItem('theme', 'light');
  }
  // redraw input alg
  updateAlgDisplay();
});

// Event listener for the select all subsets toggle
$('#select-all-subsets-toggle').on('change', function() {
  const selectAllToggle = $('#select-all-toggle');
  checkedAlgorithms = [];
  checkedAlgorithmsCopy = [];
  const isChecked = $(this).is(':checked');
  if (isChecked) {
    $('#subset-checkboxes-container input[type="checkbox"]').prop('checked', true);
    const selectedCategory = $('#category-select').val() as string;
    selectAllToggle.prop('checked', true);
    loadAlgorithms(selectedCategory);
    $('#alg-cases input[type="checkbox"]').prop('checked', true).trigger('change');
  } else {
    $('#subset-checkboxes-container input[type="checkbox"]').prop('checked', false);
    selectAllToggle.prop('checked', false);
    loadAlgorithms('');
  }
});

// Add event listener for the select all toggle
const selectAllToggle = document.getElementById('select-all-toggle') as HTMLInputElement;
selectAllToggle.addEventListener('change', () => {
  checkedAlgorithms = [];
  checkedAlgorithmsCopy = [];
  $('#alg-cases input[type="checkbox"]').prop('checked', selectAllToggle.checked).trigger('change');
});

// Add event listener for the random order toggle
let randomAlgorithms: boolean = false;
const randomOrderToggle = document.getElementById('random-order-toggle') as HTMLInputElement;
randomOrderToggle.addEventListener('change', () => {
  randomAlgorithms = randomOrderToggle.checked;
});

// Add event listener for the random AUF toggle
let randomizeAUF: boolean = false;
const randomAUFToggle = document.getElementById('random-auf-toggle') as HTMLInputElement;
randomAUFToggle.addEventListener('change', () => {
  randomizeAUF = randomAUFToggle.checked;
});

// Add event listener for the prioritize failed toggle
let prioritizeFailedAlgs: boolean = false;
const prioritizeFailedToggle = document.getElementById('prioritize-failed-toggle') as HTMLInputElement;
prioritizeFailedToggle.addEventListener('change', () => {
  prioritizeFailedAlgs = prioritizeFailedToggle.checked;
});

$('#toggle-move-mask').on('click', (event) => {
  event.preventDefault();
  toggleMoveMask();
});

let isMoveMasked: boolean = false;
function toggleMoveMask() {
  isMoveMasked = !isMoveMasked; // Toggle the state
  $('.move').each(function() {
      $(this).css('-webkit-text-security', isMoveMasked ? 'disc' : 'none');
  });
  // change color of toggle-move-mask button
  $('#toggle-move-mask').toggleClass('bg-orange-500 hover:bg-orange-700', isMoveMasked).toggleClass('bg-blue-500 hover:bg-blue-700', !isMoveMasked);
  $('#toggle-move-mask').text(isMoveMasked ? '👁 Unmask alg' : '👁 Mask alg');
}