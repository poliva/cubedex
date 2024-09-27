import { KPattern } from 'cubing/kpuzzle';
import $ from 'jquery';
import { Alg } from "cubing/alg";
import { faceletsToPattern } from "./utils";
import { fullStickeringEnabled } from "./index";
import { makeTimeFromTimestamp } from 'gan-web-bluetooth';

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
    existingSubset.algorithms.push({ name, algorithm });
  } else {
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
    localStorage.removeItem('LastFiveTimes-' + algId);

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
        <label class="inline-flex items-center col-span-1">
          <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600" value="${subset.subset}">
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
            <div class="case-wrapper rounded-lg shadow-md ${gray} dark:${grayDarkMode} relative p-4" id="${algId}" data-name="${alg.name}" data-algorithm="${alg.algorithm}" data-category="${category}">
              <label for="case-toggle-${algId}" class="cursor-pointer">
              <span class="text-black dark:text-white text-sm">${alg.name}</span>
              <div id="best-time-${algId}" class="col-span-1 font-mono text-gray-900 dark:text-white text-xs">${bestTimeString(bestTime)}</div>
              <div id="ao5-time-${algId}" class="col-span-1 font-mono text-gray-900 dark:text-white text-xs">${averageTimeString(averageTimeNumber(algId))}</div>
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

export function algToId(alg: string): string {
  let id = alg.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(]/g, 'o').replace(/[)]/g, 'c');
  if (id.length == 0) {
    id = "default-alg-id";
  }
  return id;
}

export function bestTimeNumber(algId: string): number | null {
  const bestTime = localStorage.getItem('Best-' + algId);
  if (!bestTime) return null;
  return Number(bestTime)
}

export function bestTimeString(time: number | null): string {
  if (!time) return 'Best: -';
  const best = makeTimeFromTimestamp(time)
  return `Best: ${best.seconds.toString(10).padStart(2, '0')}.${best.milliseconds.toString(10).padStart(3, '0')}`;
}

export function averageTimeNumber(algId: string): number | null {
  const lastFiveTimesStorage = localStorage.getItem(`LastFiveTimes-${algId}`);
  if (!lastFiveTimesStorage) return null;
  const lastFiveTimes = lastFiveTimesStorage.split(',').map(num => Number(num.trim()));
  return lastFiveTimes.length == 5 
    ? lastFiveTimes.reduce((sum, time) => sum + time, 0) / 5 
    : null;
}

export function averageTimeString(time: number | null): string {
  if (!time) return 'Ao5: -';
  const avg = makeTimeFromTimestamp(time);
  return `Ao5: ${avg.seconds.toString(10).padStart(2, '0')}.${avg.milliseconds.toString(10).padStart(3, '0')}`;
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