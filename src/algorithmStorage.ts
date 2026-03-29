// ── Algorithm Storage ──────────────────────────────────────────────────
// Functions for saving, loading, importing, and exporting algorithms
// to/from localStorage. No state (S) or DOM ($) dependencies (except
// importAlgorithms which calls loadCategories for UI refresh).

import { expandNotation, algToId } from './notationHelper';

import defaultAlgsPLL from './defaultAlgs/defaultAlgs-pll.json';
import defaultAlgsOLL from './defaultAlgs/defaultAlgs-oll.json';
import defaultAlgs2LookPLL from './defaultAlgs/defaultAlgs-2-look-pll.json';
import defaultAlgs2LookOLL from './defaultAlgs/defaultAlgs-2-look-oll.json';
import defaultAlgsF2L from './defaultAlgs/defaultAlgs-f2l.json';
import defaultAlgsWVLS from './defaultAlgs/defaultAlgs-wvls.json';
import defaultAlgsCOLL from './defaultAlgs/defaultAlgs-coll.json';
import defaultAlgsOLLCP from './defaultAlgs/defaultAlgs-ollcp.json';
import defaultAlgsVHLS from './defaultAlgs/defaultAlgs-vhls.json';
import defaultAlgsZBLL from './defaultAlgs/defaultAlgs-zbll.json';
import defaultAlgsZBLS from './defaultAlgs/defaultAlgs-zbls.json';
import defaultAlgsCMLL from './defaultAlgs/defaultAlgs-cmll.json';
import defaultAlgsL6EEO from './defaultAlgs/defaultAlgs-l6e-eo.json';
import defaultAlgsL6EEOLR from './defaultAlgs/defaultAlgs-l6e-eolr.json';

const defaultAlgs: Record<string, any> = {
  "PLL": defaultAlgsPLL,
  "OLL": defaultAlgsOLL,
  "2-Look PLL": defaultAlgs2LookPLL,
  "2-Look OLL": defaultAlgs2LookOLL,
  "F2L": defaultAlgsF2L,
  "WVLS": defaultAlgsWVLS,
  "COLL": defaultAlgsCOLL,
  "OLLCP": defaultAlgsOLLCP,
  "VHLS": defaultAlgsVHLS,
  "ZBLL": defaultAlgsZBLL,
  "ZBLS": defaultAlgsZBLS,
  "CMLL": defaultAlgsCMLL,
  "L6E-EO": defaultAlgsL6EEO,
  "L6E-EOLR": defaultAlgsL6EEOLR,
};

/** Seeds localStorage with default algorithms from defaultAlgs.json on first launch. */
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

/** Saves an algorithm to localStorage under the given category/subset/name. */
export function saveAlgorithm(category: string, subset: string, name: string, algorithm: string, ignore?: string) {
  const savedAlgorithms = JSON.parse(localStorage.getItem('savedAlgorithms') || '{}');
  if (!savedAlgorithms[category]) {
    savedAlgorithms[category] = [];
  }
  const existingSubset = savedAlgorithms[category].find((s: { subset: string }) => s.subset === subset);
  if (existingSubset) {
    const existingAlgorithmIndex = existingSubset.algorithms.findIndex((alg: { name: string }) => alg.name === name);
    if (existingAlgorithmIndex !== -1) {
      // Replace the existing algorithm
      existingSubset.algorithms[existingAlgorithmIndex] = { name, algorithm, ...(ignore !== undefined ? { ignore } : {}) };
    } else {
      // Add a new algorithm
      existingSubset.algorithms.push({ name, algorithm, ...(ignore !== undefined ? { ignore } : {}) });
    }
  } else {
    // Add a new subset with the algorithm
    savedAlgorithms[category].push({
      subset,
      algorithms: [{ name, algorithm, ...(ignore !== undefined ? { ignore } : {}) }],
    });
  }
  localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
}

/** Deletes an algorithm from localStorage and removes associated timing/stats data. */
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
    localStorage.removeItem('Best-CD-' + algId);
    localStorage.removeItem('LastTimes-' + algId);
    localStorage.removeItem('LastTimes-CD-' + algId);
    localStorage.removeItem('FailedCount-' + algId);
    localStorage.removeItem('SuccessCount-' + algId);
    localStorage.removeItem('LastResults-' + algId);
    localStorage.removeItem('ConsecutiveCorrect-' + algId);
    localStorage.removeItem('Learned-' + algId);

    localStorage.setItem('savedAlgorithms', JSON.stringify(savedAlgorithms));
  }
}

/** Exports all saved algorithms to a downloadable JSON file. */
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

/** Imports algorithms from a user-selected JSON file into localStorage.
 *  Note: calls loadCategories() for UI refresh - that function uses $ (jQuery). */
export function importAlgorithms(file: File, loadCategoriesFn: () => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    if (event.target?.result) {
      try {
        const importedAlgs = JSON.parse(event.target.result as string);
        localStorage.setItem('savedAlgorithms', JSON.stringify(importedAlgs));
        loadCategoriesFn();
        alert('Algorithms imported successfully.');
      } catch (e) {
        alert('Failed to import algorithms. Please ensure the file is in the correct format.');
      }
    }
  };
  reader.readAsText(file);
}
