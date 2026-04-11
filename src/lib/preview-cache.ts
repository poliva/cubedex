import { TwistyPlayer } from 'cubing/twisty';

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

function touch(key: PreviewKey, value: Preview) {
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
  // Keep the host technically on-screen at (0,0) so twisty's lazy
  // IntersectionObserver-based init still fires. Hide via opacity + z-index.
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '240px';
  host.style.height = '240px';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.zIndex = '-2147483647';
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

function deepQuerySelector<T extends Element>(
  root: ParentNode | null,
  selector: string,
): T | null {
  if (!root) return null;
  const direct = (root as ParentNode).querySelector?.(selector) as T | null;
  if (direct) return direct;
  const walker = (root as Document | DocumentFragment | Element).querySelectorAll?.('*');
  if (!walker) return null;
  for (const el of Array.from(walker)) {
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) {
      const found = deepQuerySelector<T>(sr, selector);
      if (found) return found;
    }
  }
  return null;
}

function findCanvas(player: TwistyPlayer): HTMLCanvasElement | null {
  const el = player as unknown as HTMLElement;
  return (
    deepQuerySelector<HTMLCanvasElement>(el, 'canvas') ??
    deepQuerySelector<HTMLCanvasElement>(el.shadowRoot ?? null, 'canvas')
  );
}

function findSvg(player: TwistyPlayer): SVGElement | null {
  const el = player as unknown as HTMLElement;
  return (
    deepQuerySelector<SVGElement>(el, 'svg') ??
    deepQuerySelector<SVGElement>(el.shadowRoot ?? null, 'svg')
  );
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

async function waitForElement<T>(
  finder: () => T | null,
  maxFrames = 60,
): Promise<T | null> {
  for (let i = 0; i < maxFrames; i += 1) {
    const found = finder();
    if (found) return found;
    await nextFrame();
  }
  return finder();
}

function tryReadCanvasImage(canvas: HTMLCanvasElement): string {
  // Path 1: toDataURL (works only if WebGL was created with preserveDrawingBuffer
  // OR we call this synchronously with the prior render() before the next composite).
  try {
    const direct = canvas.toDataURL('image/png');
    if (direct && direct !== 'data:,' && !direct.endsWith('AAAAASUVORK5CYII=')) {
      return direct;
    }
  } catch {
    // ignore
  }
  // Path 2: copy via a 2D canvas (works for non-WebGL canvases / where direct toDataURL is blank).
  try {
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(canvas, 0, 0);
    return off.toDataURL('image/png');
  } catch {
    return '';
  }
}

async function renderImagePreview(params: PreviewParams): Promise<Preview> {
  const backend = ensureBackend(params.visualization);
  const { player } = backend;
  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = params.alg;
  player.alg = '';

  // Wait until twisty has built its internal canvas with non-zero dimensions.
  const canvas = await waitForElement(
    () => {
      const c = findCanvas(player);
      return c && c.width > 0 && c.height > 0 ? c : null;
    },
    90,
  );
  if (!canvas) return { kind: 'image', src: '' };

  // Get a vantage and force a render.
  let vantage: { render?: () => void } | undefined;
  try {
    const vantages = await player.experimentalCurrentVantages();
    vantage = [...vantages][0] as { render?: () => void } | undefined;
  } catch {
    // ignore
  }

  // Render across a few frames so pending stickering / setup-alg layout
  // is flushed before we read the buffer.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      vantage?.render?.();
    } catch {
      // ignore
    }
    await nextFrame();
  }
  try {
    vantage?.render?.();
  } catch {
    // ignore
  }
  // Read pixels in the same task as the final render() so the drawing buffer is still valid.
  const src = tryReadCanvasImage(canvas);
  return { kind: 'image', src };
}

function svgHasContent(svg: SVGElement): boolean {
  // Twisty mounts an empty <svg/> first, then fills it with sticker children.
  // We require some descendants and a non-zero viewBox to consider it ready.
  if (!svg.childNodes || svg.childNodes.length === 0) return false;
  // A useful 2D-LL svg has at least a few <rect>/<polygon>/<g> elements.
  const meaningful = svg.querySelectorAll('rect, polygon, path, g').length;
  return meaningful > 0;
}

async function renderSvgPreview(params: PreviewParams): Promise<Preview> {
  const backend = ensureBackend(params.visualization);
  const { player } = backend;
  player.experimentalStickering = params.stickering;
  player.experimentalSetupAnchor = params.setupAnchor ?? 'end';
  player.experimentalSetupAlg = params.alg;
  player.alg = '';

  // Wait for the svg to appear in the player's shadow DOM AND get filled in.
  const svg = await waitForElement(
    () => {
      const s = findSvg(player);
      if (!s) return null;
      return svgHasContent(s) ? s : null;
    },
    120,
  );
  if (!svg) return { kind: 'svg', markup: '' };

  // Give twisty a couple more frames so the latest stickering/alg settles.
  await nextFrame();
  await nextFrame();
  const latest = findSvg(player) ?? svg;

  // Clone so we can normalize attributes without mutating twisty's live SVG.
  const clone = latest.cloneNode(true) as SVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  // Force responsive sizing inside the card.
  clone.setAttribute('width', '100%');
  clone.setAttribute('height', '100%');
  clone.removeAttribute('style');
  if (!clone.getAttribute('viewBox')) {
    const w = latest.getAttribute('width') ?? '256';
    const h = latest.getAttribute('height') ?? '256';
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  const markup = new XMLSerializer().serializeToString(clone);
  return { kind: 'svg', markup };
}

function isSvgVisualization(visualization: string): boolean {
  return visualization === 'experimental-2D-LL' || visualization === 'experimental-2D-LL-face' || visualization === '2D';
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
        const preview = isSvgVisualization(params.visualization)
          ? await renderSvgPreview(params)
          : await renderImagePreview(params);
        touch(key, preview);
        resolve(preview);
        notify(key);
      } catch {
        const fallback: Preview = isSvgVisualization(params.visualization)
          ? { kind: 'svg', markup: '' }
          : { kind: 'image', src: '' };
        resolve(fallback);
      } finally {
        pending.delete(key);
      }
    });
  });
  pending.set(key, promise);
  return promise;
}
