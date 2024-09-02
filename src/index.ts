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

import { faceletsToPattern, patternToFacelets } from './utils';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

var twistyPlayer = new TwistyPlayer({
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

$('#input-alg').on('click', () => {
  resetAlg();
  $('#alg-input').val('');
  if (conn) {
    inputMode = true;
    $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    $('#alg-input').get(0)?.focus();
  } else {
    $('#alg-input').attr('placeholder', 'Please connect the smartcube first');
  }
  $('#alg-display').hide();
  $('#alg-input').show();
});

$('#submit-alg').on('click', () => {
  const algInput = $('#alg-input').val()?.toString().trim();
  if (algInput) {
    inputMode = false;
    userAlg = expandNotation(algInput).split(/\s+/); // Split the input string into moves
    $('#alg-display').text(userAlg.join(' ')); // Display the alg
    $('#alg-display').show();
    $('#alg-input').hide();
    hideMistakes();
    requestWakeLock();
    patternStates = [];
    algPatternStates = [];
    fetchNextPatterns();
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
  if (currentMoveIndex === userAlg.length -1) currentMoveIndex=-1;
}

async function handleMoveEvent(event: GanCubeEvent) {
  if (event.type == "MOVE") {
    if (timerState == "READY") {
      setTimerState("RUNNING");
    }
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    lastMoves.push(event);
    if (timerState == "RUNNING") {
      solutionMoves.push(event);
    }
    if (lastMoves.length > 256) {
      lastMoves = lastMoves.slice(-256);
    }
    if (lastMoves.length > 10) {
      var skew = cubeTimestampCalcSkew(lastMoves);
      $('#skew').val(skew + '%');
    }

    // Check if the current move matches the user's alg
    console.log("MOVE: " + event.move + " Index: " + currentMoveIndex + " currentValue: " + userAlg[currentMoveIndex]);
    if (inputMode) {
      $('#alg-input').val(function(_, currentValue) {
        return currentValue + lastMoves[lastMoves.length - 1].move + " ";
      });
      return;
    };
    //if (lastMoves.length > 1 ) console.log("LAST MOVE: " + lastMoves[lastMoves.length - 1].move);

    var found: boolean = false;
    patternStates.forEach((pattern, index) => {
      //console.log("obj[" + index + "]: " + JSON.stringify(pattern));
      if (myKpattern.applyMove(event.move).isIdentical(pattern)) {
        currentMoveIndex=index;
        found = true;
        badAlg = [];
        if (currentMoveIndex === userAlg.length - 1){
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
      twistyPlayer.alg = scramble;
    } else {
      twistyPlayer.alg = '';
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
  }
});

$('#device-info').on('click', () => {
  const infoDiv = $('#info');
  if (infoDiv.css('display') === 'none') {
      infoDiv.css('display', 'grid');
  } else {
      infoDiv.css('display', 'none');
  }
});

$('#reset-state').on('click', async () => {
  await conn?.sendCubeCommand({ type: "REQUEST_RESET" });
  twistyPlayer.alg = '';
});

$('#reset-gyro').on('click', async () => {
  basis = null;
});

$('#connect').on('click', async () => {
  if (conn) {
    conn.disconnect();
    conn = null;
    releaseWakeLock();
  } else {
    conn = await connectGanCube(customMacAddressProvider);
    conn.events$.subscribe(handleCubeEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
    $('#deviceName').val(conn.deviceName);
    $('#deviceMAC').val(conn.deviceMAC);
    $('#connect').html('Disconnect');
    $('#alg-input').attr('placeholder', "Enter alg e.g., (R U R' U) (R U2' R')");
    $('#alg-input').get(0)?.focus();
  }
});

var timerState: "IDLE" | "READY" | "RUNNING" | "STOPPED" = "IDLE";

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
      $('#timer').css('color', '#fff');
      var fittedMoves = cubeTimestampLinearFit(solutionMoves);
      var lastMove = fittedMoves.slice(-1).pop();
      setTimerValue(lastMove ? lastMove.cubeTimestamp! : 0);
      break;
  }
}

var myKpattern: KPattern;
var initialstate: KPattern;

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  var facelets = patternToFacelets(kpattern);
  myKpattern = kpattern;
  if (patternStates.length > 0 && currentMoveIndex === 0 && myKpattern.isIdentical(initialstate)) {
    console.log("Returning to initial state")
    resetAlg();
    updateAlgDisplay();
  }
  if (facelets == SOLVED_STATE) {
    if (timerState == "RUNNING") {
      setTimerState("STOPPED");
    }
    twistyPlayer.alg = '';
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