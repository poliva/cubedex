import {
  BACKUP_FORMAT_VERSION,
  type CubedexBackupFile,
  type ScopedStatsRecord,
  type SolveHistoryEntry,
  getMetaValue,
  loadAllStatsFromDb,
  loadSavedAlgorithmsFromDb,
  openCubedexDatabase,
  replaceLibraryAndStatsInDb,
  saveStatsRecordToDb,
  deleteStatsRecordsFromDb,
} from './idb-storage';
import { type CaseReviewEntry, type CaseSrsState, normalizeReviewHistory, normalizeSrsState } from './srs';

export interface SavedAlgorithm {
  name: string;
  algorithm: string;
}

export interface SavedSubset {
  subset: string;
  algorithms: SavedAlgorithm[];
}

export type SavedAlgorithms = Record<string, SavedSubset[]>;

export const STORAGE_KEYS = {
  savedAlgorithms: 'savedAlgorithms',
  savedAlgorithmsV1: 'savedAlgs',
  visualization: 'visualization',
  hintFacelets: 'hintFacelets',
  fullStickering: 'fullStickering',
  whiteOnBottom: 'whiteOnBottom',
  backview: 'backview',
  gyroscope: 'gyroscope',
  controlPanel: 'control-panel',
  flashingIndicatorEnabled: 'flashingIndicatorEnabled',
  showAlgName: 'showAlgName',
  countdownMode: 'countdownMode',
  alwaysScrambleTo: 'alwaysScrambleTo',
  cubeSizePx: 'cubeSizePx',
  theme: 'theme',
  smartcubeDeviceSelection: 'smartcubeDeviceSelection',
  autoUpdateLearningState: 'autoUpdateLearningState',
} as const;

export const DEFAULT_ALG_ID = 'default-alg-id';
export const CASE_SCOPE_PREFIX = 'case:';
export const GLOBAL_SCOPE_PREFIX = 'global:';
export const TIME_ATTACK_SCOPE_PREFIX = 'time-attack:';

export interface TimeAttackRunRecord {
  wallMs: number;
  caseTimes: number[];
}

function cloneSolveHistoryEntry(entry: SolveHistoryEntry): SolveHistoryEntry {
  return {
    executionMs: entry.executionMs,
    recognitionMs: entry.recognitionMs,
    totalMs: entry.totalMs,
  };
}

function createSolveHistoryEntry(executionMs: number, recognitionMs: number | null = null, totalMs?: number): SolveHistoryEntry {
  const normalizedExecution = Number(executionMs);
  const normalizedRecognition = recognitionMs == null || !Number.isFinite(Number(recognitionMs))
    ? null
    : Number(recognitionMs);
  const normalizedTotal = Number.isFinite(Number(totalMs))
    ? Number(totalMs)
    : normalizedExecution + (normalizedRecognition ?? 0);

  return {
    executionMs: normalizedExecution,
    recognitionMs: normalizedRecognition,
    totalMs: normalizedTotal,
  };
}

function normalizeSolveHistory(entries: unknown, legacyLastTimes: number[]): SolveHistoryEntry[] {
  if (Array.isArray(entries)) {
    return entries
      .map((entry) => {
        const executionMs = Number((entry as SolveHistoryEntry | undefined)?.executionMs);
        if (!Number.isFinite(executionMs)) {
          return null;
        }

        const recognitionRaw = (entry as SolveHistoryEntry | undefined)?.recognitionMs;
        const recognitionMs = recognitionRaw == null || !Number.isFinite(Number(recognitionRaw))
          ? null
          : Number(recognitionRaw);
        const totalRaw = (entry as SolveHistoryEntry | undefined)?.totalMs;
        const totalMs = Number.isFinite(Number(totalRaw))
          ? Number(totalRaw)
          : executionMs + (recognitionMs ?? 0);

        return createSolveHistoryEntry(executionMs, recognitionMs, totalMs);
      })
      .filter((entry): entry is SolveHistoryEntry => entry != null);
  }

  return legacyLastTimes.map((time) => createSolveHistoryEntry(time));
}

const LS_MIGRATION_DONE_KEY = 'lsMigrationDone';
const LS_MIGRATION_DONE_AT_KEY = 'lsMigrationDoneAt';

let savedAlgorithmsCache: SavedAlgorithms = {};
let statsCache = new Map<string, ScopedStatsRecord>();
let storageReady = false;
let initializePromise: Promise<{ migratedSavedAlgorithmsV1: boolean; alertMessage: string | null }> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function expandNotation(input: string): string {
  let output = input
    .replace(/["´`'\u2018\u2019]/g, "'")
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
  return alg?.trim().replace(/\s+/g, '-').replace(/[']/g, 'p').replace(/[(/]/g, 'o').replace(/[)]/g, 'c');
}

export function getAlgorithmId(algorithm: string) {
  return algToId(expandNotation(algorithm)) || DEFAULT_ALG_ID;
}

export function createAlgStorageKey(prefix: 'Best' | 'LastTimes' | 'Learned', algId: string) {
  return `${prefix}-${algId}`;
}

function cloneSavedAlgorithms(savedAlgorithms: SavedAlgorithms): SavedAlgorithms {
  return Object.fromEntries(
    Object.entries(savedAlgorithms).map(([category, subsets]) => [
      category,
      subsets.map((subset) => ({
        subset: subset.subset,
        algorithms: subset.algorithms.map((algorithm) => ({ ...algorithm })),
      })),
    ]),
  );
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

export function createScopeId(category: string, subset: string, algId: string) {
  return `${CASE_SCOPE_PREFIX}${encodeURIComponent(category)}:${encodeURIComponent(subset)}:${algId || DEFAULT_ALG_ID}`;
}

export function createGlobalScopeId(algorithm: string) {
  return `${GLOBAL_SCOPE_PREFIX}${getAlgorithmId(algorithm)}`;
}

export function createTimeAttackScopeId(category: string, selectedCaseIds: string[]) {
  const selectionKey = [...new Set(selectedCaseIds)]
    .sort()
    .join('|');
  return `${TIME_ATTACK_SCOPE_PREFIX}${encodeURIComponent(category)}:${encodeURIComponent(selectionKey)}`;
}

export function isTimeAttackScopeId(scopeId: string) {
  return scopeId.startsWith(TIME_ATTACK_SCOPE_PREFIX);
}

export function isPersistentStatsScopeId(scopeId: string) {
  const parsed = parseScopeId(scopeId);
  return parsed.kind === 'global' || parsed.kind === 'time-attack';
}

function parseScopeId(scopeId: string) {
  if (scopeId.startsWith(CASE_SCOPE_PREFIX)) {
    const withoutPrefix = scopeId.slice(CASE_SCOPE_PREFIX.length);
    const [encodedCategory = '', encodedSubset = '', algId = DEFAULT_ALG_ID] = withoutPrefix.split(':');
    return {
      kind: 'case' as const,
      category: decodeURIComponent(encodedCategory),
      subset: decodeURIComponent(encodedSubset),
      algId: algId || DEFAULT_ALG_ID,
    };
  }

  if (scopeId.startsWith(GLOBAL_SCOPE_PREFIX)) {
    return {
      kind: 'global' as const,
      category: '',
      subset: '',
      algId: scopeId.slice(GLOBAL_SCOPE_PREFIX.length) || DEFAULT_ALG_ID,
    };
  }

  if (scopeId.startsWith(TIME_ATTACK_SCOPE_PREFIX)) {
    const withoutPrefix = scopeId.slice(TIME_ATTACK_SCOPE_PREFIX.length);
    const [encodedCategory = '', encodedSelection = ''] = withoutPrefix.split(':');
    return {
      kind: 'time-attack' as const,
      category: decodeURIComponent(encodedCategory),
      subset: decodeURIComponent(encodedSelection),
      algId: scopeId,
    };
  }

  return {
    kind: 'legacy' as const,
    category: '',
    subset: '',
    algId: scopeId || DEFAULT_ALG_ID,
  };
}

function createEmptyStatsRecord(scopeId: string): ScopedStatsRecord {
  const parsed = parseScopeId(scopeId);
  return {
    scopeId,
    category: parsed.category,
    subset: parsed.subset,
    algId: parsed.algId,
    lastTimes: [],
    solveHistory: [],
    reviewHistory: [],
    srs: null,
    timeAttackLastRuns: [],
    best: null,
    learned: 0,
  };
}

function normalizeStatsRecord(record: ScopedStatsRecord): ScopedStatsRecord {
  const parsed = parseScopeId(record.scopeId);
  const legacyLastTimes = Array.isArray(record.lastTimes)
    ? record.lastTimes.map((value) => Number(value)).filter(Number.isFinite)
    : [];
  const solveHistory = normalizeSolveHistory(record.solveHistory, legacyLastTimes);
  const reviewHistory = normalizeReviewHistory(record.reviewHistory);
  const srs = normalizeSrsState(record.srs);
  const lastTimes = solveHistory.map((entry) => entry.executionMs);
  const timeAttackLastRuns = Array.isArray(record.timeAttackLastRuns)
    ? record.timeAttackLastRuns
      .map((run) => ({
        wallMs: Number(run?.wallMs),
        caseTimes: Array.isArray(run?.caseTimes)
          ? run.caseTimes.map((value) => Number(value)).filter(Number.isFinite)
          : [],
      }))
      .filter((run) => Number.isFinite(run.wallMs))
    : [];
  const best = record.best == null || !Number.isFinite(Number(record.best)) ? null : Number(record.best);
  const learned = Number.isFinite(Number(record.learned)) ? Number(record.learned) : 0;

  return {
    scopeId: record.scopeId,
    category: record.category || parsed.category,
    subset: record.subset || parsed.subset,
    algId: record.algId || parsed.algId,
    lastTimes,
    solveHistory,
    reviewHistory,
    srs,
    timeAttackLastRuns,
    best,
    learned,
  };
}

function getStatsRecord(scopeId: string) {
  return statsCache.get(scopeId) ?? createEmptyStatsRecord(scopeId);
}

function setStatsRecord(scopeId: string, record: ScopedStatsRecord) {
  statsCache.set(scopeId, normalizeStatsRecord(record));
}

function snapshotStatsRecords() {
  return Array.from(statsCache.values()).map((record) => normalizeStatsRecord(record));
}

function loadStatsCache(statsRecords: ScopedStatsRecord[]) {
  statsCache = new Map(statsRecords.map((record) => [record.scopeId, normalizeStatsRecord(record)]));
}

function enqueueWrite(task: () => Promise<void>) {
  const nextTask = writeQueue.then(task, task);
  writeQueue = nextTask.catch(() => undefined);
  return nextTask;
}

async function ensureStorageReady() {
  if (initializePromise) {
    await initializePromise;
  }

  if (!storageReady) {
    throw new Error('Storage has not been initialized');
  }
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getLegacyStatsKeyInfo(key: string) {
  if (key.startsWith('Best-')) {
    return { prefix: 'Best' as const, algId: key.slice('Best-'.length) };
  }
  if (key.startsWith('LastTimes-')) {
    return { prefix: 'LastTimes' as const, algId: key.slice('LastTimes-'.length) };
  }
  if (key.startsWith('Learned-')) {
    return { prefix: 'Learned' as const, algId: key.slice('Learned-'.length) };
  }
  return null;
}

function removeLegacyStorageKeys() {
  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    if (
      key === STORAGE_KEYS.savedAlgorithms
      || key === STORAGE_KEYS.savedAlgorithmsV1
      || key.startsWith('Best-')
      || key.startsWith('LastTimes-')
      || key.startsWith('Learned-')
    ) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    window.localStorage.removeItem(key);
  }
}

function buildScopeIdsFromLibrary(savedAlgorithms: SavedAlgorithms) {
  const scopeIds = new Set<string>();

  for (const [category, subsets] of Object.entries(savedAlgorithms)) {
    for (const subset of subsets) {
      for (const algorithm of subset.algorithms) {
        scopeIds.add(createScopeId(category, subset.subset, getAlgorithmId(algorithm.algorithm)));
      }
    }
  }

  return scopeIds;
}

function pruneOrphanStatsRecords(savedAlgorithms: SavedAlgorithms) {
  const validScopeIds = buildScopeIdsFromLibrary(savedAlgorithms);
  const deletedScopeIds: string[] = [];

  for (const scopeId of Array.from(statsCache.keys())) {
    if (isPersistentStatsScopeId(scopeId)) {
      continue;
    }

    if (!validScopeIds.has(scopeId)) {
      statsCache.delete(scopeId);
      deletedScopeIds.push(scopeId);
    }
  }

  return deletedScopeIds;
}

function buildLegacySavedAlgorithms(defaultAlgs: SavedAlgorithms) {
  let savedAlgorithms = readJsonStorage<SavedAlgorithms>(STORAGE_KEYS.savedAlgorithms, {});
  let migratedSavedAlgorithmsV1 = false;
  let alertMessage: string | null = null;

  if (!window.localStorage.getItem(STORAGE_KEYS.savedAlgorithms)) {
    savedAlgorithms = cloneSavedAlgorithms(defaultAlgs);
  } else {
    savedAlgorithms = cloneSavedAlgorithms(savedAlgorithms);
    for (const category of Object.keys(defaultAlgs)) {
      if (!savedAlgorithms[category]) {
        savedAlgorithms[category] = cloneSavedAlgorithms({ [category]: defaultAlgs[category] })[category];
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
        zbls1Algorithm
        && zbls9Algorithm
        && zbls1Algorithm.algorithm === zbls9Algorithm.algorithm
      ) {
        savedAlgorithms.ZBLS = cloneSavedAlgorithms({ ZBLS: defaultAlgs.ZBLS }).ZBLS;
      }
    }
  }

  if (window.localStorage.getItem(STORAGE_KEYS.savedAlgorithmsV1)) {
    const savedAlgorithmsV1 = readJsonStorage<Record<string, SavedAlgorithm[]>>(
      STORAGE_KEYS.savedAlgorithmsV1,
      {},
    );

    for (const category of Object.keys(savedAlgorithmsV1)) {
      savedAlgorithms[`old-${category}`] = [{ subset: 'All', algorithms: savedAlgorithmsV1[category] }];
    }

    migratedSavedAlgorithmsV1 = true;
    alertMessage =
      'Algorithms have been migrated to a new format that includes subsets.\nYour old categories which did not include subsets have been prefixed with "old-".';
  }

  return {
    migratedSavedAlgorithmsV1,
    alertMessage,
    savedAlgorithms,
  };
}

function buildMigratedStatsRecords(savedAlgorithms: SavedAlgorithms) {
  const legacyLastTimes = new Map<string, number[]>();
  const legacyBestTimes = new Map<string, number | null>();
  const legacyLearned = new Map<string, number>();

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    const info = getLegacyStatsKeyInfo(key);
    if (!info) {
      continue;
    }

    const rawValue = window.localStorage.getItem(key);
    if (info.prefix === 'LastTimes') {
      const times = rawValue
        ? rawValue.split(',').map((part) => Number(part.trim())).filter(Number.isFinite)
        : [];
      legacyLastTimes.set(info.algId, times);
    } else if (info.prefix === 'Best') {
      const best = rawValue == null || rawValue === '' ? null : Number(rawValue);
      legacyBestTimes.set(info.algId, best != null && Number.isFinite(best) ? best : null);
    } else if (info.prefix === 'Learned') {
      const learned = rawValue == null || rawValue === '' ? 0 : Number(rawValue);
      legacyLearned.set(info.algId, Number.isFinite(learned) ? learned : 0);
    }
  }

  const records: ScopedStatsRecord[] = [];
  for (const [category, subsets] of Object.entries(savedAlgorithms)) {
    for (const subset of subsets) {
      for (const algorithm of subset.algorithms) {
        const algId = getAlgorithmId(algorithm.algorithm);
        const scopeId = createScopeId(category, subset.subset, algId);
        records.push({
          scopeId,
          category,
          subset: subset.subset,
          algId,
          lastTimes: [...(legacyLastTimes.get(algId) ?? [])],
          solveHistory: [...(legacyLastTimes.get(algId) ?? [])].map((time) => createSolveHistoryEntry(time)),
          best: legacyBestTimes.get(algId) ?? null,
          learned: legacyLearned.get(algId) ?? 0,
        });
      }
    }
  }

  return records;
}

export function migrateLastFiveTimesToLastTimes() {
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith('LastFiveTimes-')) {
      const nextKey = key.replace('LastFiveTimes-', 'LastTimes-');
      window.localStorage.setItem(nextKey, window.localStorage.getItem(key) ?? '');
      window.localStorage.removeItem(key);
    }
  }
}

export async function initializeDefaultAlgorithms(defaultAlgs: SavedAlgorithms) {
  if (!initializePromise) {
    initializePromise = (async () => {
      const database = await openCubedexDatabase();
      const migrated = await getMetaValue<boolean>(database, LS_MIGRATION_DONE_KEY);

      if (!migrated) {
        migrateLastFiveTimesToLastTimes();
        const legacyState = buildLegacySavedAlgorithms(defaultAlgs);
        const nextSavedAlgorithms = cloneSavedAlgorithms(legacyState.savedAlgorithms);
        const nextStats = buildMigratedStatsRecords(nextSavedAlgorithms);

        savedAlgorithmsCache = nextSavedAlgorithms;
        loadStatsCache(nextStats);

        await replaceLibraryAndStatsInDb(database, nextSavedAlgorithms, nextStats, [
          { key: LS_MIGRATION_DONE_KEY, value: true },
          { key: LS_MIGRATION_DONE_AT_KEY, value: new Date().toISOString() },
        ]);

        removeLegacyStorageKeys();
        storageReady = true;

        return {
          migratedSavedAlgorithmsV1: legacyState.migratedSavedAlgorithmsV1,
          alertMessage: legacyState.alertMessage,
        };
      }

      const savedAlgorithmsFromDb = await loadSavedAlgorithmsFromDb(database);
      savedAlgorithmsCache = cloneSavedAlgorithms(savedAlgorithmsFromDb ?? defaultAlgs);

      const statsRecords = await loadAllStatsFromDb(database);
      loadStatsCache(statsRecords);
      pruneOrphanStatsRecords(savedAlgorithmsCache);
      await replaceLibraryAndStatsInDb(database, savedAlgorithmsCache, snapshotStatsRecords());
      storageReady = true;

      return {
        migratedSavedAlgorithmsV1: false,
        alertMessage: null,
      };
    })();
  }

  return initializePromise;
}

export function getSavedAlgorithms(): SavedAlgorithms {
  return cloneSavedAlgorithms(savedAlgorithmsCache);
}

async function persistFullState() {
  await ensureStorageReady();
  const database = await openCubedexDatabase();
  await replaceLibraryAndStatsInDb(database, savedAlgorithmsCache, snapshotStatsRecords());
}

async function persistStatsRecord(scopeId: string) {
  await ensureStorageReady();
  const database = await openCubedexDatabase();
  const record = statsCache.get(scopeId);
  if (!record) {
    await deleteStatsRecordsFromDb(database, [scopeId]);
    return;
  }

  await saveStatsRecordToDb(database, record);
}

export async function setSavedAlgorithms(savedAlgorithms: SavedAlgorithms) {
  savedAlgorithmsCache = cloneSavedAlgorithms(savedAlgorithms);
  pruneOrphanStatsRecords(savedAlgorithmsCache);
  await enqueueWrite(async () => {
    await persistFullState();
  });
}

export async function saveAlgorithm(category: string, subset: string, name: string, algorithm: string) {
  await ensureStorageReady();

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

  savedAlgorithmsCache = savedAlgorithms;
  pruneOrphanStatsRecords(savedAlgorithmsCache);

  await enqueueWrite(async () => {
    await persistFullState();
  });
}

export async function deleteAlgorithm(category: string, algorithm: string) {
  await ensureStorageReady();

  const normalizedAlgorithm = expandNotation(algorithm);
  const normalizedAlgId = algToId(normalizedAlgorithm) || DEFAULT_ALG_ID;
  const savedAlgorithms = getSavedAlgorithms();

  if (!savedAlgorithms[category]) {
    return;
  }

  savedAlgorithms[category] = savedAlgorithms[category]
    .map((subset) => ({
      subset: subset.subset,
      algorithms: subset.algorithms.filter(
        (entry) => expandNotation(entry.algorithm) !== normalizedAlgorithm,
      ),
    }))
    .filter((subset) => subset.algorithms.length > 0);

  if (savedAlgorithms[category].length === 0) {
    delete savedAlgorithms[category];
  }

  for (const [scopeId, record] of Array.from(statsCache.entries())) {
    if (record.category === category && record.algId === normalizedAlgId) {
      statsCache.delete(scopeId);
    }
  }

  savedAlgorithmsCache = savedAlgorithms;
  pruneOrphanStatsRecords(savedAlgorithmsCache);

  await enqueueWrite(async () => {
    await persistFullState();
  });
}

export async function exportAlgorithms() {
  await ensureStorageReady();
  downloadJson('cubedex_algorithms.json', savedAlgorithmsCache);
}

function parseSavedAlgorithms(json: string) {
  return JSON.parse(json) as SavedAlgorithms;
}

export async function importAlgorithmsFromJson(json: string) {
  await ensureStorageReady();
  const importedAlgs = parseSavedAlgorithms(json);
  savedAlgorithmsCache = cloneSavedAlgorithms(importedAlgs);
  pruneOrphanStatsRecords(savedAlgorithmsCache);

  await enqueueWrite(async () => {
    await persistFullState();
  });

  return getSavedAlgorithms();
}

export async function exportBackup() {
  await ensureStorageReady();
  const backup: CubedexBackupFile = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    algorithms: cloneSavedAlgorithms(savedAlgorithmsCache),
    stats: snapshotStatsRecords(),
  };
  downloadJson('cubedex_backup.json', backup);
}

function parseBackup(json: string) {
  const backup = JSON.parse(json) as CubedexBackupFile;
  if (
    !Number.isFinite(Number(backup.backupFormatVersion))
    || backup.backupFormatVersion < 1
    || backup.backupFormatVersion > BACKUP_FORMAT_VERSION
  ) {
    throw new Error('Unsupported backup format version');
  }
  if (!backup.algorithms || !Array.isArray(backup.stats)) {
    throw new Error('Invalid backup format');
  }
  return backup;
}

export async function importBackupFromJson(json: string) {
  await ensureStorageReady();
  const backup = parseBackup(json);
  savedAlgorithmsCache = cloneSavedAlgorithms(backup.algorithms);
  loadStatsCache(backup.stats);
  pruneOrphanStatsRecords(savedAlgorithmsCache);

  await enqueueWrite(async () => {
    await persistFullState();
  });

  return {
    savedAlgorithms: getSavedAlgorithms(),
    stats: snapshotStatsRecords(),
  };
}

export function readOption(key: keyof typeof STORAGE_KEYS) {
  return window.localStorage.getItem(STORAGE_KEYS[key]);
}

export function writeOption(key: keyof typeof STORAGE_KEYS, value: string) {
  window.localStorage.setItem(STORAGE_KEYS[key], value);
}

export function getLastTimes(scopeId: string): number[] {
  return [...getStatsRecord(scopeId).lastTimes];
}

export function setLastTimes(scopeId: string, values: number[]) {
  const solveHistory = values
    .filter(Number.isFinite)
    .map((value) => createSolveHistoryEntry(value));
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    lastTimes: solveHistory.map((entry) => entry.executionMs),
    solveHistory,
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function getSolveHistory(scopeId: string): SolveHistoryEntry[] {
  return (getStatsRecord(scopeId).solveHistory ?? []).map(cloneSolveHistoryEntry);
}

export function setSolveHistory(scopeId: string, values: SolveHistoryEntry[]) {
  const solveHistory = normalizeSolveHistory(values, []);
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    lastTimes: solveHistory.map((entry) => entry.executionMs),
    solveHistory,
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function getReviewHistory(scopeId: string): CaseReviewEntry[] {
  return normalizeReviewHistory(getStatsRecord(scopeId).reviewHistory);
}

export function setReviewHistory(scopeId: string, values: CaseReviewEntry[]) {
  const reviewHistory = normalizeReviewHistory(values);
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    reviewHistory,
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function getSrsState(scopeId: string): CaseSrsState | null {
  return normalizeSrsState(getStatsRecord(scopeId).srs);
}

export function setSrsState(scopeId: string, value: CaseSrsState | null) {
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    srs: normalizeSrsState(value),
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function getBestTime(scopeId: string): number | null {
  return getStatsRecord(scopeId).best;
}

export function getTimeAttackLastRuns(scopeId: string): TimeAttackRunRecord[] {
  return getStatsRecord(scopeId).timeAttackLastRuns?.map((run) => ({
    wallMs: run.wallMs,
    caseTimes: [...run.caseTimes],
  })) ?? [];
}

export function setTimeAttackLastRuns(scopeId: string, values: TimeAttackRunRecord[]) {
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    timeAttackLastRuns: values.map((run) => ({
      wallMs: Number(run.wallMs),
      caseTimes: run.caseTimes.map((value) => Number(value)).filter(Number.isFinite),
    })).filter((run) => Number.isFinite(run.wallMs)),
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function setBestTime(scopeId: string, value: number) {
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    best: value,
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function getLearnedStatus(scopeId: string): number {
  return getStatsRecord(scopeId).learned;
}

export function setLearnedStatus(scopeId: string, value: number) {
  setStatsRecord(scopeId, {
    ...getStatsRecord(scopeId),
    learned: value,
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function removeAlgorithmStorage(scopeId: string) {
  statsCache.delete(scopeId);
  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}

export function removeAlgorithmTimesStorage(scopeId: string) {
  const record = getStatsRecord(scopeId);
  setStatsRecord(scopeId, {
    ...record,
    best: null,
    lastTimes: [],
    solveHistory: [],
    reviewHistory: [],
    srs: null,
    timeAttackLastRuns: [],
  });

  void enqueueWrite(async () => {
    await persistStatsRecord(scopeId);
  });
}
