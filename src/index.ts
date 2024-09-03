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

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

var twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'floating',
  experimentalDragInput: 'auto',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
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
  if (!twistyScene || !twistyVantage) {
    var vantageList = await twistyPlayer.experimentalCurrentVantages();
    twistyVantage = [...vantageList][0];
    twistyScene = await twistyVantage.scene.scene();
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

function expandNotation(input: string): string {
  // Replace characters
  let output = input.replace(/["´`‘]/g, "'")  // Replace " ´ ` ‘ with '
                    .replace(/\[/g, "(")      // Replace [ with (
                    .replace(/\]/g, ")")      // Replace ] with )
                    .replace(/XYZ/g, "xyz");  // lowercase x y z

  // Remove characters not allowed
  output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');

  // Before a ( there must always be a space
  output = output.replace(/\(/g, ' (');

  // After a ) there must always be a space
  output = output.replace(/\)(?!\s)/g, ') ');

  // After a ' there must always be a space unless the next character is )
  output = output.replace(/'(?![\s)])/g, "' ");

  // After a 2 there must always be a space unless the next character is ) or '
  output = output.replace(/2(?![\s')])/g, '2 ');

  // After any letter of RLFBUDMESrlfbudxyz there must always be a space unless the next character is ) ' or 2
  output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');

  // There can't be a space before a 2
  output = output.replace(/(\s)(?=2)/g, '');;

  // R'2 must be R2' instead
  output = output.replace(/'2/g, "2'");;

  // There can't be more than 1 space together
  output = output.replace(/\s+/g, ' ');

  // Trim to ensure no leading or trailing spaces
  return output.trim();
}

function resetAlg() {
  console.log("RESET ALG");
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
  lastFiveTimes = [];
  updateTimesDisplay();
  $('#alg-display').hide();
  $('#times-display').hide();
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
    $('#times-display').show();
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

function fixOrientation(pattern: KPattern) {
  if (JSON.stringify(pattern.patternData["CENTERS"].pieces) === JSON.stringify([0, 1, 2, 3, 4, 5])) {
    return pattern;
  }
  for (const letter of ['x', 'y', 'z']) {
    let result = pattern;
    for (let i = 0; i < 4; i++) {
      result = result.applyAlg(letter);
      if (JSON.stringify(result.patternData["CENTERS"].pieces) === JSON.stringify([0, 1, 2, 3, 4, 5])) {
        return result;
      }
    }
  }
  return pattern;
}

function fetchNextPatterns() {
  initialstate = patternStates.length === 0 ? myKpattern : patternStates[patternStates.length - 1];
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

function showMistakesWithDelay(fixHtml: string) {
  if (fixHtml.length > 0) {
    $('#alg-fix').html(fixHtml);
    clearTimeout(showMistakesTimeout);
    showMistakesTimeout = setTimeout(function() {
      $('#alg-fix').show();
    }, 500);  // 0.5 second
  } else {
    hideMistakes();
  }
}

function hideMistakes() {
  // Clear the timeout if hide is called before the div is shown
  clearTimeout(showMistakesTimeout);
  $('#alg-fix').hide();
  $('#alg-fix').html("");
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

  userAlg.forEach((move, index) => {
    color = 'black'; // Default color

    // Determine the color based on the move index
    if (index < currentMoveIndex) {
      color = 'green'; // Correct moves
    } else if (index <= currentMoveIndex + simplifiedBadAlg.length) {
      color = 'red'; // Incorrect moves
    }

    // Highlight the current move
    if (index === currentMoveIndex) {
      color = 'white';
    }

    // Don't mark double turns and slices as errors when they are not yet completed
    let cleanMove = move.replace(/[()']/g, "").trim();
    if (index === currentMoveIndex + 1 && cleanMove.length > 1 && (simplifiedBadAlg.length === 1 || (simplifiedBadAlg.length === 2 && 'MES'.includes(cleanMove[0])))) {
        color = 'blue';
    }

    if (previousColor === 'blue') color = 'black';

    // Build moveHtml excluding parentheses
    let circleHtml = '';
    let preCircleHtml = '';
    let postCircleHtml = '';

    for (let char of move) {
      if (char === '(') {
        preCircleHtml += `<span style="color: black;">${char}</span>`;
      } else if (char === ')') {
        postCircleHtml += `<span style="color: black;">${char}</span>`;
      } else {
        circleHtml += `<span style="color: ${color};">${char}</span>`;
      }
    }

    // Wrap non-parenthesis characters in circle class if it's the current move
    if (index === currentMoveIndex) {
      displayHtml += `${preCircleHtml}<span class="circle">${circleHtml}</span>${postCircleHtml} `;
    } else {
      displayHtml += `${preCircleHtml}${circleHtml}${postCircleHtml} `;
    }
    previousColor = color;
  });

  // Update the display with the constructed HTML
  $('#alg-display').html(displayHtml);

  if (color === 'blue') fixHtml = '';
  if (fixHtml.length > 0) {
    showMistakesWithDelay(fixHtml);
  } else {
    hideMistakes();
  }

  // stay green in last move when alg is finished
  if (currentMoveIndex === userAlg.length - 1) currentMoveIndex = -1;
}

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
        }
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

function getInverseMove(move: string): string {
  const inverseMoves: { [key: string]: string } = {
      'U': 'U\'', 'U\'': 'U',
      'D': 'D\'', 'D\'': 'D',
      'L': 'L\'', 'L\'': 'L',
      'R': 'R\'', 'R\'': 'R',
      'F': 'F\'', 'F\'': 'F',
      'B': 'B\'', 'B\'': 'B',
      'u': 'u\'', 'u\'': 'u',
      'd': 'd\'', 'd\'': 'd',
      'l': 'l\'', 'l\'': 'l',
      'r': 'r\'', 'r\'': 'r',
      'f': 'f\'', 'f\'': 'f',
      'b': 'b\'', 'b\'': 'b',
      'M': 'M\'', 'M\'': 'M',
      'E': 'E\'', 'E\'': 'E',
      'S': 'S\'', 'S\'': 'S',
      'x': 'x\'', 'x\'': 'x',
      'y': 'y\'', 'y\'': 'y',
      'z': 'z\'', 'z\'': 'z'
  };
  return inverseMoves[move] || move; // Return the move itself if not found
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
  if (event.type != "GYRO")
    console.log("GanCubeEvent", event);
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
  const averageHtml = `<div class="average">Average: ${avg.minutes}:${avg.seconds.toString(10).padStart(2, '0')}.${avg.milliseconds.toString(10).padStart(3, '0')}</div>`;

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
      $('#timer').css('color', '#0f0');
      break;
    case 'RUNNING':
      solutionMoves = [];
      startLocalTimer();
      $('#timer').css('color', '#999');
      break;
    case 'STOPPED':
      stopLocalTimer();
      $('#timer').css('color', '#333');
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
  /*
  var facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    if (timerState == "RUNNING") {
      setTimerState("STOPPED");
    }
    twistyTracker.alg = '';
  }
  */
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

/*
function activateTimer() {
  if (timerState == "IDLE" && conn) {
    setTimerState("READY");
  } else {
    setTimerState("IDLE");
  }
}

$(document).on('keydown', (event) => {
  if (event.which == 32) {
    event.preventDefault();
    activateTimer();
  }
});

$("#cube").on('touchstart', () => {
  activateTimer();
});
*/

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (confirm('New version available. Refresh now?')) {
      window.location.reload();
    }
  });
}

let wakeLock: WakeLockSentinel | null = null;

// Function to request a wake lock
async function requestWakeLock() {
  try {
    // Check if wake lock is supported
    if ('wakeLock' in navigator) {
      // Request a screen wake lock
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake lock is active');

      // Add an event listener to detect visibility change
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      console.log('Wake lock is not supported by this browser.');
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(`${err.name}, ${err.message}`);
    } else {
      console.error('An unknown error occurred.');
    }
  }
}

// Function to release the wake lock
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Wake lock has been released');
    });
  }
}

// Function to handle visibility change
function handleVisibilityChange() {
  if (wakeLock !== null) {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }
}

import defaultAlgs from './defaultAlgs.json';

// Function to initialize the localStorage with default algorithms if empty
function initializeDefaultAlgorithms() {
  if (!localStorage.getItem('savedAlgs')) {
    localStorage.setItem('savedAlgs', JSON.stringify(defaultAlgs));
  }
}

// Call the function to initialize default algorithms
initializeDefaultAlgorithms();

// Function to save the algorithm to localStorage
function saveAlgorithm(category: string, name: string, algorithm: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  if (!savedAlgs[category]) {
    savedAlgs[category] = [];
  }
  savedAlgs[category].push({ name, algorithm });
  localStorage.setItem('savedAlgs', JSON.stringify(savedAlgs));
}

// Function to load categories from localStorage
function loadCategories() {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  const categorySelect = $('#category-select');
  categorySelect.empty();
  categorySelect.append('<option value="">Filter by Category</option>');
  Object.keys(savedAlgs).forEach(category => {
    categorySelect.append(`<option value="${category}">${category}</option>`);
  });
}

// Function to load algorithms based on selected category
function loadAlgorithms(category?: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  const algSelect = $('#alg-select');
  algSelect.empty();
  algSelect.append('<option value="">Select Algorithm</option>');

  if (category) {
    if (savedAlgs[category]) {
      savedAlgs[category].forEach((alg: { name: string, algorithm: string }) => {
        algSelect.append(`<option value="${alg.algorithm}">${alg.name}</option>`);
      });
    }
  } else {
    // Show all algorithms if no category is selected
    Object.keys(savedAlgs).forEach(cat => {
      savedAlgs[cat].forEach((alg: { name: string, algorithm: string }) => {
        algSelect.append(`<option value="${alg.algorithm}">[${cat}] ${alg.name}</option>`);
      });
    });
  }
}

// Function to delete an algorithm from localStorage
function deleteAlgorithm(category: string, algorithm: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  if (savedAlgs[category]) {
    savedAlgs[category] = savedAlgs[category].filter((alg: { name: string, algorithm: string }) => alg.algorithm !== algorithm);
    if (savedAlgs[category].length === 0) {
      delete savedAlgs[category]; // Delete category if empty
    }
    localStorage.setItem('savedAlgs', JSON.stringify(savedAlgs));
  }
}

// Function to export algorithms to a text file
function exportAlgorithms() {
  const savedAlgs = localStorage.getItem('savedAlgs');
  if (savedAlgs) {
    const blob = new Blob([savedAlgs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cubedex-Algorithms.json';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    alert('No algorithms to export.');
  }
}

// Event listener for Delete Mode toggle
$('#delete-mode-toggle').on('change', () => {
  const isDeleteModeOn = $('#delete-mode-toggle').is(':checked');
  $('#delete-alg').prop('disabled', !isDeleteModeOn);
});

// Event listener for Delete button
$('#delete-alg').on('click', () => {
  const category = $('#category-select').val()?.toString();
  const algorithm = $('#alg-select').val()?.toString();
  if (algorithm) {
    if (confirm('Are you sure you want to delete this algorithm?')) {
      if (category) {
        deleteAlgorithm(category, algorithm);
        loadAlgorithms(category); // Refresh the algorithm list
        if ($('#alg-select').children().length === 1) { // If no algorithms left, refresh categories
          loadCategories();
        }
      } else {
        // If no category is selected, search through all categories
        const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
        for (const cat in savedAlgs) {
          if (savedAlgs[cat].some((alg: { algorithm: string }) => alg.algorithm === algorithm)) {
            deleteAlgorithm(cat, algorithm);
            break;
          }
        }
        loadAlgorithms(); // Refresh the algorithm list
        loadCategories(); // Refresh categories
      }
    }
  }
});

// Function to import algorithms from a text file
function importAlgorithms(file: File) {
  const reader = new FileReader();
  reader.onload = (event) => {
    if (event.target?.result) {
      try {
        const importedAlgs = JSON.parse(event.target.result as string);
        localStorage.setItem('savedAlgs', JSON.stringify(importedAlgs));
        alert('Algorithms imported successfully.');
        loadCategories();
        loadAlgorithms();
      } catch (e) {
        alert('Failed to import algorithms. Please ensure the file is in the correct format.');
      }
    }
  };
  reader.readAsText(file);
}

// Event listener for Confirm Save button
$('#confirm-save').on('click', () => {
  const category = $('#category-input').val()?.toString().trim();
  const name = $('#alg-name-input').val()?.toString().trim();
  const algorithm = $('#alg-input').val()?.toString().trim();
  if (category && name && algorithm) {
    saveAlgorithm(category, name, algorithm);
    $('#save-container').hide();
    $('#category-input').val('');
    $('#alg-name-input').val('');
  }
});

// Event listener for Load button
$('#load-alg').on('click', () => {
  loadCategories();
  loadAlgorithms(); // Load all algorithms initially
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
  } else {
    loadAlgorithms(); // Load all algorithms if no category is selected
  }
});

// Event listener for Algorithm select change
$('#alg-select').on('change', () => {
  const algorithm = $('#alg-select').val()?.toString();
  let category = $('#category-select').val()?.toString();
  const validCategories = [
    'PLL', 'CLS', 'OLL', 'EOLL', 'COLL', 'OCLL', 'CPLL', 'CLL', 'EPLL', 'ELL', 'ELS', 'LL', 'F2L', 'ZBLL', 'ZBLS', 'VLS', 'WVLS', 'LS', 'LSOLL', 'LSOCLL', 'EO', 'EOline', 'EOcross', 'CMLL', 'L10P', 'L6E', 'L6EO', 'Daisy', 'Cross'
  ];

  if (algorithm) {
    $('#save-alg').prop('disabled', false);
    if (conn) {
      $('#train-alg').prop('disabled', false);
    }
    $('#alg-input').val(algorithm);
    $('#train-alg').trigger('click');

    if (!category) {
      const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
      for (const cat in savedAlgs) {
        if (savedAlgs[cat].some((alg: { algorithm: string }) => alg.algorithm === algorithm)) {
          category = cat;
          break;
        }
      }
    }

    if (category === '2-Look PLL') {
      category = 'PLL';
    } else if (category === '2-Look OLL') {
      category = 'OLL';
    }
    if (category && validCategories.includes(category)) {
      twistyPlayer.experimentalStickering = category;
    } else {
      twistyPlayer.experimentalStickering = 'full';
    }
  }
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
    $('#hintFacelets-select').val(hintFacelets).trigger('change');
  }

  const backview = localStorage.getItem('backview');
  if (backview) {
    $('#backview-select').val(backview).trigger('change');
  }
}
// Add event listeners for the selectors to update twistyPlayer settings
$('#visualization-select').on('change', () => {
  const visualizationValue = $('#visualization-select').val();
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
});

$('#hintFacelets-select').on('change', () => {
  const hintFaceletsValue = $('#hintFacelets-select').val();
  localStorage.setItem('hintFacelets', hintFaceletsValue as string);
  switch (hintFaceletsValue) {
    case 'floating':
      twistyPlayer.hintFacelets = 'floating';
      break;
    case 'none':
      twistyPlayer.hintFacelets = 'none';
      break;
    default:
      twistyPlayer.hintFacelets = 'none';
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