import { KPattern } from 'cubing/kpuzzle';
import $ from 'jquery';
import { Alg } from "cubing/alg";
import { experimentalCountMovesETM } from "cubing/notation";
import { faceletsToPattern } from "./utils";
import { fullStickeringEnabled } from "./index";
import { makeTimeFromTimestamp } from 'gan-web-bluetooth';
import { Chart, registerables } from 'chart.js';

// Register the components needed for Chart.js
Chart.register(...registerables);

export function expandNotation(input: string): string {
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

export function fixOrientation(pattern: KPattern) {
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

export function getInverseMove(move: string): string {
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

export function getOppositeMove(move: string): string {
  const oppositeMoves: { [key: string]: string } = {
      'U': 'D', 'D': 'U',
      'U\'': 'D\'', 'D\'': 'U\'',
      'L': 'R', 'R': 'L',
      'L\'': 'R\'', 'R\'': 'L\'',
      'F': 'B', 'B': 'F',
      'F\'': 'B\'', 'B\'': 'F\''
  };
  return oppositeMoves[move] || move; // Return the move itself if not found
}


let wakeLock: WakeLockSentinel | null = null;

// Function to request a wake lock
export async function requestWakeLock() {
  try {
    // Check if wake lock is supported
    if ('wakeLock' in navigator) {
      // Request a screen wake lock
      wakeLock = await navigator.wakeLock.request('screen');
      //console.log('Wake lock is active');

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
export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      //console.log('Wake lock has been released');
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
export function initializeDefaultAlgorithms() {

  if (!localStorage.getItem('savedAlgorithms')) {
    localStorage.setItem('savedAlgorithms', JSON.stringify(defaultAlgs));
  } else {
    // make sure all categories in defaultAlgs are in savedAlgorithms
    const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
    for (const category of Object.keys(defaultAlgs)) {
      if (!savedAlgorithms[category]) {
        savedAlgorithms[category] = defaultAlgs[category as keyof typeof defaultAlgs];
      }
    }
    localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
  }

  // migrate old saved algorithms without subsets
  if (localStorage.getItem('savedAlgs')) {
    const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
    for (const category of Object.keys(savedAlgs)) {
      savedAlgs[category] = [{ subset: 'All', algorithms: savedAlgs[category] }];
    }
    // append to savedAlgorithms
    const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
    for (const category of Object.keys(savedAlgs)) {
      savedAlgorithms["old-" + category] = savedAlgs[category];
    }
    localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
    // remove old savedAlgs
    localStorage.removeItem('savedAlgs');
    alert('Algorithms have been migrated to a new format that includes subsets.\nYour old categories which did not include subsets have been prefixed with "old-".');
  }
}

// Function to save the algorithm to localStorage
export function saveAlgorithm(category: string, subset: string, name: string, algorithm: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  if (!savedAlgorithms[category]) {
    savedAlgorithms[category] = [];
  }
  const existingSubset = savedAlgorithms[category].find((s: { subset: string }) => s.subset === subset);
  if (existingSubset) {
    const existingAlgorithmIndex = existingSubset.algorithms.findIndex((alg: { name: string }) => alg.name === name);
    if (existingAlgorithmIndex !== -1) {
      // Replace the existing algorithm
      existingSubset.algorithms[existingAlgorithmIndex] = { name, algorithm };
    } else {
      // Add a new algorithm
      existingSubset.algorithms.push({ name, algorithm });
    }
  } else {
    // Add a new subset with the algorithm
    savedAlgorithms[category].push({
      subset,
      algorithms: [{ name, algorithm }],
    });
  }
  localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
}

// Function to delete an algorithm from localStorage
export function deleteAlgorithm(category: string, algorithm: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  if (savedAlgorithms[category]) {
    savedAlgorithms[category] = savedAlgorithms[category].map((subset: { subset: string, algorithms: { name: string, algorithm: string }[] }) => {
      return {
        subset: subset.subset,
        algorithms: subset.algorithms.filter((alg: { name: string, algorithm: string }) => expandNotation(alg.algorithm) !== expandNotation(algorithm)),
      };
    }).filter((subset: { subset: string, algorithms: { name: string, algorithm: string }[] }) => subset.algorithms.length > 0);
    // If the category is empty, delete it
    if (savedAlgorithms[category].length === 0) {
      delete savedAlgorithms[category];
    }
    const algId = algToId(algorithm);
    localStorage.removeItem('Best-' + algId);
    localStorage.removeItem('LastTimes-' + algId);
    localStorage.removeItem('Learned-' + algId);

    localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
  }
}
  
// Function to export algorithms to a text file
export function exportAlgorithms() {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const exportData = JSON.stringify(savedAlgorithms, null, 2);
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cubedex_algorithms.json';
  link.click();
  URL.revokeObjectURL(url);
}

// Function to import algorithms from a text file
export function importAlgorithms(file: File) {
  const reader = new FileReader();
  reader.onload = (event) => {
    if (event.target?.result) {
      try {
        const importedAlgs = JSON.parse(event.target.result as string);
        localStorage.setItem('savedAlgorithms', JSON.stringify(importedAlgs));
        loadCategories();
        alert('Algorithms imported successfully.');
      } catch (e) {
        alert('Failed to import algorithms. Please ensure the file is in the correct format.');
      }
    }
  };
  reader.readAsText(file);
}

// Function to load categories from localStorage
export function loadCategories() {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const categorySelect = $('#category-select');
  categorySelect.empty();
  Object.keys(savedAlgorithms).forEach(category => {
    categorySelect.append(`<option value="${category}">${category}</option>`);
  });

  // Load the subsets for the selected category
  const selectedCategory = categorySelect.val() as string;
  loadSubsets(selectedCategory);
}

export function setStickering(category: string): string {
    let twistyPlayer = document.querySelector('twisty-player');
    if (twistyPlayer && fullStickeringEnabled) {
        twistyPlayer.experimentalStickering = 'full';
        return 'full';
    }

    const validStickering = ['EOcross', 'LSOCLL', 'EOline', 'LSOLL', 'Daisy', 'Cross', 'ZBLS', 'ZBLL', 'WVLS', 'OCLL', 'L6EO', 'L10P', 'EPLL', 'EOLL', 'CPLL', 'COLL', 'CMLL', 'VLS', 'PLL', 'OLL', 'L6E', 'F2L', 'ELS', 'ELL', 'CLS', 'CLL', 'LS', 'LL', 'EO'];

    let matchedStickering: string | undefined;
    // Loop through validStickering to find a match
    let categoryWithoutSymbols = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    for (const item of validStickering) {
      if (categoryWithoutSymbols === item.toLowerCase()) {
        matchedStickering = item;
        break;
      }
    }
    if (!matchedStickering) {
      let categoryWords = category.toLowerCase().split(/[^a-zA-Z0-9]+/);
      for (const item of validStickering) {
        for (const word of categoryWords) {
          if (word === item.toLowerCase()) {
            matchedStickering = item;
            break;
          }
        }
        if (matchedStickering) {
          break;
        }
      }
    }

    // Set experimentalStickering if a match was found
    if (twistyPlayer) {
      if (matchedStickering) {
        twistyPlayer.experimentalStickering = matchedStickering;
      } else {
        matchedStickering = 'full';
        twistyPlayer.experimentalStickering = 'full';
      }
    }
    return matchedStickering || 'full';
}
 
// Function to load algorithms based on selected subset
export function loadSubsets(category: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const subsetCheckboxes = $('#subset-checkboxes-container');
  subsetCheckboxes.empty();
  if (savedAlgorithms[category]) {
    savedAlgorithms[category].forEach((subset: { subset: string }) => {
      subsetCheckboxes.append(`
        <label class="inline-flex items-center col-span-1 cursor-pointer">
          <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 cursor-pointer" name="${subset.subset}" value="${subset.subset}">
          <span class="ml-2">${subset.subset}</span>
        </label>
      `);
    });
  }
  // Load algorithms for all checked subsets
  loadAlgorithms(category);
}

export function loadAlgorithms(category: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  const algCases = $('#alg-cases');
  algCases.empty();

  if (category && savedAlgorithms[category]) {
    let matchedStickering = setStickering(category);
    let visualization = "3D";
    if (category.toLowerCase().includes("ll")) visualization = "experimental-2D-LL";

    // Get checked subsets
    const checkedSubsets = $('#subset-checkboxes input:checked').map(function() {
      return $(this).val();
    }).get() as string[];

    checkedSubsets.forEach((subset) => {
      const subsetData = savedAlgorithms[category].find((s: { subset: string }) => s.subset === subset);
      if (subsetData) {
        let i = 0;
        subsetData.algorithms.forEach((alg: { name: string, algorithm: string }) => {
          alg.algorithm = expandNotation(alg.algorithm);
          let algId = algToId(alg.algorithm);
          // if the colors are changed, match them in showMistakesWithDelay()
          let gray = i % 2 == 0 ? "bg-gray-400" : "bg-gray-50";
          let grayDarkMode = i % 2 == 0 ? "bg-gray-800" : "bg-gray-600";
          const bestTime = bestTimeNumber(algId)

          algCases.append(`
            <div class="case-wrapper rounded-lg shadow-md ${gray} dark:${grayDarkMode} relative p-4" id="${algId}" data-name="${alg.name}" data-algorithm="${alg.algorithm}" data-category="${category}" data-subset="${subset}">
              <div class="flex justify-between">
                <div class="text-left text-sm w-full" title="${alg.algorithm}">${alg.name}</div>
                <div class="text-right"><button id="bookmark-${algId}" data-value="${learnedStatus(algId)}" title="Learning status" class="block">${learnedSVG(learnedStatus(algId))}</button></div>
              </div>
              <label for="case-toggle-${algId}" class="cursor-pointer" title="${alg.algorithm}">
              <div id="best-time-${algId}" class="col-span-1 font-mono text-gray-900 dark:text-white text-xs">Best: ${bestTimeString(bestTime)}</div>
              <div id="ao5-time-${algId}" class="col-span-1 font-mono text-gray-900 dark:text-white text-xs">Ao5: ${averageTimeString(averageTimeNumber(algId))}</div>
              <div id="alg-case-${algId}" class="flex items-center justify-center scale-50 -mx-20 -mt-10 -mb-10 relative z-10">
                <twisty-player puzzle="3x3x3" visualization="${visualization}" experimental-stickering="${matchedStickering}" alg="${alg.algorithm}" experimental-setup-anchor="end" control-panel="none" hint-facelets="none" experimental-drag-input="none" background="none"></twisty-player>
              </div>
              <div class="grid grid-cols-2 mt-1 relative z-10">
                  <input type="checkbox" id="case-toggle-${algId}" class="sr-only" data-algorithm="${alg.algorithm}" data-name="${alg.name}" data-best="${bestTime}" />
                  <div class="w-11 h-6 bg-gray-200 rounded-full shadow-inner"></div>
                  <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out"></div>
                  <div class="absolute right-0 grid grid-cols-2 gap-1">
                    <div id="${algId}-failed" class="col-start-1 text-red-600 font-bold text-sm"></div>
                    <div id="${algId}-success" class="col-start-2 text-green-600 font-bold text-sm"></div>
                  </div>
              </div>
              </label>
            </div>
          `);
          i++;
        });
      }
    });
  }
}

// Add an event listener for the bookmark button
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('button[id^="bookmark-"]')) {
    const button = target.closest('button') as HTMLButtonElement;
    const algId = button.id.replace('bookmark-', '');
    let currentStatus = learnedStatus(algId);
    // Cycle the status
    currentStatus = (currentStatus + 1) % 3;
    // Update the localStorage
    localStorage.setItem('Learned-' + algId, currentStatus.toString());
    // Update the button's SVG
    button.innerHTML = `${learnedSVG(currentStatus)}`;
  }
});

export function algToId(alg: string): string {
  let id = alg?.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(]/g, 'o').replace(/[)]/g, 'c');
  if (id == null || id.length == 0) {
    id = "default-alg-id";
  }
  return id;
}

function learnedSVG(status: number): string {
  const notLearnedSVG = `<svg fill="none" class="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 7.5L14.5 12.5M14.5 7.5L9.5 12.5M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const learnedSVG = `<svg fill="green" class="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 10.5L11 12.5L15.5 8M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const learningSVG = `<svg fill="orange" class="h-6 w-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 13V7M9 10H15M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (status === 1) {
      return learningSVG;
  } else if (status === 2) {
      return learnedSVG;
  } else {
      return notLearnedSVG;
  }
}

export function learnedStatus(algId: string): number {
  const learnedStatus = localStorage.getItem('Learned-' + algId);
  if (!learnedStatus) return 0;
  return Number(learnedStatus);
}

export function bestTimeNumber(algId: string): number | null {
  const bestTime = localStorage.getItem('Best-' + algId);
  if (!bestTime) return null;
  return Number(bestTime)
}

export function bestTimeString(time: number | null): string {
  if (!time) return '-';
  const best = makeTimeFromTimestamp(time)
  return `${best.seconds.toString(10)}.${best.milliseconds.toString(10).padStart(3, '0')}`;
}

export function averageTimeNumber(algId: string): number | null {
  const lastTimesStorage = localStorage.getItem(`LastTimes-${algId}`);
  if (!lastTimesStorage) return null;
  const lastTimes = lastTimesStorage.split(',').slice(-5).map(num => Number(num.trim()));
  return lastTimes.length == 5 ? lastTimes.reduce((sum: number, time: number) => sum + time, 0) / 5 : null;
}

export function averageTimeString(time: number | null): string {
  if (!time) return '-';
  const avg = makeTimeFromTimestamp(time);
  return `${avg.seconds.toString(10)}.${avg.milliseconds.toString(10).padStart(3, '0')}`;
}

function arraysEqual(arr1: number[], arr2: number[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

export function isSymmetricOLL(alg: string): boolean {
  const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
  let pattern = faceletsToPattern(SOLVED_STATE);

  let algWithStartU = Alg.fromString("U " + alg);
  let algWithStartUp = Alg.fromString("U' " + alg);
  let algWithStartU2 = Alg.fromString("U2 " + alg);
  const algs = [algWithStartU, algWithStartUp, algWithStartU2];

  let scramble = pattern.applyAlg(Alg.fromString(alg).invert());
  // Loop over the algorithms
  for (const item of algs) {
    const edgesOriented = arraysEqual(scramble.applyAlg(item).patternData.EDGES.orientation, [0,0,0,0,0,0,0,0,0,0,0,0]);
    const cornersOriented = arraysEqual(scramble.applyAlg(item).patternData.CORNERS.orientation, [0,0,0,0,0,0,0,0]);
    const centersOriented = arraysEqual(scramble.applyAlg(item).patternData.CENTERS.orientation, [0,0,0,0,0,0]);
    if (edgesOriented && cornersOriented && centersOriented) {
      //console.log("alg " + alg + " IS ORIENTED!!!! -> "+ JSON.stringify(scramble.applyAlg(item).patternData));
      return true;
    }
  }
  return false;
}

// Store the chart instance
let myTimeChart: Chart | null = null;
let myStatsChart: Chart | null = null;

// Function to create the graph
export function createTimeGraph(times: number[]) {
  const ctx = document.getElementById('timeGraph') as HTMLCanvasElement;

  // If a chart instance already exists, destroy it
  if (myTimeChart) {
    myTimeChart.destroy();
  }

  if (ctx) {
      const minTime = Math.min(...times);
      const backgroundColors = times.map((time: number) =>
          time === minTime ? 'rgba(75, 192, 192, 0.2)' : 'rgba(54, 162, 235, 0.2)'
      );
      const borderColors = times.map((time: number) =>
          time === minTime ? 'rgba(75, 192, 192, 1)' : 'rgba(54, 162, 235, 1)'
      );
      const timesInSeconds = times.map((time: number) => time / 1000);

      myTimeChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: times.map((_, index) => `${index + 1}`),
              datasets: [
                  {
                      label: 'Seconds',
                      data: timesInSeconds,
                      backgroundColor: backgroundColors,
                      borderColor: borderColors,
                      borderWidth: 1,
                  },
              ],
          },
          options: {
            responsive: true,
            animation: false,
            maintainAspectRatio: true,
            aspectRatio: 1, // Ensures the canvas is square
            plugins: {
              legend: {
                display: false, // Disable the legend
              },
              title: {
                display: false, // Disable the title
              },
            },
              scales: {
                  y: {
                      beginAtZero: true,
                  },
              },
          },
      });
  }
}

// given an alg, count the Execution Turn Metric (ETM) number
export function countMovesETM(alg: string): number {
  return experimentalCountMovesETM(Alg.fromString(alg));
}

function toggleGraphTimesDisplay() {
  const timesDisplay = $('#times-display');
  const graphDisplay = $('#graph-display');

  if (timesDisplay.is(':visible')) {
    timesDisplay.hide();
    graphDisplay.css('display', 'flex').show();
    $('#toggle-display').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M11.75 6C7.89 6 4.75 9.14 4.75 13C4.75 16.86 7.89 20 11.75 20C15.61 20 18.75 16.86 18.75 13C18.75 9.14 15.61 6 11.75 6ZM11.75 18.5C8.72 18.5 6.25 16.03 6.25 13C6.25 9.97 8.72 7.5 11.75 7.5C14.78 7.5 17.25 9.97 17.25 13C17.25 16.03 14.78 18.5 11.75 18.5ZM8.5 4.75C8.5 4.34 8.84 4 9.25 4H14.25C14.66 4 15 4.34 15 4.75C15 5.16 14.66 5.5 14.25 5.5H9.25C8.84 5.5 8.5 5.16 8.5 4.75ZM12.5 10V13C12.5 13.41 12.16 13.75 11.75 13.75C11.34 13.75 11 13.41 11 13V10C11 9.59 11.34 9.25 11.75 9.25C12.16 9.25 12.5 9.59 12.5 10ZM19.04 8.27C18.89 8.42 18.7 8.49 18.51 8.49C18.32 8.49 18.13 8.42 17.98 8.27L16.48 6.77C16.19 6.48 16.19 6 16.48 5.71C16.77 5.42 17.25 5.42 17.54 5.71L19.04 7.21C19.33 7.5 19.33 7.98 19.04 8.27Z" fill="currentColor"/></svg>');
  } else {
    timesDisplay.show();
    graphDisplay.hide();
    $('#toggle-display').html('<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="-2 0 19 19"><path d="M13.55 15.256H1.45a.554.554 0 0 1-.553-.554V3.168a.554.554 0 1 1 1.108 0v10.98h11.544a.554.554 0 0 1 0 1.108zM3.121 13.02V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.785 0V3.507a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v9.513zm2.785 0V6.888a.476.476 0 0 1 .475-.475h.786a.476.476 0 0 1 .475.475v6.132zm2.786 0v-2.753a.476.476 0 0 1 .475-.475h.785a.476.476 0 0 1 .475.475v2.753z"/></svg>');
  }
}

$('#toggle-display').on('click', toggleGraphTimesDisplay);
$('#alg-name-display').on('click', toggleGraphTimesDisplay);

// Function to create the stats graph
export function createStatsGraph(times: number[]) {
  const ctx = document.getElementById('statsGraph') as HTMLCanvasElement;

  // If a chart instance already exists, destroy it
  if (myStatsChart) {
    myStatsChart.destroy();
  }

  if (ctx) {
    const timesInSeconds = times.map((time: number) => time / 1000);

    // Calculate averages
    const ao5 = calculateTrimmedAverage(timesInSeconds, 5, 3);
    const ao12 = calculateTrimmedAverage(timesInSeconds, 12, 10);

    myStatsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: times.map((_, index) => `${index + 1}`),
        datasets: [
          {
            label: 'Single',
            data: timesInSeconds,
            backgroundColor: 'rgba(54, 162, 235, 1)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            fill: {
              target: 'origin',
              above: 'rgba(54, 162, 235, 0.2)',
              below: 'rgba(54, 162, 235, 0.1)',
            }
          },
          {
            label: 'Ao5',
            data: ao5,
            backgroundColor: 'rgba(255, 159, 64, 1)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1,
            fill: false,
          },
          {
            label: 'Ao12',
            data: ao12,
            backgroundColor: 'rgba(75, 192, 192, 1)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
            fill: false,
          },
        ],
      },
      options: {
        elements: {
          point: {
            pointStyle: 'circle',
          },
        },
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.25,
        plugins: {
          legend: {
            display: true,
          },
          title: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }
}

// Helper function to calculate trimmed averages
function calculateTrimmedAverage(data: number[], windowSize: number, meanSize: number): (number | null)[] {
  const averages: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      averages.push(null); // Not enough data points to calculate the average
    } else {
      const window = data.slice(i - windowSize + 1, i + 1);
      const sortedWindow = [...window].sort((a, b) => a - b);
      const trimmedWindow = sortedWindow.slice(1, -1); // Remove the best and worst
      const average = trimmedWindow.reduce((sum, value) => sum + value, 0) / meanSize;
      averages.push(average);
    }
  }
  return averages;
}