export interface SavedAlgorithm {
  name: string;
  algorithm: string;
}

export interface SavedSubset {
  subset: string;
  algorithms: SavedAlgorithm[];
}

export type SavedAlgorithms = Record<string, SavedSubset[]>;

export const LEGACY_STORAGE_KEYS = {
  savedAlgorithms: 'savedAlgorithms',
  legacySavedAlgs: 'savedAlgs',
  visualization: 'visualization',
  hintFacelets: 'hintFacelets',
  fullStickering: 'fullStickering',
  whiteOnBottom: 'whiteOnBottom',
  backview: 'backview',
  gyroscope: 'gyroscope',
  controlPanel: 'control-panel',
  flashingIndicatorEnabled: 'flashingIndicatorEnabled',
  showAlgName: 'showAlgName',
  alwaysScrambleTo: 'alwaysScrambleTo',
  cubeSizePx: 'cubeSizePx',
  theme: 'theme',
  smartcubeDeviceSelection: 'smartcubeDeviceSelection',
} as const;

export function expandNotation(input: string): string {
  let output = input
    .replace(/["´`‘]/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/XYZ/g, 'xyz');

  output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');
  output = output.replace(/\(/g, ' (');
  output = output.replace(/\)(?!\s)/g, ') ');
  output = output.replace(/'(?![\s)])/g, "' ");
  output = output.replace(/2(?![\s')])/g, '2 ');
  output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');
  output = output.replace(/(\s)(?=2)/g, '');
  output = output.replace(/'2/g, "2'");
  output = output.replace(/\s+/g, ' ');

  return output.trim();
}

export function algToId(alg: string): string {
  return alg?.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(]/g, 'o').replace(/[)]/g, 'c');
}

export function createAlgStorageKey(prefix: 'Best' | 'LastTimes' | 'Learned', algId: string) {
  return `${prefix}-${algId}`;
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSavedAlgorithms(): SavedAlgorithms {
  return readJsonStorage<SavedAlgorithms>(LEGACY_STORAGE_KEYS.savedAlgorithms, {});
}

export function setSavedAlgorithms(savedAlgorithms: SavedAlgorithms) {
  writeJsonStorage(LEGACY_STORAGE_KEYS.savedAlgorithms, savedAlgorithms);
}

export function initializeDefaultAlgorithms(defaultAlgs: SavedAlgorithms) {
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith('LastFiveTimes-')) {
      const nextKey = key.replace('LastFiveTimes-', 'LastTimes-');
      window.localStorage.setItem(nextKey, window.localStorage.getItem(key) ?? '');
      window.localStorage.removeItem(key);
    }
  }

  if (!window.localStorage.getItem(LEGACY_STORAGE_KEYS.savedAlgorithms)) {
    setSavedAlgorithms(defaultAlgs);
  } else {
    const savedAlgorithms = getSavedAlgorithms();

    for (const category of Object.keys(defaultAlgs)) {
      if (!savedAlgorithms[category]) {
        savedAlgorithms[category] = defaultAlgs[category];
      }
    }

    if (savedAlgorithms.ZBLS) {
      const categoryAlgorithms = savedAlgorithms.ZBLS;
      const zbls1Algorithm = categoryAlgorithms
        .find((subset) => subset.subset === 'Case 1')
        ?.algorithms.find((algorithm) => algorithm.name === 'ZBLS-1');
      const zbls9Algorithm = categoryAlgorithms
        .find((subset) => subset.subset === 'Case 2')
        ?.algorithms.find((algorithm) => algorithm.name === 'ZBLS-9');

      if (
        zbls1Algorithm &&
        zbls9Algorithm &&
        zbls1Algorithm.algorithm === zbls9Algorithm.algorithm
      ) {
        savedAlgorithms.ZBLS = defaultAlgs.ZBLS;
      }
    }

    setSavedAlgorithms(savedAlgorithms);
  }

  if (window.localStorage.getItem(LEGACY_STORAGE_KEYS.legacySavedAlgs)) {
    const legacySavedAlgs = readJsonStorage<Record<string, SavedAlgorithm[]>>(
      LEGACY_STORAGE_KEYS.legacySavedAlgs,
      {},
    );

    for (const category of Object.keys(legacySavedAlgs)) {
      legacySavedAlgs[category] = [{ subset: 'All', algorithms: legacySavedAlgs[category] } as never];
    }

    const savedAlgorithms = getSavedAlgorithms();
    for (const category of Object.keys(legacySavedAlgs)) {
      savedAlgorithms[`old-${category}`] = legacySavedAlgs[category] as unknown as SavedSubset[];
    }

    setSavedAlgorithms(savedAlgorithms);
    window.localStorage.removeItem(LEGACY_STORAGE_KEYS.legacySavedAlgs);

    return {
      migratedLegacySavedAlgs: true,
      alertMessage:
        'Algorithms have been migrated to a new format that includes subsets.\nYour old categories which did not include subsets have been prefixed with "old-".',
    };
  }

  return {
    migratedLegacySavedAlgs: false,
    alertMessage: null,
  };
}

export function saveAlgorithm(category: string, subset: string, name: string, algorithm: string) {
  const savedAlgorithms = getSavedAlgorithms();

  if (!savedAlgorithms[category]) {
    savedAlgorithms[category] = [];
  }

  const existingSubset = savedAlgorithms[category].find((entry) => entry.subset === subset);
  if (existingSubset) {
    const existingAlgorithmIndex = existingSubset.algorithms.findIndex((entry) => entry.name === name);
    if (existingAlgorithmIndex !== -1) {
      existingSubset.algorithms[existingAlgorithmIndex] = { name, algorithm };
    } else {
      existingSubset.algorithms.push({ name, algorithm });
    }
  } else {
    savedAlgorithms[category].push({
      subset,
      algorithms: [{ name, algorithm }],
    });
  }

  setSavedAlgorithms(savedAlgorithms);
}

export function deleteAlgorithm(category: string, algorithm: string) {
  const savedAlgorithms = getSavedAlgorithms();

  if (!savedAlgorithms[category]) {
    return;
  }

  savedAlgorithms[category] = savedAlgorithms[category]
    .map((subset) => ({
      subset: subset.subset,
      algorithms: subset.algorithms.filter(
        (entry) => expandNotation(entry.algorithm) !== expandNotation(algorithm),
      ),
    }))
    .filter((subset) => subset.algorithms.length > 0);

  if (savedAlgorithms[category].length === 0) {
    delete savedAlgorithms[category];
  }

  removeAlgorithmStorage(algToId(algorithm));
  setSavedAlgorithms(savedAlgorithms);
}

export function exportAlgorithms() {
  const savedAlgorithms = getSavedAlgorithms();
  const exportData = JSON.stringify(savedAlgorithms, null, 2);
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cubedex_algorithms.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function importAlgorithmsFromJson(json: string) {
  const importedAlgs = JSON.parse(json) as SavedAlgorithms;
  setSavedAlgorithms(importedAlgs);
  return importedAlgs;
}

export function readOption(key: keyof typeof LEGACY_STORAGE_KEYS) {
  return window.localStorage.getItem(LEGACY_STORAGE_KEYS[key]);
}

export function writeOption(key: keyof typeof LEGACY_STORAGE_KEYS, value: string) {
  window.localStorage.setItem(LEGACY_STORAGE_KEYS[key], value);
}

export function getLastTimes(algId: string): number[] {
  const value = window.localStorage.getItem(createAlgStorageKey('LastTimes', algId));
  return value ? value.split(',').map((part) => Number(part.trim())).filter(Number.isFinite) : [];
}

export function setLastTimes(algId: string, values: number[]) {
  window.localStorage.setItem(createAlgStorageKey('LastTimes', algId), values.join(','));
}

export function getBestTime(algId: string): number | null {
  const value = window.localStorage.getItem(createAlgStorageKey('Best', algId));
  return value ? Number(value) : null;
}

export function setBestTime(algId: string, value: number) {
  window.localStorage.setItem(createAlgStorageKey('Best', algId), String(value));
}

export function getLearnedStatus(algId: string): number {
  const value = window.localStorage.getItem(createAlgStorageKey('Learned', algId));
  return value ? Number(value) : 0;
}

export function setLearnedStatus(algId: string, value: number) {
  window.localStorage.setItem(createAlgStorageKey('Learned', algId), String(value));
}

export function removeAlgorithmStorage(algId: string) {
  window.localStorage.removeItem(createAlgStorageKey('Best', algId));
  window.localStorage.removeItem(createAlgStorageKey('LastTimes', algId));
  window.localStorage.removeItem(createAlgStorageKey('Learned', algId));
}

export function removeAlgorithmTimesStorage(algId: string) {
  window.localStorage.removeItem(createAlgStorageKey('Best', algId));
  window.localStorage.removeItem(createAlgStorageKey('LastTimes', algId));
}
