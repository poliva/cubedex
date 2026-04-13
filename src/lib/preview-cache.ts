import { TwistyPlayer } from 'cubing/twisty';
import { Alg } from 'cubing/alg';

export type Preview =
  | { kind: 'image'; src: string }
  | { kind: 'svg'; markup: string };

export interface PreviewParams {
  alg: string;
  visualization: string;
  stickering: string;
  setupAnchor?: 'start' | 'end';
}

export type PreviewKey = string;

const LRU_CAPACITY = 512;

const cache = new Map<PreviewKey, Preview>();
const pending = new Map<PreviewKey, Promise<Preview>>();
const subscribers = new Map<PreviewKey, Set<() => void>>();

function hashString(input: string): string {
  // djb2-ish, cheap + deterministic
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function namespaceSvgIds(svgMarkup: string, prefix: string): { markup: string; idCount: number; replacedRefCount: number } {
  // Avoid global <defs id="..."> collisions across many inline SVG instances.
  const ids = new Set<string>();
  for (const match of svgMarkup.matchAll(/\sid="([^"]+)"/g)) {
    const id = match[1];
    if (id) ids.add(id);
  }
  if (ids.size === 0) return { markup: svgMarkup, idCount: 0, replacedRefCount: 0 };

  const idMap = new Map<string, string>();
  for (const id of ids) {
    idMap.set(id, `${prefix}-${id}`);
  }

  let replacedRefCount = 0;
  let out = svgMarkup.replace(/\sid="([^"]+)"/g, (full, id: string) => {
    const next = idMap.get(id);
    return next ? ` id="${next}"` : full;
  });

  out = out.replace(/url\(#([^)]+)\)/g, (full, id: string) => {
    const next = idMap.get(id);
    if (!next) return full;
    replacedRefCount += 1;
    return `url(#${next})`;
  });

  out = out.replace(/\s(href|xlink:href)="#([^"]+)"/g, (full, attr: string, id: string) => {
    const next = idMap.get(id);
    if (!next) return full;
    replacedRefCount += 1;
    return ` ${attr}="#${next}"`;
  });

  return { markup: out, idCount: ids.size, replacedRefCount };
}

function previewIsEmpty(value: Preview): boolean {
  return value.kind === 'image' ? !value.src : !value.markup;
}

function is2DVisualization(visualization: string): boolean {
  return ['2D', 'experimental-2D-LL', 'experimental-2D-LL-face'].includes(visualization);
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
  return `${params.visualization}|${params.stickering}|${params.setupAnchor ?? 'end'}|${params.alg}`;
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
};

const backends = new Map<string, Backend>();

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
  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = Alg.fromString(params.alg).invert().toString();
  player.alg = '';
  let markup = '';
  try {
    // Retry a couple times to avoid capturing an uninitialized/previous state SVG.
    for (let attempt = 0; attempt < 3 && !markup; attempt += 1) {
      await flushTwistyModel();

      markup = await player.experimentalGet2DSvgMarkup();
    }
  } catch {
    markup = '';
  }

  // Namespace internal SVG IDs per preview key to avoid DOM collisions.
  if (markup) {
    const prefix = `pv-${hashString(previewKey(params))}`;
    markup = namespaceSvgIds(markup, prefix).markup;
  }
  return { kind: 'svg', markup };
}

async function renderImagePreview(params: PreviewParams): Promise<Preview> {
  const backend = ensureBackend(params.visualization);
  const { player } = backend;
  await awaitTwistyIntersectedCallback(player);
  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = params.alg;
  player.alg = '';
  await nextFrame();
  await nextFrame();
  let src = '';
  try {
    src = await player.experimentalScreenshot({ width: 512, height: 512 });
  } catch {
    src = '';
  }
  return { kind: 'image', src };
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
        const preview = is2DVisualization(params.visualization)
          ? await renderSvgPreview(params)
          : await renderImagePreview(params);
        touch(key, preview);
        resolve(preview);
        notify(key);
      } catch (e) {
        const fallback: Preview = { kind: 'image', src: '' };
        resolve(fallback);
      } finally {
        pending.delete(key);
      }
    });
  });
  pending.set(key, promise);
  return promise;
}
