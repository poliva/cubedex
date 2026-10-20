import { GYRO_DRIFT_THRESHOLDS, GYRO_ESTIMATOR_VERSION } from './gyro-drift';

const STORAGE_KEY = 'cubedex.gyroDiagnostics.v1';
const MAX_ENTRIES = 1000;
const MAX_SAMPLES = 3000;
const MAX_BYTES = 1_500_000;
export type GyroDiagnosticEntry = { event: string; recordedAt: string; sessionId: string | null;
  estimatorVersion?: number; data: Record<string, unknown> };
type DiagnosticSample = Record<string, unknown> & { at: number; sessionId: string | null };
const CRITICAL_EVENTS = new Set(['connection', 'device', 'setting', 'log-cleared', 'reference-established', 'reference-cleared',
  'manual-reset-request', 'manual-reset-comparison', 'correction-start', 'correction-applied',
  'guided-recovery-start', 'guided-recovery-cancel', 'guided-setup-start', 'guided-setup-cancel',
  'guided-reference', 'training-context']);

/** Bounded local recording, including production builds and disconnected cubes. */
export class GyroDiagnostics {
  private entries: GyroDiagnosticEntry[] = [];
  private droppedEntries = 0;
  private droppedSamples = 0;
  private samples = new Map<string, DiagnosticSample>();
  private thresholdSets: Record<string, unknown> = { [GYRO_ESTIMATOR_VERSION]: GYRO_DRIFT_THRESHOLDS };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private device: Record<string, unknown> = {};
  private persistenceError = false;

  constructor(private storage: Storage | null) {
    try {
      const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      if ((stored?.schemaVersion === 1 || stored?.schemaVersion === 2) && Array.isArray(stored.entries)) {
        if (stored.thresholdSets && typeof stored.thresholdSets === 'object') Object.assign(this.thresholdSets, stored.thresholdSets);
        if (stored.thresholds) this.thresholdSets[String(stored.estimatorVersion ?? 1)] = stored.thresholds;
        if (Array.isArray(stored.samples)) {
          for (const sample of stored.samples) this.addSample(sample, sample.sessionId);
        }
        this.entries = stored.entries.filter((entry: GyroDiagnosticEntry) => entry && typeof entry.event === 'string'
          && typeof entry.recordedAt === 'string' && entry.data && typeof entry.data === 'object')
          .map((entry: GyroDiagnosticEntry) => ({ ...entry, estimatorVersion: entry.estimatorVersion ?? stored.estimatorVersion ?? 1,
            data: this.compactData(entry.data, entry.sessionId) }));
        this.droppedEntries = Number.isSafeInteger(stored.droppedEntries) ? stored.droppedEntries : 0;
        this.droppedSamples += Number.isSafeInteger(stored.droppedSamples) ? stored.droppedSamples : 0;
        while (this.entries.length > MAX_ENTRIES) this.dropEntry();
      }
    } catch { this.persistenceError = true; }
  }

  startSession(device: Record<string, unknown>) {
    this.sessionId = crypto.randomUUID();
    this.device = device;
    this.record('connection', { thresholds: GYRO_DRIFT_THRESHOLDS });
    this.flush();
  }

  updateDevice(device: Record<string, unknown>) {
    this.device = { ...this.device, ...device };
    this.record('device', {});
  }

  record = (event: string, data: Record<string, unknown>) => {
    let compact = this.compactData(data, this.sessionId);
    // Keep a short inline context for reference anchors even when routine
    // shared samples are evicted later in a long session.
    const context = event === 'manual-reset-request' ? data.recentSamples
      : event === 'guided-reference' ? (data.before as Record<string, unknown> | undefined)?.recentSamples : null;
    if (Array.isArray(context)) compact.contextSamples = context.slice(-12);
    if (event === 'sample' && typeof data.at === 'number') {
      this.addSample(data, this.sessionId);
      compact = { sampleAt: data.at };
    }
    this.entries.push({ event, recordedAt: new Date().toISOString(), sessionId: this.sessionId,
      estimatorVersion: GYRO_ESTIMATOR_VERSION,
      data: { device: { ...this.device }, ...compact } });
    while (this.entries.length > MAX_ENTRIES) this.dropEntry();
    // Samples stay in memory at gyro rate; storage writes are batched.
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 2000);
  };

  report() {
    const thresholdSets: Record<string, unknown> = { ...this.thresholdSets, [GYRO_ESTIMATOR_VERSION]: GYRO_DRIFT_THRESHOLDS };
    return {
      schemaVersion: 2, recordingVersion: 3, estimatorVersion: GYRO_ESTIMATOR_VERSION, exportedAt: new Date().toISOString(),
      thresholds: GYRO_DRIFT_THRESHOLDS,
      thresholdSets,
      coordinates: 'Physical right-handed: +X red, +Y white, +Z green. White up / green front is identity. Camera tilt excluded. Angles in degrees; monotonic times in ms are local to each page load.',
      resetAssumption: 'At Reset Gyro the user holds white up / green front. Residuals evaluate the OLD reference at the first NEW sample, before resetting it. They also include intentional pose error if this assumption is not met.',
      sampleReferences: 'Match recentSampleTimes and sampleAt to samples by sessionId and at. Shared samples avoid duplicating overlapping windows. Routine sample pointer entries may be discarded while their sensor samples remain. Old samples may be evicted before calibration/reset events.',
      droppedEntries: this.droppedEntries, droppedSamples: this.droppedSamples,
      persistenceError: this.persistenceError, entries: [...this.entries], samples: [...this.samples.values()],
    };
  }

  flush = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.storage) return;
    try {
      let json = JSON.stringify(this.report());
      while (json.length * 2 > MAX_BYTES && (this.entries.length > 1 || this.samples.size > 0)) {
        // Sample entries repeat device metadata and only point into samples.
        // Discard those pointers before the actual sensor evidence they name.
        const pointers = this.entries.filter(entry => entry.event === 'sample').length;
        if (pointers) {
          const count = Math.max(1, Math.floor(pointers / 4));
          for (let i = 0; i < count; i++) this.dropEntry();
        } else if (this.samples.size) {
          this.dropSamples(Math.max(1, Math.floor(this.samples.size / 4)));
        } else {
          const count = Math.max(1, Math.floor(this.entries.length / 4));
          for (let i = 0; i < count && this.entries.length > 1; i++) this.dropEntry();
        }
        json = JSON.stringify(this.report());
      }
      this.storage.setItem(STORAGE_KEY, json);
      this.persistenceError = false;
    } catch { this.persistenceError = true; }
  };

  clear() {
    this.entries = [];
    this.droppedEntries = 0;
    this.samples.clear();
    this.thresholdSets = { [GYRO_ESTIMATOR_VERSION]: GYRO_DRIFT_THRESHOLDS };
    this.droppedSamples = 0;
    this.record('log-cleared', { thresholds: GYRO_DRIFT_THRESHOLDS });
    this.flush();
  }

  download() {
    this.record('export', {});
    this.flush();
    const blob = new Blob([JSON.stringify(this.report(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cubedex-gyro-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private addSample(sample: Record<string, unknown>, sessionId: string | null) {
    if (typeof sample.at !== 'number' || !Number.isFinite(sample.at)) return;
    this.samples.set(`${sessionId}:${sample.at}`, { ...sample, at: sample.at, sessionId });
    if (this.samples.size > MAX_SAMPLES) this.dropSamples(this.samples.size - MAX_SAMPLES);
  }

  private compactData(data: Record<string, unknown>, sessionId: string | null): Record<string, unknown> {
    const compact = { ...data };
    if (Array.isArray(data.recentSamples)) {
      compact.recentSampleTimes = data.recentSamples.map((sample: Record<string, unknown>) => {
        this.addSample(sample, sessionId);
        return sample.at;
      });
      delete compact.recentSamples;
    }
    for (const key of ['beforeClick', 'before']) {
      if (data[key] && typeof data[key] === 'object') {
        compact[key] = this.compactData(data[key] as Record<string, unknown>, sessionId);
      }
    }
    return compact;
  }

  private dropSamples(count: number) {
    for (const key of this.samples.keys()) {
      if (count-- <= 0) break;
      this.samples.delete(key);
      this.droppedSamples++;
    }
  }

  private dropEntry() {
    let index = this.entries.findIndex(entry => entry.event === 'sample');
    if (index < 0) index = this.entries.findIndex(entry => !CRITICAL_EVENTS.has(entry.event));
    this.entries.splice(Math.max(0, index), 1);
    this.droppedEntries++;
  }
}
