import type { SavedAlgorithms } from './storage';

export interface ScopedStatsRecord {
  scopeId: string;
  category: string;
  subset: string;
  algId: string;
  lastTimes: number[];
  timeAttackLastRuns?: {
    wallMs: number;
    caseTimes: number[];
  }[];
  best: number | null;
  learned: number;
}

export interface CubedexBackupFile {
  backupFormatVersion: number;
  exportedAt: string;
  algorithms: SavedAlgorithms;
  stats: ScopedStatsRecord[];
}

export const IDB_SCHEMA_VERSION = 1;
export const BACKUP_FORMAT_VERSION = 1;

const DB_NAME = 'cubedex';
const META_STORE = 'meta';
const LIBRARY_STORE = 'library';
const STATS_STORE = 'stats';

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

export function openCubedexDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, IDB_SCHEMA_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(LIBRARY_STORE)) {
        database.createObjectStore(LIBRARY_STORE, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(STATS_STORE)) {
        const statsStore = database.createObjectStore(STATS_STORE, { keyPath: 'scopeId' });
        statsStore.createIndex('category', 'category', { unique: false });
        statsStore.createIndex('algId', 'algId', { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB upgrade blocked by another tab'));
    };
  });

  return dbPromise;
}

export async function getMetaValue<T>(database: IDBDatabase, key: string) {
  const transaction = database.transaction(META_STORE, 'readonly');
  const store = transaction.objectStore(META_STORE);
  const result = await requestToPromise(store.get(key));
  await transactionDone(transaction);
  return (result as { key: string; value: T } | undefined)?.value;
}

export async function setMetaValues(database: IDBDatabase, values: Array<{ key: string; value: unknown }>) {
  const transaction = database.transaction(META_STORE, 'readwrite');
  const store = transaction.objectStore(META_STORE);
  for (const value of values) {
    store.put(value);
  }
  await transactionDone(transaction);
}

export async function loadSavedAlgorithmsFromDb(database: IDBDatabase) {
  const transaction = database.transaction(LIBRARY_STORE, 'readonly');
  const store = transaction.objectStore(LIBRARY_STORE);
  const result = await requestToPromise(store.get('savedAlgorithms'));
  await transactionDone(transaction);
  return (result as { key: string; value: SavedAlgorithms } | undefined)?.value ?? null;
}

export async function loadAllStatsFromDb(database: IDBDatabase) {
  const transaction = database.transaction(STATS_STORE, 'readonly');
  const store = transaction.objectStore(STATS_STORE);
  const result = await requestToPromise(store.getAll()) as ScopedStatsRecord[];
  await transactionDone(transaction);
  return result;
}

export async function replaceLibraryAndStatsInDb(
  database: IDBDatabase,
  savedAlgorithms: SavedAlgorithms,
  statsRecords: ScopedStatsRecord[],
  metaValues: Array<{ key: string; value: unknown }> = [],
) {
  const transaction = database.transaction([META_STORE, LIBRARY_STORE, STATS_STORE], 'readwrite');
  const metaStore = transaction.objectStore(META_STORE);
  const libraryStore = transaction.objectStore(LIBRARY_STORE);
  const statsStore = transaction.objectStore(STATS_STORE);

  libraryStore.put({ key: 'savedAlgorithms', value: savedAlgorithms });
  statsStore.clear();
  for (const record of statsRecords) {
    statsStore.put(record);
  }
  for (const metaValue of metaValues) {
    metaStore.put(metaValue);
  }

  await transactionDone(transaction);
}

export async function saveLibraryToDb(database: IDBDatabase, savedAlgorithms: SavedAlgorithms) {
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite');
  transaction.objectStore(LIBRARY_STORE).put({ key: 'savedAlgorithms', value: savedAlgorithms });
  await transactionDone(transaction);
}

export async function replaceStatsInDb(database: IDBDatabase, statsRecords: ScopedStatsRecord[]) {
  const transaction = database.transaction(STATS_STORE, 'readwrite');
  const store = transaction.objectStore(STATS_STORE);
  store.clear();
  for (const record of statsRecords) {
    store.put(record);
  }
  await transactionDone(transaction);
}

export async function saveStatsRecordToDb(database: IDBDatabase, record: ScopedStatsRecord) {
  const transaction = database.transaction(STATS_STORE, 'readwrite');
  transaction.objectStore(STATS_STORE).put(record);
  await transactionDone(transaction);
}

export async function deleteStatsRecordsFromDb(database: IDBDatabase, scopeIds: string[]) {
  if (scopeIds.length === 0) {
    return;
  }

  const transaction = database.transaction(STATS_STORE, 'readwrite');
  const store = transaction.objectStore(STATS_STORE);
  for (const scopeId of scopeIds) {
    store.delete(scopeId);
  }
  await transactionDone(transaction);
}
