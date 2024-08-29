import './style.css'

import $ from 'jquery';
import { Subscription, interval } from 'rxjs';
import { TwistyPlayer } from 'cubing/twisty';
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
var currentMoveIndex = 0;
var incorrectMoves: number[] = [];
var inputMode: boolean = false;

function expandNotation(input: string): string {
  // If there are no spaces in the input, insert spaces between moves
  if (!input.includes(' ')) {
    input = input.replace(/([A-Z]'?)(?=[A-Z])/g, '$1 ').replace(/([A-Z])([2])/g, '$1 $2');
  }

  // Replace all occurrences of letters followed by a number (e.g., R2, U2', etc.)
  return input.replace(/([A-Z])([2])('?)/g, (_: string, letter: string, number: string, prime: string) => {
    // Calculate the repetitions based on the number (2 means 2 times)
    let repetitions = parseInt(number, 10);
    // Construct the replacement string, adding ' if needed
    let replacement = (letter + prime + ' ').repeat(repetitions).trim();
    return replacement;
  });
}

function resetAlg() {
  currentMoveIndex = 0; // Reset the move index
  incorrectMoves = []; // Reset incorrect moves
  badAlg = [];
  $('#alg-fix').hide();
  $('#alg-fix').html("");
}

$('#input-alg').on('click', () => {
  resetAlg();
  $('#alg-input').val('');
  if (conn) {
    inputMode = true;
    $('#alg-input').attr('placeholder', 'Turn the smartcube to input the algorithm');
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
    userAlg = expandNotation(algInput.replace(/[()]/g, '')).split(/\s+/); // Split the input string into moves
    $('#alg-display').text(userAlg.join(' ')); // Display the alg
    $('#alg-display').show();
    $('#alg-input').hide();
    $('#alg-fix').hide();
  } else {
    $('#alg-input').show();
    $('#alg-input').attr('placeholder', "Enter alg e.g., R U R' U'");
  }
  resetAlg();
});

function updateAlgDisplay() {
  let displayHtml = '';
  userAlg.forEach((move, index) => {
      let color = 'black'; // Default color
      if (index == currentMoveIndex) color = 'white';
      if (index < currentMoveIndex) {
        color = 'green'; // Correct moves
      } else if (incorrectMoves.includes(index)) {
        color = 'red'; // Incorrect moves
      }
      if (index == currentMoveIndex) {
        displayHtml += `<span class="circle" style="color: ${color};">${move} </span>`;
      } else {
        displayHtml += `<span style="color: ${color};">${move} </span>`;
      }
  });
  $('#alg-display').html(displayHtml);
  let fixHtml  = '';
  for (let i=0 ; i<badAlg.length; i++){
    fixHtml += getInverseMove(badAlg[badAlg.length - 1 - i])+" ";
  }
  if (fixHtml.length > 0) {
    $('#alg-fix').html(fixHtml);
    $('#alg-fix').show();
  } else {
    $('#alg-fix').hide();
  }
}

function fixSlice() {
  console.log("FIXING SLICE ;)")
  incorrectMoves.pop();
  incorrectMoves.pop();
  badAlg.pop();
  badAlg.pop();
  currentMoveIndex += 2;
  if (currentMoveIndex === userAlg.length) resetAlg();
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
    if (lastMoves.length > 1 ) console.log("LAST MOVE: " + lastMoves[lastMoves.length - 1].move);
    if (userAlg[currentMoveIndex] === event.move && incorrectMoves.length === 0) {
      currentMoveIndex++;
      incorrectMoves = incorrectMoves.filter(index => index !== currentMoveIndex); // Remove from incorrect moves if corrected
      badAlg = [];
      if (currentMoveIndex === userAlg.length){
        resetAlg();
      }
    } else {
      badAlg.push(event.move);
      if (!incorrectMoves.includes(currentMoveIndex)) {
        incorrectMoves.push(currentMoveIndex);
      } else {
        incorrectMoves.push(incorrectMoves[incorrectMoves.length-1]+1);
      }
      console.log("Pushing 1 incorrect move. incorrectMoves: " + incorrectMoves + " badAlg: " + badAlg)
      
      // fix for slice moves (S,M,E)
      if (incorrectMoves.length === 2){
        // fix R+L = L+R
        if (lastMoves[lastMoves.length - 1].move === "R"  && lastMoves[lastMoves.length - 2].move === "L"  && userAlg[currentMoveIndex + 1] === "L"  && userAlg[currentMoveIndex] === "R") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "R"  && lastMoves[lastMoves.length - 2].move === "L'" && userAlg[currentMoveIndex + 1] === "L'" && userAlg[currentMoveIndex] === "R") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "R'" && lastMoves[lastMoves.length - 2].move === "L'" && userAlg[currentMoveIndex + 1] === "L'" && userAlg[currentMoveIndex] === "R'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "R'" && lastMoves[lastMoves.length - 2].move === "L"  && userAlg[currentMoveIndex + 1] === "L"  && userAlg[currentMoveIndex] === "R'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "L"  && lastMoves[lastMoves.length - 2].move === "R"  && userAlg[currentMoveIndex + 1] === "R"  && userAlg[currentMoveIndex] === "L") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "L"  && lastMoves[lastMoves.length - 2].move === "R'" && userAlg[currentMoveIndex + 1] === "R'" && userAlg[currentMoveIndex] === "L") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "L'" && lastMoves[lastMoves.length - 2].move === "R'" && userAlg[currentMoveIndex + 1] === "R'" && userAlg[currentMoveIndex] === "L'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "L'" && lastMoves[lastMoves.length - 2].move === "R"  && userAlg[currentMoveIndex + 1] === "R"  && userAlg[currentMoveIndex] === "L'") fixSlice();

        // fix U+D = D+U
        if (lastMoves[lastMoves.length - 1].move === "U"  && lastMoves[lastMoves.length - 2].move === "D"  && userAlg[currentMoveIndex + 1] === "D"  && userAlg[currentMoveIndex] === "U") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "U"  && lastMoves[lastMoves.length - 2].move === "D'" && userAlg[currentMoveIndex + 1] === "D'" && userAlg[currentMoveIndex] === "U") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "U'" && lastMoves[lastMoves.length - 2].move === "D'" && userAlg[currentMoveIndex + 1] === "D'" && userAlg[currentMoveIndex] === "U'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "U'" && lastMoves[lastMoves.length - 2].move === "D"  && userAlg[currentMoveIndex + 1] === "D"  && userAlg[currentMoveIndex] === "U'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "D"  && lastMoves[lastMoves.length - 2].move === "U"  && userAlg[currentMoveIndex + 1] === "U"  && userAlg[currentMoveIndex] === "D") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "D"  && lastMoves[lastMoves.length - 2].move === "U'" && userAlg[currentMoveIndex + 1] === "U'" && userAlg[currentMoveIndex] === "D") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "D'" && lastMoves[lastMoves.length - 2].move === "U'" && userAlg[currentMoveIndex + 1] === "U'" && userAlg[currentMoveIndex] === "D'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "D'" && lastMoves[lastMoves.length - 2].move === "U"  && userAlg[currentMoveIndex + 1] === "U"  && userAlg[currentMoveIndex] === "D'") fixSlice();

        // fix F+B = B+F
        if (lastMoves[lastMoves.length - 1].move === "F"  && lastMoves[lastMoves.length - 2].move === "B"  && userAlg[currentMoveIndex + 1] === "B"  && userAlg[currentMoveIndex] === "F") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "F"  && lastMoves[lastMoves.length - 2].move === "B'" && userAlg[currentMoveIndex + 1] === "B'" && userAlg[currentMoveIndex] === "F") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "F'" && lastMoves[lastMoves.length - 2].move === "B'" && userAlg[currentMoveIndex + 1] === "B'" && userAlg[currentMoveIndex] === "F'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "F'" && lastMoves[lastMoves.length - 2].move === "B"  && userAlg[currentMoveIndex + 1] === "B"  && userAlg[currentMoveIndex] === "F'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "B"  && lastMoves[lastMoves.length - 2].move === "F"  && userAlg[currentMoveIndex + 1] === "F"  && userAlg[currentMoveIndex] === "B") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "B"  && lastMoves[lastMoves.length - 2].move === "F'" && userAlg[currentMoveIndex + 1] === "F'" && userAlg[currentMoveIndex] === "B") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "B'" && lastMoves[lastMoves.length - 2].move === "F'" && userAlg[currentMoveIndex + 1] === "F'" && userAlg[currentMoveIndex] === "B'") fixSlice();
        if (lastMoves[lastMoves.length - 1].move === "B'" && lastMoves[lastMoves.length - 2].move === "F"  && userAlg[currentMoveIndex + 1] === "F"  && userAlg[currentMoveIndex] === "B'") fixSlice();
      }

      if (currentMoveIndex > 0 && incorrectMoves.length === 1 && lastMoves[lastMoves.length - 1].move === getInverseMove(userAlg[currentMoveIndex -1])) { 
        currentMoveIndex--;
        incorrectMoves.pop();
        badAlg.pop();
        console.log("Cancelling last correct move");
      } else if (lastMoves[lastMoves.length - 1].move === getInverseMove(badAlg[badAlg.length -2])) { 
        incorrectMoves.pop();
        incorrectMoves.pop();
        badAlg.pop();
        badAlg.pop();
        console.log("Popping last incorrect move. incorrectMoves=" + incorrectMoves + " badAlg=" + badAlg);
      } else if (incorrectMoves.length > 3 && lastMoves.length > 3 && lastMoves[lastMoves.length - 1].move === lastMoves[lastMoves.length - 2].move && lastMoves[lastMoves.length - 2].move === lastMoves[lastMoves.length - 3].move && lastMoves[lastMoves.length - 3].move === lastMoves[lastMoves.length - 4].move ) {
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        badAlg.pop();
        incorrectMoves.pop();
        incorrectMoves.pop();
        incorrectMoves.pop();
        incorrectMoves.pop();
        console.log("Popping a turn (4 incorrect moves): " + incorrectMoves)

      }
    }
    console.log("-------- incorrectMoves: " + incorrectMoves)

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
      'S': 'S\'', 'S\'': 'S',
      'M': 'M\'', 'M\'': 'M',
      'E': 'E\'', 'E\'': 'E',
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
  } else {
    conn = await connectGanCube(customMacAddressProvider);
    conn.events$.subscribe(handleCubeEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
    $('#deviceName').val(conn.deviceName);
    $('#deviceMAC').val(conn.deviceMAC);
    $('#connect').html('Disconnect');
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

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  var facelets = patternToFacelets(kpattern);
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