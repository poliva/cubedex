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
import { expandNotation, fixOrientation, getInverseMove, requestWakeLock, releaseWakeLock, initializeDefaultAlgorithms, saveAlgorithm, deleteAlgorithm, exportAlgorithms, importAlgorithms, loadAlgorithms, loadCategories } from './functions';

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
  lastFiveTimes = [];
  updateTimesDisplay();
  $('#alg-display').hide();
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
    $('#alg-display').text(userAlg.join(' ')); // Display the alg
    $('#alg-display').show();
    $('#timer').show();
    $('#alg-input').hide();
    hideMistakes();
    requestWakeLock();
    patternStates = [];
    algPatternStates = [];
    fetchNextPatterns();
    setTimerState("STOPPED");
    setTimerState("READY");
    lastFiveTimes = [];
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
});

function fetchNextPatterns() {
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
  drawAlgInCube();
}

function drawAlgInCube() {
  twistyPlayer.alg = Alg.fromString(userAlg.join(' ')).invert().toString();
}

var showMistakesTimeout: number;
let hasShownFlashingIndicator = false;

function showMistakesWithDelay(fixHtml: string) {
  if (fixHtml.length > 0) {
    $('#alg-fix').html(fixHtml);
    clearTimeout(showMistakesTimeout);
    showMistakesTimeout = setTimeout(function() {
      $('#alg-fix').show();
      // Show the red flashing indicator if enabled and not already shown
      const flashingIndicator = document.getElementById('flashing-indicator');
      const flashingIndicatorToggle = document.getElementById('flashing-indicator-toggle') as HTMLInputElement;
      if (flashingIndicator && flashingIndicatorToggle.checked && !hasShownFlashingIndicator) {
        flashingIndicator.style.backgroundColor = 'red';
        flashingIndicator.classList.remove('hidden');
        setTimeout(() => {
          flashingIndicator.classList.add('hidden');
        }, 300); // Hide after 0.3 seconds
        hasShownFlashingIndicator = true; // Set the flag to true
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

    // Don't mark double turns and slices as errors when they are not yet completed
    let cleanMove = move.replace(/[()']/g, "").trim();
    if (index === currentMoveIndex + 1 && cleanMove.length > 1) {
        const isSingleBadAlg = simplifiedBadAlg.length === 1;
        const isDoubleBadAlg = simplifiedBadAlg.length === 2;
        // when we have a U2 on an alg that contains slices or wide moves, the U turn is not really a U, but a different move depending on the orientation of the cube
        // TODO: this is could be done better by checking the center state, but it works for now
        const isSliceOrWideMove = /[MESudlrbfxyz]/.test(userAlg.slice(0, currentMoveIndex + 1).join(' '));

        if ((isSingleBadAlg && simplifiedBadAlg[0][0] === cleanMove[0]) ||
            (isDoubleBadAlg && 'MES'.includes(cleanMove[0])) ||
            (isSingleBadAlg && isSliceOrWideMove)) {
            color = 'blue';
            isDoubleTurn = true;
        }
    }

    if (previousColor === 'blue') color = darkModeToggle.checked ? 'white' : 'black';

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
        circleHtml += `<span style="color: ${color};">${char}</span>`;
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

  if (isDoubleTurn) fixHtml = '';
  if (fixHtml.length > 0) {
    showMistakesWithDelay(fixHtml);
  } else {
    hideMistakes();
  }

  // stay green in last move when alg is finished
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
      //console.log("obj[" + index + "]: " + JSON.stringify(pattern));
      if (myKpattern.applyMove(event.move).isIdentical(pattern)) {
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
          const flashingIndicatorToggle = document.getElementById('flashing-indicator-toggle') as HTMLInputElement;
          if (flashingIndicator && flashingIndicatorToggle.checked) {
            flashingIndicator.style.backgroundColor = 'green';
            flashingIndicator.classList.remove('hidden');
            setTimeout(() => {
              flashingIndicator.classList.add('hidden');
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

                // this is the initial state for the new algorithm
                initialstate = pattern;
                keepInitialState = true;
                $('#alg-input').val(checkedAlgorithms[0]);
                $('#train-alg').trigger('click');
              }
            }, 200); // Hide after 0.2 seconds
          }
        }
        return;
      }
    });
    if (!found) {
      badAlg.push(event.move);
      console.log("Pushing 1 incorrect move. badAlg: " + badAlg)

      if (currentMoveIndex === 0 && badAlg.length === 1 && lastMoves[lastMoves.length - 1].move === getInverseMove(userAlg[currentMoveIndex].replace(/[()]/g, ""))) { 
        currentMoveIndex--;
        badAlg.pop();
        console.log("Cancelling first correct move");
      }  else if (lastMoves[lastMoves.length - 1].move === getInverseMove(badAlg[badAlg.length -2])) { 
        badAlg.pop();
        badAlg.pop();
        console.log("Popping last incorrect move. badAlg=" + badAlg);
      } else if (badAlg.length > 3 && lastMoves.length > 3 && lastMoves[lastMoves.length - 1].move === lastMoves[lastMoves.length - 2].move && lastMoves[lastMoves.length - 2].move === lastMoves[lastMoves.length - 3].move && lastMoves[lastMoves.length - 3].move === lastMoves[lastMoves.length - 4].move ) {
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        console.log("Popping a turn (4 incorrect moves)");
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
    } else {
      twistyTracker.alg = '';
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
  if (isFallbackCall) {
    return prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:');
  } else {
    return typeof device.watchAdvertisements == 'function' ? null :
      prompt('Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:');
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

var lastFiveTimes: number[] = [];
let practiceCount = 0;

function updateTimesDisplay() {
  const timesDisplay = $('#times-display');
  if (lastFiveTimes.length === 0) {
    timesDisplay.html('');
    practiceCount = 0;
    return;
  }

  const timesHtml = lastFiveTimes.map((time, index) => {
    const t = makeTimeFromTimestamp(time);
    let number = practiceCount < 5 ? index + 1 : practiceCount - 5 + index + 1;
    return `<div>Time ${number}: ${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}</div>`;
  }).join('');

  const averageTime = lastFiveTimes.reduce((a, b) => a + b, 0) / lastFiveTimes.length;
  const avg = makeTimeFromTimestamp(averageTime);
  const averageHtml = `<div class="average"><strong>Average: ${avg.minutes}:${avg.seconds.toString(10).padStart(2, '0')}.${avg.milliseconds.toString(10).padStart(3, '0')}</strong></div>`;

  timesDisplay.html(timesHtml + averageHtml);
}

function setTimerState(state: typeof timerState) {
  timerState = state;
  switch (state) {
    case "IDLE":
      stopLocalTimer();
      $('#timer').hide();
      break;
    case 'READY':
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
        updateTimesDisplay();
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

var checkedAlgorithms: string[] = [];
var checkedAlgorithmsCopy: string[] = [];

// Collect checked algorithms using event delegation
$('#alg-cases').on('change', 'input[type="checkbox"]', function() {
  const algorithm = $(this).data('algorithm');
  if ((this as HTMLInputElement).checked) {
    checkedAlgorithms.push(algorithm);
  } else {
    const index = checkedAlgorithms.indexOf(algorithm);
    if (index > -1) {
      checkedAlgorithms.splice(index, 1);
    }
  }
  if (checkedAlgorithms.length > 0) {
    $('#save-alg').prop('disabled', false);
    if (conn) {
      $('#train-alg').prop('disabled', false);
    }
    $('#alg-input').val(checkedAlgorithms[0]);
    $('#train-alg').trigger('click');
  }
  console.log(checkedAlgorithms);
});


// Event listener for Delete Mode toggle
$('#delete-mode-toggle').on('change', () => {
  const isDeleteModeOn = $('#delete-mode-toggle').is(':checked');
  $('#delete-alg').prop('disabled', !isDeleteModeOn);
});

// Event listener for Delete button
$('#delete-alg').on('click', () => {
  const category = $('#category-select').val()?.toString();
  if (checkedAlgorithms.length > 0) {
    if (confirm('Are you sure you want to delete the selected algorithms?')) {
      for (const algorithm of checkedAlgorithms) {
        if (algorithm && category) {
          deleteAlgorithm(category, algorithm);
        }
      }
      loadAlgorithms(category); // Refresh the algorithm list
      // make sure delete mode is off
      const deleteModeToggle = $('#delete-mode-toggle');
      deleteModeToggle.prop('checked', false);
      deleteModeToggle.toggle();
      $('#delete-alg').prop('disabled', true);
      checkedAlgorithms = [];
      // only re-load categories if alg-cases is empty
      if ($('#alg-cases').children().length === 0) {
        loadCategories();
      }
    }
  }
});

// Event listener for Confirm Save button
$('#confirm-save').on('click', () => {
  const category = $('#category-input').val()?.toString().trim();
  const name = $('#alg-name-input').val()?.toString().trim();
  const algorithm = expandNotation($('#alg-input').val()?.toString().trim() || '');
  if (category && name && algorithm) {
    saveAlgorithm(category, name, algorithm);
    $('#category-input').val('');
    $('#alg-name-input').val('');
    $('#save-error').hide();
    $('#save-success').text('Algorithm saved successfully');
    $('#save-success').toggle();
    loadCategories();
    loadAlgorithms(category);
  } else {
    $('#save-success').hide();
    $('#save-error').text('Please fill in all fields');
    $('#save-error').toggle();
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
    loadAlgorithms(category);
  }
  // uncheck all checkboxes
  checkedAlgorithms = [];
  $('#select-all-toggle').prop('checked', false);
  $('#random-order-toggle').prop('checked', false);
  // reset cube alg
  twistyPlayer.alg = '';
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
  }

  const backview = localStorage.getItem('backview');
  if (backview) {
    $('#backview-select').val(backview).trigger('change');
  }

  const gyroscopeValue = localStorage.getItem('gyroscope');
  if (gyroscopeValue) {
    gyroscopeToggle.checked = gyroscopeValue === 'enabled';
    gyroscopeEnabled = gyroscopeValue === 'enabled';
  }

  const controlPanel = localStorage.getItem('control-panel');
  if (controlPanel) {
    controlPanelToggle.checked = controlPanel === 'bottom-row';
    twistyPlayer.controlPanel = controlPanel === 'bottom-row' ? 'bottom-row' : 'none';
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
  const controlPanelEnabled = controlPanelToggle.checked;
  localStorage.setItem('control-panel', controlPanelEnabled ? 'bottom-row' : 'none');
  twistyPlayer.controlPanel = controlPanelEnabled ? 'bottom-row' : 'none';
});

// Add event listener for the hint facelets toggle
const hintFaceletsToggle = document.getElementById('hintFacelets-toggle') as HTMLInputElement;
hintFaceletsToggle.addEventListener('change', () => {
  const hintFaceletsEnabled = hintFaceletsToggle.checked;
  localStorage.setItem('hintFacelets', hintFaceletsEnabled ? 'floating' : 'none');
  twistyPlayer.hintFacelets = hintFaceletsEnabled ? 'floating' : 'none';
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

// Add event listener for the random order toggle
let randomAlgorithms: boolean = false;
const randomOrderToggle = document.getElementById('random-order-toggle') as HTMLInputElement;
randomOrderToggle.addEventListener('change', () => {
  randomAlgorithms = randomOrderToggle.checked;
});

// Add event listener for the select all toggle
const selectAllToggle = document.getElementById('select-all-toggle') as HTMLInputElement;
selectAllToggle.addEventListener('change', () => {
  checkedAlgorithms = [];
  const isChecked = selectAllToggle.checked;
  $('#alg-cases input[type="checkbox"]').prop('checked', isChecked).trigger('change');
});

document.addEventListener('DOMContentLoaded', () => {
  const flashingIndicatorToggle = document.getElementById('flashing-indicator-toggle') as HTMLInputElement;
  
  // Load the state from localStorage
  const flashingIndicatorState = localStorage.getItem('flashingIndicatorEnabled');
  if (flashingIndicatorState !== null) {
    flashingIndicatorToggle.checked = flashingIndicatorState === 'true';
  }

  // Save the state to localStorage on change
  flashingIndicatorToggle.addEventListener('change', () => {
    localStorage.setItem('flashingIndicatorEnabled', flashingIndicatorToggle.checked.toString());
  });
});