import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedAlgorithms } from '../../src/lib/storage';
import type { ScopedStatsRecord } from '../../src/lib/idb-storage';

const db = vi.hoisted(() => ({
  library: {} as SavedAlgorithms,
  meta: new Map<string, unknown>(),
  stats: [] as ScopedStatsRecord[],
}));
vi.mock('../../src/lib/idb-storage', async () => ({
  ...await vi.importActual<typeof import('../../src/lib/idb-storage')>('../../src/lib/idb-storage'),
  openCubedexDatabase: vi.fn(async () => ({})),
  getMetaValue: vi.fn(async (_db, key: string) => db.meta.get(key)),
  loadSavedAlgorithmsFromDb: vi.fn(async () => db.library),
  loadAllStatsFromDb: vi.fn(async () => db.stats),
  replaceLibraryAndStatsInDb: vi.fn(async (_db, library: SavedAlgorithms, stats: ScopedStatsRecord[], meta: Array<{ key: string; value: unknown }> = []) => {
    db.library = structuredClone(library);
    db.stats = structuredClone(stats);
    for (const item of meta) db.meta.set(item.key, item.value);
  }),
}));
const defaults = {
  OLL: [{ subset: 'Corners', algorithms: [{ name: 'Default', algorithm: 'R U' }] }],
  '2x2x2:OLL': [{ subset: 'Ortega', algorithms: [{ name: 'Sune', algorithm: "R U R' U R U2 R'" }] }],
};

beforeEach(() => {
  vi.resetModules();
  db.meta.clear();
  db.stats = [];
  db.meta.set('lsMigrationDone', true);
  db.library = { OLL: [{ subset: 'Mine', algorithms: [{ name: 'My alg', algorithm: 'R' }] }] };
});

describe('puzzle library persistence', () => {
  it('adds 2×2 defaults once and preserves edits and deletions across launches', async () => {
    let storage = await import('../../src/lib/storage');
    await storage.initializeDefaultAlgorithms(defaults);
    expect(storage.getSavedAlgorithms().OLL[0].subset).toBe('Mine');
    expect(storage.getSavedAlgorithms()['2x2x2:OLL']).toEqual(defaults['2x2x2:OLL']);
    await storage.deleteAlgorithm('2x2x2:OLL', defaults['2x2x2:OLL'][0].algorithms[0].algorithm);
    vi.resetModules();
    storage = await import('../../src/lib/storage');
    await storage.initializeDefaultAlgorithms(defaults);
    expect(storage.getSavedAlgorithms()['2x2x2:OLL']).toBeUndefined();
  });

  it('adds new sets to an already seeded puzzle without restoring its deleted OLL set', async () => {
    db.meta.set('algSetDefaults:2x2x2:OLL:v1', true);
    const storage = await import('../../src/lib/storage');
    const expandedDefaults = {
      ...defaults,
      '2x2x2:PBL': [{ subset: 'Ortega', algorithms: [{ name: 'Opp Opp', algorithm: 'R2 F2 R2' }] }],
      'megaminx:EO': [{ subset: 'EO', algorithms: [{ name: 'EO 1', algorithm: "F R U R' U' F'" }] }],
    };
    await storage.initializeDefaultAlgorithms(expandedDefaults);
    expect(storage.getSavedAlgorithms()['2x2x2:OLL']).toBeUndefined();
    expect(storage.getSavedAlgorithms()['2x2x2:PBL']).toEqual(expandedDefaults['2x2x2:PBL']);
    expect(storage.getSavedAlgorithms()['megaminx:EO']).toEqual(expandedDefaults['megaminx:EO']);
    await storage.deleteAlgorithm('megaminx:EO', "F R U R' U' F'");
    vi.resetModules();
    const reloaded = await import('../../src/lib/storage');
    await reloaded.initializeDefaultAlgorithms(expandedDefaults);
    expect(reloaded.getSavedAlgorithms()['megaminx:EO']).toBeUndefined();
    expect(reloaded.getSavedAlgorithms()['2x2x2:OLL']).toBeUndefined();
  });

  it('round-trips mixed-puzzle imports without changing notation or the legacy category IDs', async () => {
    const storage = await import('../../src/lib/storage');
    await storage.initializeDefaultAlgorithms(defaults);
    const mixed = { ...defaults, 'square1:Custom': [{ subset: 'Slices', algorithms: [{ name: 'Slice', algorithm: '(1, 0) /' }] }] };
    await storage.importAlgorithmsFromJson(JSON.stringify(mixed));
    expect(storage.getSavedAlgorithms()).toEqual(mixed);
    expect(db.library).toEqual(mixed);
  });
});
