import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = {} as IDBDatabase;
const experimentalScreenshotMock = vi.fn<() => Promise<string>>();
const openCubedexDatabaseMock = vi.fn<() => Promise<IDBDatabase>>();
const loadPreviewFromDbMock = vi.fn();
const savePreviewToDbMock = vi.fn();
const deletePreviewFromDbMock = vi.fn();
const prunePreviewsInDbMock = vi.fn();

vi.mock('cubing/alg', () => ({
  Alg: {
    fromString: vi.fn((alg: string) => ({
      invert: () => ({
        toString: () => `inverted:${alg}`,
      }),
    })),
  },
}));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: class {
    constructor() {
      const element = document.createElement('div') as HTMLDivElement & {
        experimentalScreenshot: typeof experimentalScreenshotMock;
        experimentalDownloadScreenshot: ReturnType<typeof vi.fn>;
        experimentalStickering?: string;
        experimentalSetupAnchor?: 'start' | 'end';
        experimentalSetupAlg?: string;
        alg?: string;
      };
      element.experimentalScreenshot = experimentalScreenshotMock;
      element.experimentalDownloadScreenshot = vi.fn();
      return element;
    }
  },
}));

vi.mock('../../src/lib/idb-storage', () => ({
  openCubedexDatabase: openCubedexDatabaseMock,
  loadPreviewFromDb: loadPreviewFromDbMock,
  savePreviewToDb: savePreviewToDbMock,
  deletePreviewFromDb: deletePreviewFromDbMock,
  prunePreviewsInDb: prunePreviewsInDbMock,
}));

async function loadPreviewCacheModule() {
  return import('../../src/lib/preview-cache');
}

describe('preview cache', () => {
  beforeEach(() => {
    vi.resetModules();
    experimentalScreenshotMock.mockReset().mockResolvedValue('data:image/png;base64,generated');
    openCubedexDatabaseMock.mockReset().mockResolvedValue(database);
    loadPreviewFromDbMock.mockReset().mockResolvedValue(null);
    savePreviewToDbMock.mockReset().mockResolvedValue(undefined);
    deletePreviewFromDbMock.mockReset().mockResolvedValue(undefined);
    prunePreviewsInDbMock.mockReset().mockResolvedValue(undefined);
  });

  it('reuses an in-memory preview without reloading or regenerating it', async () => {
    const previewCache = await loadPreviewCacheModule();
    const params = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };

    await previewCache.requestPreview(params);
    loadPreviewFromDbMock.mockClear();
    savePreviewToDbMock.mockClear();
    prunePreviewsInDbMock.mockClear();
    experimentalScreenshotMock.mockClear();

    const preview = await previewCache.requestPreview(params);

    expect(preview).toEqual({ src: 'data:image/png;base64,generated' });
    expect(loadPreviewFromDbMock).not.toHaveBeenCalled();
    expect(savePreviewToDbMock).not.toHaveBeenCalled();
    expect(prunePreviewsInDbMock).not.toHaveBeenCalled();
    expect(experimentalScreenshotMock).not.toHaveBeenCalled();
  });

  it('hydrates memory from IndexedDB and skips generation on cache hit', async () => {
    const previewCache = await loadPreviewCacheModule();
    const params = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };
    const key = previewCache.previewKey(params);
    loadPreviewFromDbMock.mockResolvedValue({
      key,
      src: 'data:image/png;base64,persisted',
      updatedAt: 123,
    });

    const preview = await previewCache.requestPreview(params);

    expect(preview).toEqual({ src: 'data:image/png;base64,persisted' });
    expect(previewCache.getPreview(key)).toEqual({ src: 'data:image/png;base64,persisted' });
    expect(experimentalScreenshotMock).not.toHaveBeenCalled();
    expect(savePreviewToDbMock).not.toHaveBeenCalled();
    expect(prunePreviewsInDbMock).not.toHaveBeenCalled();

    loadPreviewFromDbMock.mockClear();
    await previewCache.requestPreview(params);
    expect(loadPreviewFromDbMock).not.toHaveBeenCalled();
  });

  it('generates and persists a preview on cache miss', async () => {
    const previewCache = await loadPreviewCacheModule();
    const params = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };
    const key = previewCache.previewKey(params);

    const preview = await previewCache.requestPreview(params);

    expect(preview).toEqual({ src: 'data:image/png;base64,generated' });
    expect(loadPreviewFromDbMock).toHaveBeenCalledWith(database, key);
    expect(savePreviewToDbMock).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        key,
        src: 'data:image/png;base64,generated',
        updatedAt: expect.any(Number),
      }),
    );
    expect(prunePreviewsInDbMock).toHaveBeenCalledWith(database, expect.any(Number));
    expect(previewCache.getPreview(key)).toEqual({ src: 'data:image/png;base64,generated' });
  });

  it('uses versioned keys and regenerates when the cache key changes', async () => {
    const previewCache = await loadPreviewCacheModule();
    const firstParams = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };
    const secondParams = {
      ...firstParams,
      stickering: 'full',
    };

    const firstKey = previewCache.previewKey(firstParams);
    const secondKey = previewCache.previewKey(secondParams);

    await previewCache.requestPreview(firstParams);
    await previewCache.requestPreview(secondParams);

    expect(firstKey).toBe(`v${previewCache.PREVIEW_CACHE_VERSION}|3D|PLL|end|R U R'`);
    expect(secondKey).toBe(`v${previewCache.PREVIEW_CACHE_VERSION}|3D|full|end|R U R'`);
    expect(firstKey).not.toBe(secondKey);
    expect(experimentalScreenshotMock).toHaveBeenCalledTimes(2);
  });

  it('does not persist or retain empty previews', async () => {
    experimentalScreenshotMock.mockResolvedValue('');
    const previewCache = await loadPreviewCacheModule();
    const params = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };
    const key = previewCache.previewKey(params);

    const preview = await previewCache.requestPreview(params);

    expect(preview).toEqual({ src: '' });
    expect(savePreviewToDbMock).not.toHaveBeenCalled();
    expect(prunePreviewsInDbMock).not.toHaveBeenCalled();
    expect(previewCache.getPreview(key)).toBeUndefined();
  });

  it('invalidates cached previews when algorithm is edited', async () => {
    const previewCache = await loadPreviewCacheModule();
    const params = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };

    // First request generates and caches the preview
    const firstPreview = await previewCache.requestPreview(params);
    expect(firstPreview).toEqual({ src: 'data:image/png;base64,generated' });
    expect(experimentalScreenshotMock).toHaveBeenCalledTimes(1);

    // Invalidate the preview (simulating algorithm edit)
    experimentalScreenshotMock.mockClear();
    previewCache.invalidatePreview("R U R'");

    // The cache should be cleared - requesting again should regenerate
    const key = previewCache.previewKey(params);
    expect(previewCache.getPreview(key)).toBeUndefined();

    // Request again - should regenerate the preview
    const secondPreview = await previewCache.requestPreview(params);
    expect(secondPreview).toEqual({ src: 'data:image/png;base64,generated' });
    expect(experimentalScreenshotMock).toHaveBeenCalledTimes(1);
  });

  it('does not affect other cached previews when invalidating one algorithm', async () => {
    const previewCache = await loadPreviewCacheModule();
    const params1 = {
      alg: "R U R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };
    const params2 = {
      alg: "U R U' R'",
      visualization: '3D',
      stickering: 'PLL',
      setupAnchor: 'end' as const,
    };

    // Generate previews for both algorithms
    await previewCache.requestPreview(params1);
    await previewCache.requestPreview(params2);
    expect(experimentalScreenshotMock).toHaveBeenCalledTimes(2);

    // Invalidate only the first algorithm
    experimentalScreenshotMock.mockClear();
    previewCache.invalidatePreview("R U R'");

    // First algorithm's cache should be cleared
    const key1 = previewCache.previewKey(params1);
    expect(previewCache.getPreview(key1)).toBeUndefined();

    // Second algorithm's cache should still exist
    const key2 = previewCache.previewKey(params2);
    expect(previewCache.getPreview(key2)).toEqual({ src: 'data:image/png;base64,generated' });

    // Requesting second algorithm should use cache (no new generation)
    await previewCache.requestPreview(params2);
    expect(experimentalScreenshotMock).toHaveBeenCalledTimes(0);
  });
});
