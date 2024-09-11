import { KPattern } from 'cubing/kpuzzle';
import $ from 'jquery';
import { Alg } from "cubing/alg";
import { faceletsToPattern } from "./utils";
import { fullStickeringEnabled } from "./index";

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
  if (!localStorage.getItem('savedAlgs')) {
    localStorage.setItem('savedAlgs', JSON.stringify(defaultAlgs));
  }
}

// Function to save the algorithm to localStorage
export function saveAlgorithm(category: string, name: string, algorithm: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  if (!savedAlgs[category]) {
    savedAlgs[category] = [];
  }
  savedAlgs[category].push({ name, algorithm });
  localStorage.setItem('savedAlgs', JSON.stringify(savedAlgs));
}

// Function to delete an algorithm from localStorage
export function deleteAlgorithm(category: string, algorithm: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  if (savedAlgs[category]) {
    savedAlgs[category] = savedAlgs[category].filter((alg: { name: string, algorithm: string }) => expandNotation(alg.algorithm) !== expandNotation(algorithm));
    if (savedAlgs[category].length === 0) {
      delete savedAlgs[category]; // Delete category if empty
    }
    localStorage.setItem('savedAlgs', JSON.stringify(savedAlgs));
  }
}
  
// Function to export algorithms to a text file
export function exportAlgorithms() {
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

// Function to import algorithms from a text file
export function importAlgorithms(file: File) {
  const reader = new FileReader();
  reader.onload = (event) => {
    if (event.target?.result) {
      try {
        const importedAlgs = JSON.parse(event.target.result as string);
        localStorage.setItem('savedAlgs', JSON.stringify(importedAlgs));
        alert('Algorithms imported successfully.');
        loadCategories();
      } catch (e) {
        alert('Failed to import algorithms. Please ensure the file is in the correct format.');
      }
    }
  };
  reader.readAsText(file);
}

// Function to load categories from localStorage
export function loadCategories() {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  const categorySelect = $('#category-select');
  categorySelect.empty();
  Object.keys(savedAlgs).forEach(category => {
    categorySelect.append(`<option value="${category}">${category}</option>`);
  });
  // for the first category, load the algorithms
  loadAlgorithms(Object.keys(savedAlgs)[0]);
}

export function setStickering(category: string): string {
    let twistyPlayer = document.querySelector('twisty-player');
    if (twistyPlayer && fullStickeringEnabled) {
        twistyPlayer.experimentalStickering = 'full';
        return 'full';
    }

    const validStickering = ['PLL', 'CLS', 'OLL', 'EOLL', 'COLL', 'OCLL', 'CPLL', 'CLL', 'EPLL', 'ELL', 'ELS', 'LL', 'F2L', 'ZBLL', 'ZBLS', 'VLS', 'WVLS', 'LS', 'LSOLL', 'LSOCLL', 'EO', 'EOline', 'EOcross', 'CMLL', 'L10P', 'L6E', 'L6EO', 'Daisy', 'Cross'];

    let matchedStickering: string | undefined;
    // Loop through validStickering to find a match
    for (const item of validStickering) {
      if (category.toLowerCase().includes(item.toLowerCase())) {
        matchedStickering = item;
        break;
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
 
// Function to load algorithms based on selected category
export function loadAlgorithms(category?: string) {
  const savedAlgs = JSON.parse(localStorage.getItem('savedAlgs') || '{}');
  const algCases = $('#alg-cases');
  algCases.empty();

  if (category) {
    if (savedAlgs[category]) {
      let matchedStickering = setStickering(category);
      let visualization = "3D";
      if (category.toLowerCase().includes("ll")) visualization = "experimental-2D-LL";
      let i = 0;
      savedAlgs[category].forEach((alg: { name: string, algorithm: string }) => {
        alg.algorithm = expandNotation(alg.algorithm);
        // if the colors are changed, match them in showMistakesWithDelay()
        let gray = i % 2 == 0 ? "bg-gray-400" : "bg-gray-50";
        let grayDarkMode = i % 2 == 0 ? "bg-gray-800" : "bg-gray-600";
        algCases.append(`
          <div class="case-wrapper rounded-lg shadow-md ${gray} dark:${grayDarkMode} relative p-4" id="${algToId(alg.algorithm)}" data-name="${alg.name}" data-algorithm="${alg.algorithm}" data-category="${category}">
            <label for="case-toggle-${i}" class="cursor-pointer">
            <span class="text-black dark:text-white text-sm">${alg.name}</span>
            <div id="alg-case-${i}" class="flex items-center justify-center scale-50 -mx-20 -mt-10 -mb-10 relative z-10">
              <twisty-player puzzle="3x3x3" visualization="${visualization}" experimental-stickering="${matchedStickering}" alg="${alg.algorithm}" experimental-setup-anchor="end" control-panel="none" hint-facelets="none" experimental-drag-input="none" background="none"></twisty-player>
            </div>
            <div class="grid grid-cols-2 mt-1 relative z-10">
                <input type="checkbox" id="case-toggle-${i}" class="sr-only" data-algorithm="${alg.algorithm}" data-name="${alg.name}" />
                <div class="w-11 h-6 bg-gray-200 rounded-full shadow-inner"></div>
                <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out"></div>
                <div class="absolute right-0 grid grid-cols-2 gap-1">
                  <div id="${algToId(alg.algorithm)}-failed" class="col-start-1 text-red-600 font-bold text-sm"></div>
                  <div id="${algToId(alg.algorithm)}-success" class="col-start-2 text-green-600 font-bold text-sm"></div>
                </div>
            </div>
            </label>
          </div>
        `);
        i++;
      });
    }
  }
}

export function algToId(alg: string): string {
  let id = alg.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(]/g, 'o').replace(/[)]/g, 'c');
  if (id.length == 0) {
    id = "default-alg-id";
  }
  return id;
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