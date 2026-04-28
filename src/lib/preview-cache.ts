import { TwistyPlayer } from 'cubing/twisty';
import { Alg } from 'cubing/alg';
import {
  deletePreviewFromDb,
  loadPreviewFromDb,
  openCubedexDatabase,
  prunePreviewsInDb,
  savePreviewToDb,
} from './idb-storage';

export type Preview =
  { src: string };

export interface PreviewParams {
  alg: string;
  visualization: string;
  stickering: string;
  setupAnchor?: 'start' | 'end';
}

export type PreviewKey = string;

export const PREVIEW_CACHE_VERSION = 1;
const LRU_CAPACITY = 512;
const PERSISTENT_CACHE_CAPACITY = 1024;

const cache = new Map<PreviewKey, Preview>();
const pending = new Map<PreviewKey, Promise<Preview>>();
const subscribers = new Map<PreviewKey, Set<() => void>>();

function previewIsEmpty(value: Preview): boolean {
  return !value.src;
}

function is2DVisualization(visualization: string): boolean {
  return ['2D', 'experimental-2D-LL', 'experimental-2D-LL-face'].includes(visualization);
}

async function get2DSvgMarkupFromPlayer(
  player: TwistyPlayer,
): Promise<string> {
  try {
    // `TwistyPlayer` uses a closed shadow root, so `shadowRoot` is not accessible.
    // Instead, reuse the built-in 2D screenshot path by intercepting the SVG Blob it creates.
    // Note: this project’s TS lib/types may not include DOM `Blob`, so keep this `any`.
    let capturedBlob: any = null;
    const prevCreateObjectURL = URL.createObjectURL;
    const prevRevokeObjectURL = URL.revokeObjectURL;
    const prevCreateElement = document.createElement.bind(document);
    const objectUrls: string[] = [];

    URL.createObjectURL = ((blob: Blob) => {
      capturedBlob = blob;
      const url = prevCreateObjectURL(blob);
      objectUrls.push(url);
      return url;
    }) as typeof URL.createObjectURL;

    URL.revokeObjectURL = ((url: string) => {
      // Avoid breaking the download path while we're capturing.
      try {
        prevRevokeObjectURL(url);
      } catch {
        // ignore
      }
    }) as typeof URL.revokeObjectURL;

    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      const el = prevCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        // Suppress the synthetic download click.
        (el as HTMLAnchorElement).click = () => {};
      }
      return el;
    }) as typeof document.createElement;

    try {
      await player.experimentalDownloadScreenshot('__cubedex_preview_cache__');
    } finally {
      URL.createObjectURL = prevCreateObjectURL;
      URL.revokeObjectURL = prevRevokeObjectURL;
      document.createElement = prevCreateElement;
      for (const url of objectUrls) {
        try {
          prevRevokeObjectURL(url);
        } catch {
          // ignore
        }
      }
    }

    if (!capturedBlob) return '';

    const markup =
      typeof capturedBlob?.text === 'function'
        ? await capturedBlob.text()
        : await new Response(capturedBlob).text();
    return markup;
  } catch {
    return '';
  }
}

async function rasterizeSvgToPng(svgMarkup: string, width: number, height: number): Promise<string> {
  if (!svgMarkup) return '';
  try {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;

    // Prefer decode() (more reliable than onload timing).
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    // Transparent background (default).
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function touch(key: PreviewKey, value: Preview) {
  if (previewIsEmpty(value)) return;
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > LRU_CAPACITY) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function previewKey(params: PreviewParams): PreviewKey {
  return `v${PREVIEW_CACHE_VERSION}|${params.visualization}|${params.stickering}|${params.setupAnchor ?? 'end'}|${params.alg}`;
}

export function getPreview(key: PreviewKey): Preview | undefined {
  return cache.get(key);
}

export function subscribePreview(key: PreviewKey, listener: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(listener);
  return () => {
    const s = subscribers.get(key);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) subscribers.delete(key);
  };
}

function notify(key: PreviewKey) {
  const s = subscribers.get(key);
  if (!s) return;
  for (const fn of s) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

/**
 * Invalidate previews for an algorithm.
 * Called when an algorithm is edited or deleted to ensure fresh previews are generated.
 * This clears in-memory cache and marks for re-validation from persistent storage.
 */
export function invalidatePreview(alg: string): void {
  // The previewKey ends with: `|${visualization}|${stickering}|${setupAnchor}|${alg}`
  // We can match by the alg suffix since it's at the end of the key.
  const algKey = `|${alg}`;

  // Delete from in-memory cache and notify subscribers
  for (const key of cache.keys()) {
    if (key.endsWith(algKey)) {
      cache.delete(key);
      notify(key);
    }
  }

  // Cancel pending requests for this alg
  for (const key of pending.keys()) {
    if (key.endsWith(algKey)) {
      pending.delete(key);
    }
  }

  // For persistent storage, we'll clear all previews for this category when needed.
  // The simplest approach: next request will fall back to re-rendering.
  // Full cleanup would require enumerating all preview keys in IndexedDB.
}

async function loadPreviewFromPersistentCache(key: PreviewKey): Promise<Preview | null> {
  try {
    const database = await openCubedexDatabase();
    const record = await loadPreviewFromDb(database, key);
    if (!record) {
      return null;
    }
    if (!record.src) {
      await deletePreviewFromDb(database, key);
      return null;
    }
    return { src: record.src };
  } catch {
    return null;
  }
}

async function persistPreview(key: PreviewKey, preview: Preview): Promise<void> {
  if (previewIsEmpty(preview)) {
    return;
  }
  try {
    const database = await openCubedexDatabase();
    await savePreviewToDb(database, {
      key,
      src: preview.src,
      updatedAt: Date.now(),
    });
    await prunePreviewsInDb(database, PERSISTENT_CACHE_CAPACITY);
  } catch {
    // ignore persistent cache failures and fall back to memory-only behavior
  }
}

// ----------------- Offscreen host + backends -----------------

let offscreenHost: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (offscreenHost) return offscreenHost;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Position on-screen so layout has non-zero size; hide visually.
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '240px';
  host.style.height = '240px';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';
  document.body.appendChild(host);
  offscreenHost = host;
  return host;
}

type Backend = {
  player: TwistyPlayer;
  container: HTMLDivElement;
  baseline2DSvgChecksum?: number;
};

const backends = new Map<string, Backend>();

function checksum32(str: string): number {
  // Simple non-crypto checksum to detect SVG changes.
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Cubing mounts visualization after IntersectionObserver calls this async hook; offscreen hosts often never intersect — invoke and await the same hook. */
async function awaitTwistyIntersectedCallback(player: TwistyPlayer): Promise<void> {
  let fn: ((this: TwistyPlayer) => Promise<unknown>) | undefined;
  for (
    let p: object | null = Object.getPrototypeOf(player);
    p && !fn;
    p = Object.getPrototypeOf(p)
  ) {
    const sym = Object.getOwnPropertySymbols(p).find(
      (s) => s.description === 'intersectedCallback',
    );
    if (sym === undefined) continue;
    const candidate = (p as Record<symbol, unknown>)[sym];
    if (typeof candidate === 'function') fn = candidate as (this: TwistyPlayer) => Promise<unknown>;
  }
  if (fn) await fn.call(player);
}

function ensureBackend(visualization: string): Backend {
  const existing = backends.get(visualization);
  if (existing) return existing;
  const host = ensureHost();
  const container = document.createElement('div');
  container.style.width = '240px';
  container.style.height = '240px';
  host.appendChild(container);

  // Use the same toVisualization logic as TwistyCube.
  let vizValue: 'PG3D' | '3D' | '2D' | 'experimental-2D-LL' | 'experimental-2D-LL-face';
  switch (visualization) {
    case '2D':
      vizValue = '2D';
      break;
    case '3D':
      vizValue = '3D';
      break;
    case 'experimental-2D-LL':
      vizValue = 'experimental-2D-LL';
      break;
    case 'experimental-2D-LL-face':
      vizValue = 'experimental-2D-LL-face';
      break;
    default:
      vizValue = 'PG3D';
  }

  const player = new TwistyPlayer({
    puzzle: '3x3x3',
    visualization: vizValue,
    alg: '',
    background: 'none',
    controlPanel: 'none',
    viewerLink: 'none',
    hintFacelets: 'none',
    experimentalDragInput: 'none',
    experimentalSetupAnchor: 'end',
    cameraLatitude: 25,
    cameraLongitude: -35,
  });
  const playerEl = player as unknown as HTMLElement;
  playerEl.style.width = '240px';
  playerEl.style.height = '240px';
  container.appendChild(playerEl);

  const backend: Backend = { player, container };
  backends.set(visualization, backend);
  return backend;
}

// ----------------- Job queue (single-slot) -----------------

type Job = () => Promise<void>;
const jobQueue: Job[] = [];
let running = false;

function enqueue(job: Job): void {
  jobQueue.push(job);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!;
      try {
        await job();
      } catch {
        // ignore
      }
    }
  } finally {
    running = false;
  }
}

// ----------------- Render ops -----------------

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function flushTwistyModel(): Promise<void> {
  // TwistyPlayer/model dispatch some listeners async (setTimeout 0).
  // For 2D SVG serialization, we need stickering/setup changes applied before we serialize.
  await nextTask();
  await nextFrame();
}

async function renderSvgPreview(params: PreviewParams): Promise<Preview> {
  const backend = ensureBackend(params.visualization);
  const { player } = backend;
  await awaitTwistyIntersectedCallback(player);

  // Capture a baseline "solved" SVG checksum per backend so we can avoid caching
  // the initial solved render if the first capture happens too early.
  if (backend.baseline2DSvgChecksum === undefined) {
    await flushTwistyModel();
    const baselineMarkup = await get2DSvgMarkupFromPlayer(player);
    backend.baseline2DSvgChecksum = checksum32(baselineMarkup);
  }

  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = Alg.fromString(params.alg).invert().toString();
  player.alg = '';
  let markup = '';
  try {
    // Retry a few times to avoid capturing an uninitialized/previous state SVG.
    for (let attempt = 0; attempt < 4 && !markup; attempt += 1) {
      await flushTwistyModel();

      markup = await get2DSvgMarkupFromPlayer(player);
      const currentChecksum = checksum32(markup);

      if (markup && currentChecksum !== backend.baseline2DSvgChecksum) break;
    }
  } catch {
    markup = '';
  }
  const src = await rasterizeSvgToPng(markup, 512, 512);
  return { src };
}

async function renderImagePreview(params: PreviewParams): Promise<Preview> {
  const backend = ensureBackend(params.visualization);
  const { player } = backend;
  await awaitTwistyIntersectedCallback(player);
  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = Alg.fromString(params.alg).invert().toString();
  player.alg = '';
  await nextFrame();
  await nextFrame();
  let src = '';
  try {
    src = await player.experimentalScreenshot({ width: 512, height: 512 });
  } catch {
    src = '';
  }
  return { src };
}

export function requestPreview(params: PreviewParams): Promise<Preview> {
  const key = previewKey(params);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = new Promise<Preview>((resolve) => {
    enqueue(async () => {
      try {
        const persisted = await loadPreviewFromPersistentCache(key);
        if (persisted) {
          touch(key, persisted);
          resolve(persisted);
          notify(key);
          return;
        }

        const preview = is2DVisualization(params.visualization)
          ? await renderSvgPreview(params)
          : await renderImagePreview(params);
        touch(key, preview);
        await persistPreview(key, preview);
        resolve(preview);
        notify(key);
      } catch (e) {
        const fallback: Preview = { src: '' };
        resolve(fallback);
      } finally {
        pending.delete(key);
      }
    });
  });
  pending.set(key, promise);
  return promise;
}
